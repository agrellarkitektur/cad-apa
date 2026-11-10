import { beforeAll, describe, expect, it } from 'vitest';
import { registerBuiltInTypes } from '../src/elements';
import { activeMap, isSb11List, layerDef, nearestLayer, normalizeDxfSettings, penColor, sb11Name, simpleName, type LayerQuery } from '../src/core/dxfLayers';
import { planExport } from '../src/core/exportJobs';
import { formatsFor, normalizeExportSettings, normalizeOptions, optionsOf } from '../src/core/exportSettings';
import { addViewport, createSheet } from '../src/core/sheets';
import { DocStore } from '../src/core/store';
import { parseDxf } from '../src/formats/dxf';
import { dxfBytesText, readDxfLayerList } from '../src/formats/dxfLayerList';
import { lineweightOf, writeDxf } from '../src/formats/dxfWrite';
import { sheetDxf, viewDxf } from '../src/repr/exportDxf';
import { sampleProject } from '../src/sample/sampleProject';

beforeAll(() => registerBuiltInTypes());

const TODAY = '2026-11-10';
const opt = (version: 'R2000' | 'R2018' = 'R2000') => ({ version, today: TODAY });
const q = (o: Partial<LayerQuery>): LayerQuery => ({ status: 'N', ...o });

/** Lagren i en DXF och hur många entiteter varje har, ur vår egen läsare. */
function layersOf(bytes: Uint8Array): Map<string, number> {
  const d = parseDxf(dxfBytesText(bytes));
  const m = new Map<string, number>();
  for (const it of d.items) m.set(it.layer, (m.get(it.layer) ?? 0) + 1);
  return m;
}

describe('lagerkartorna (0.12.1)', () => {
  it('SB11 förenklad: byggdel, presentation och status ur objektet', () => {
    expect(sb11Name(q({ type: 'Wall', exterior: true, loadBearing: true }), false)).toBe('A-27C---E-N');
    expect(sb11Name(q({ type: 'Wall', exterior: true, loadBearing: false }), false)).toBe('A-42A---E-N');
    expect(sb11Name(q({ type: 'Wall', loadBearing: true, status: 'E' }), false)).toBe('A-27B---E-E');
    expect(sb11Name(q({ type: 'Wall', status: 'R' }), false)).toBe('A-43CB--E-R');
    expect(sb11Name(q({ type: 'Door', exterior: true }), false)).toBe('A-42D--CE-N');
    expect(sb11Name(q({ type: 'Window' }), false)).toBe('A-43CC-BE-N');
    expect(sb11Name(q({ type: 'Furniture', fixed: true }), false)).toBe('A-46B--BE-N');
    expect(sb11Name(q({ type: 'Profile', profile: 'B' }), false)).toBe('A-27E---E-N');
    // Allmänna lager har ingen byggdel och ingen status.
    expect(sb11Name(q({ type: 'Wall', part: 'littera' }), false)).toBe('A-------T2-');
    expect(sb11Name(q({ type: 'Dimension' }), false)).toBe('A-------D--');
    expect(sb11Name(q({ part: 'nivå' }), false)).toBe('A-------D3-');
    expect(sb11Name(q({ type: 'Section' }), false)).toBe('A-------J--');
    expect(sb11Name(q({ type: 'Space', part: 'rumstext' }), false)).toBe('A-U-----T1N');
    expect(sb11Name(q({ sheet: true, type: 'Text' }), false)).toBe('A-------F--');
  });

  it('SB11 fullständig: vy-lagren, litteran per byggdel och finare koder', () => {
    const wall = { type: 'Wall', exterior: true, loadBearing: true };
    expect(sb11Name(q({ ...wall, cut: true }), true)).toBe('A-27C---EIN');
    expect(sb11Name(q({ ...wall, part: 'vy' }), true)).toBe('A-27C---EJN');
    expect(sb11Name(q({ ...wall, part: 'över' }), true)).toBe('A-27C---EMN');
    expect(sb11Name(q({ ...wall, dashed: true }), true)).toBe('A-27C---EKN');
    expect(sb11Name(q({ ...wall, part: 'littera' }), true)).toBe('A-27C---T2N');
    // Öppningarna har inga vy-lager.
    expect(sb11Name(q({ type: 'Door', cut: true }), true)).toBe('A-43CC-CE-N');
    expect(sb11Name(q({ type: 'Stair' }), true)).toBe('A-45CA--EJN');
    expect(sb11Name(q({ type: 'Section' }), true)).toBe('A-------J1-');
  });

  it('Enkel har svenska namn med status som tillägg', () => {
    expect(simpleName(q({ type: 'Wall' }))).toBe('A-VÄGG-NY');
    expect(simpleName(q({ type: 'Door', status: 'R' }))).toBe('A-DÖRR-RIV');
    expect(simpleName(q({ type: 'Wall', part: 'littera' }))).toBe('A-LITTERA');
    expect(simpleName(q({ type: 'Tree', status: '-' }))).toBe('A-MARK');
  });

  it('lagrens färger ur kontorets mall, och efter koderna där mallen inte har lagret', () => {
    expect(layerDef('A-27C---E-N')).toMatchObject({ color: 7, lineweight: 50, desc: 'Arkitekt, Stomytterväggar, Beskrivande grafik, Nytt' });
    expect(layerDef('A-43CB--E-R')).toMatchObject({ color: 1, linetype: 'DASHED_2', lineweight: 25 });
    // Inte i mallen: EI blir grön 0,35, rivs röd streckad, och en annan status som mallens N.
    expect(layerDef('A-27C---EIN')).toMatchObject({ color: 3, lineweight: 35 });
    expect(layerDef('A-27F---EJR')).toMatchObject({ color: 1, linetype: 'DASHED_2' });
    expect(layerDef('A-42D--CE--')).toMatchObject({ color: 1, lineweight: 25 });
    expect(layerDef('A-42A---E-N')).toMatchObject({ desc: 'Arkitekt, Ytterväggar, ej bärande, Beskrivande grafik, Nytt' });
  });

  it('pennorna som färger och linjetjocklekar', () => {
    expect([0.13, 0.18, 0.25, 0.35, 0.5, 0.7, 1, 1.4].map(penColor)).toEqual([9, 4, 1, 3, 7, 6, 5, 2]);
    expect(penColor(0.3)).toBe(1);
    expect([0.13, 0.18, 0.25, 0.35, 0.5, 0.7].map(lineweightOf)).toEqual([13, 18, 25, 35, 50, 70]);
  });

  it('en egen lista: närmaste lager med samma byggdel', () => {
    const own = new Map(['A-27C---E-N', 'A-27C---E-E', 'A-43CB--E--', 'A-------T2-'].map((n) => [n, { name: n, color: 1, lineweight: 25 }]));
    expect(nearestLayer('A-27C---E-N', own)).toBe('A-27C---E-N');
    expect(nearestLayer('A-27C---EIN', own)).toBe('A-27C---E-N');
    expect(nearestLayer('A-43CB--E-R', own)).toBe('A-43CB--E--');
    expect(nearestLayer('A-46B--BE-N', own)).toBeNull();
    expect(isSb11List([...own.values()])).toBe(true);
    expect(isSb11List([{ name: 'Väggar', color: 7, lineweight: -3 }])).toBe(false);
  });

  it('inställningarna i stilboken: förvalet utelämnas och trasigt hoppas över', () => {
    expect(normalizeDxfSettings({ map: 'sb11' })).toBeUndefined();
    expect(normalizeDxfSettings({ map: 'nej', allLayers: 'ja' })).toBeUndefined();
    const s = normalizeDxfSettings({ map: 'custom', custom: { name: 'Mall', layers: [{ name: 'A-27C---E-N', color: -7, lineweight: 50, linetype: 'Continuous' }, { name: '' }] } });
    expect(s).toEqual({ map: 'custom', custom: { name: 'Mall', layers: [{ name: 'A-27C---E-N', color: 7, lineweight: 50 }] } });
    // En egen lista som saknas ger förenklad.
    expect(activeMap({ map: 'custom' })).toBe('sb11');
    expect(normalizeExportSettings({ dxf: { map: 'simple' } })).toEqual({ dxf: { map: 'simple' } });
    expect(normalizeOptions({ dxfVersion: 'R2018' })).toEqual({ dxfVersion: 'R2018' });
    expect(optionsOf({}).dxfVersion).toBe('R2000');
  });
});

describe('DXF-filerna (0.12.1)', () => {
  it('en vy i modellens mm: lagren, statusen och väggarna delade per vägg', () => {
    const doc = sampleProject();
    const r = viewDxf(doc, 'vy-a', opt())!;
    const text = dxfBytesText(r.bytes);
    expect(text).toMatch(/\$ACADVER\r\n {2}1\r\nAC1015/);
    expect(text).toMatch(/\$INSUNITS\r\n 70\r\n4/);
    const layers = layersOf(r.bytes);
    // Förslag A mot befintligt: befintliga, nya och rivna innerväggar på var sitt lager.
    for (const l of ['A-27C---E-E', 'A-43CB--E-E', 'A-43CB--E-N', 'A-43CB--E-R', 'A-42D--BE-E', 'A-U-----T1N', 'A-------T2-']) expect(layers.has(l), l).toBe(true);
    // Ingen vägg utan byggdel: den sammanslagna ytan är delad.
    expect([...layers.keys()].some((l) => l.startsWith('A-------E'))).toBe(false);
    // Rumsnamnen med å, ä och ö, och i vyns skala (2,5 mm på papperet är 180 mm versalhöjd i 1:100).
    const d = parseDxf(text);
    const room = d.items.find((i) => i.kind === 'text' && /SOVRUM/.test(i.text));
    expect(room && room.kind === 'text' && room.height).toBeGreaterThan(100);
    expect(d.items.some((i) => i.kind === 'text' && /ö|ä|å|Ö|Ä|Å/.test(i.text))).toBe(true);
    expect(d.mmPerUnit).toBe(1);
  });

  it('2018 skrivs i UTF-8, 2000 i Windows-1252, och båda läses tillbaka lika', () => {
    const doc = sampleProject();
    const a = viewDxf(doc, 'vy-a-bl', opt('R2000'))!;
    const b = viewDxf(doc, 'vy-a-bl', opt('R2018'))!;
    expect(new TextDecoder('latin1').decode(b.bytes)).toContain('AC1032');
    expect(() => new TextDecoder('utf-8', { fatal: true }).decode(b.bytes)).not.toThrow();
    const da = parseDxf(dxfBytesText(a.bytes));
    const db = parseDxf(dxfBytesText(b.bytes));
    expect(db.items.length).toBe(da.items.length);
    expect(db.items.filter((i) => i.kind === 'text').map((i) => (i.kind === 'text' ? i.text : ''))).toEqual(da.items.filter((i) => i.kind === 'text').map((i) => (i.kind === 'text' ? i.text : '')));
  });

  it('skrafferingen blir en HATCH med linjerna i modellens mått, och vitt utelämnas', () => {
    const doc = sampleProject();
    const r = viewDxf(doc, 'vy-a', opt())!;
    const fills = parseDxf(dxfBytesText(r.bytes)).items.filter((i) => i.kind === 'fill');
    expect(fills.length).toBeGreaterThan(0);
    const hatch = fills.find((f) => f.kind === 'fill' && !f.solid);
    // Den nya väggens skraffering: linjerna minst några mm isär i 1:100 (på papperet ca 1 mm).
    expect(hatch && hatch.kind === 'fill' && hatch.lines[0].spacing).toBeGreaterThan(20);
    // Befintliga väggar har vit fyllning (papperet), som inte blir någon yta.
    expect(fills.every((f) => f.kind === 'fill' && f.layer !== 'A-27C---E-E')).toBe(true);
  });

  it('linjerna följer lagret när pennan är lagrets, annars får de egen färg och tjocklek', () => {
    const doc = sampleProject();
    const text = dxfBytesText(viewDxf(doc, 'vy-a-bl', opt())!.bytes);
    // Lagret A-27C---E-E är vitt 0,50; väggens kontur 0,35 får grön och 35.
    expect(text).toMatch(/A-27C---E-E\r\n 62\r\n3\r\n370\r\n35/);
    expect(text).toMatch(/AcAecLayerStandard/);
  });

  it('bärande påverkar lagret: en innervägg kryssad Bärande hamnar på 27B', () => {
    const store = new DocStore(sampleProject());
    const doc = store.doc;
    const inner = Object.values(doc.elements).find((e) => e.type === 'Wall' && e.id === 'iv-1')!;
    store.transact('Bärande', (tx) => tx.putElement({ ...inner, params: { ...inner.params, loadBearing: true } }));
    const layers = layersOf(viewDxf(store.doc, 'vy-a-bl', opt())!.bytes);
    expect([...layers.keys()].some((l) => l.startsWith('A-27B---'))).toBe(true);
  });

  it('SB11 fullständig, Enkel och alla lager i listan', () => {
    const doc = sampleProject();
    const full = { ...doc, graphics: { ...doc.graphics, export: { dxf: { map: 'sb11full' as const } } } };
    const lf = layersOf(viewDxf(full, 'vy-a', opt())!.bytes);
    expect(lf.has('A-27C---EIE')).toBe(true);
    expect(lf.has('A-27C---T2E')).toBe(true);
    const simple = { ...doc, graphics: { ...doc.graphics, export: { dxf: { map: 'simple' as const } } } };
    expect(layersOf(viewDxf(simple, 'vy-a', opt())!.bytes).has('A-VÄGG-BEF')).toBe(true);
    const all = { ...doc, graphics: { ...doc.graphics, export: { dxf: { map: 'sb11full' as const, allLayers: true } } } };
    const r = viewDxf(all, 'vy-a', opt())!;
    expect(r.layers).toBeGreaterThan(250);
  });

  it('en lagerlista läses ur en DXF med beskrivningar, och exporten lägger på närmaste lager', () => {
    const doc = sampleProject();
    const src = writeDxf({
      version: 'R2000',
      layers: [
        { name: 'A-27C---E-N', color: 6, lineweight: 50, desc: 'Ytterväggar, bärande' },
        { name: 'A-43CB--E-N', color: 2, linetype: 'MITT', lineweight: 25 },
        { name: 'A-------T2-', color: 3, lineweight: 35, plot: false },
      ],
      linetypes: [{ name: 'MITT', pattern: [4, 1, 0, 1] }],
      styles: [],
      entities: [],
      ltscale: 1,
    });
    const list = readDxfLayerList(dxfBytesText(src));
    expect(list.layers).toEqual([
      { name: 'A-27C---E-N', color: 6, lineweight: 50, desc: 'Ytterväggar, bärande' },
      { name: 'A-43CB--E-N', color: 2, linetype: 'MITT', lineweight: 25 },
      { name: 'A-------T2-', color: 3, lineweight: 35, plot: false },
    ]);
    expect(list.linetypes).toEqual([{ name: 'MITT', pattern: [4, 1, 0, 1] }]);
    const own = { ...doc, graphics: { ...doc.graphics, export: { dxf: { map: 'custom' as const, custom: { name: 'Mall', ...list } } } } };
    const back = readDxfLayerList(dxfBytesText(viewDxf(own, 'vy-a', opt())!.bytes));
    // Bara listans lager (och 0), med listans färger; det som saknas i listan hamnar på 0.
    expect(back.layers.map((l) => l.name).sort()).toEqual(expect.arrayContaining(['A-27C---E-N', 'A-43CB--E-N', 'A-------T2-']));
    expect(back.layers.every((l) => list.layers.some((x) => x.name === l.name))).toBe(true);
    expect(back.layers.find((l) => l.name === 'A-27C---E-N')!.color).toBe(6);
  });

  it('ett blad i pappers-mm: ramen på blanketten, vyerna på sina lager och stämpeln', () => {
    const store = new DocStore(sampleProject());
    const a = createSheet(store, { name: 'Plan 1', fields: { datum: '2026-11-01' } });
    addViewport(store, a, { view: 'vy-a-bl', scale: 100, at: [150, 150] });
    const r = sheetDxf(store.doc, a, { ...opt(), workStamp: true })!;
    const d = parseDxf(dxfBytesText(r.bytes));
    expect(d.bounds!.maxX).toBeLessThan(900);
    const layers = layersOf(r.bytes);
    expect(layers.has('A-------F--')).toBe(true);
    expect(layers.has('A-27C---E-E')).toBe(true);
    expect(d.items.some((i) => i.kind === 'text' && i.text.startsWith('ARBETSMATERIAL'))).toBe(true);
  });

  it('vyerna blir DXF som förval, bladen PDF; den samlade PDF:en tar bara PDF-bladen', () => {
    const store = new DocStore(sampleProject());
    const a = createSheet(store, { name: 'Plan 1' });
    const b = createSheet(store, { name: 'Fasader' });
    expect(formatsFor('view:vy-a', undefined)).toEqual(['dxf']);
    expect(formatsFor(`sheet:${a}`, undefined)).toEqual(['pdf']);
    const p = planExport(store.doc, [`sheet:${a}`, `sheet:${b}`], { [`sheet:${b}`]: ['dxf'] }, optionsOf({ combined: true, subfolders: true }), TODAY);
    expect(p.jobs.map((j) => j.path)).toEqual(['PDF/A-101.pdf', 'DXF/A-102.dxf']);
  });
});
