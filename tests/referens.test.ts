import { beforeAll, describe, expect, it } from 'vitest';
import type { FillDef } from '../src/core/graphics';
import type { ProjectDoc } from '../src/core/model';
import { modelViewId } from '../src/core/model';
import { DocStore } from '../src/core/store';
import { addViewport, createSheet } from '../src/core/sheets';
import { registerBuiltInTypes } from '../src/elements';
import { buildModel3d } from '../src/repr/model3d';
import { buildPlan } from '../src/repr/plan';
import type { Primitive, Vec2 } from '../src/repr/primitives';
import { buildSection } from '../src/repr/section';
import { buildSheet, centeredAt } from '../src/repr/sheet';
import type { Shape3D } from '../src/repr/solids';
import { sampleProject } from '../src/sample/sampleProject';
import { finishedTerrain, wallCrest } from '../src/elements/ground';
import { buildingHeight } from '../src/repr/buildingHeight';
import { meanGround } from '../src/repr/terrain';
import { groundProject, planCtx, roomGrid, shapesProject, twoStoreys } from './projekt';

/**
 * Referensritningar (0.8.2). Några testprojekt ritas (planer, fasader,
 * sektioner, 3D och ett blad) och jämförs mot facit i `tests/referens/`, en
 * rad per ritad sak. Ändras en ritning syns det som en skillnad i facit:
 *
 *   npx vitest run tests/referens.test.ts        jämför
 *   npx vitest run tests/referens.test.ts -u     skriv nytt facit (efter en avsiktlig ändring)
 *
 * Läs skillnaden i git innan nytt facit läggs in; den visar vad som ändrats.
 * Koordinaterna avrundas till 0,1 mm, så att små skillnader i flyttal inte syns.
 */

beforeAll(() => registerBuiltInTypes());

const n = (x: number): string => {
  const r = Math.round(x * 10) / 10;
  return String(Object.is(r, -0) ? 0 : r);
};
const pt = (p: Vec2): string => `${n(p[0])},${n(p[1])}`;
const pen = (p: { weight: number; color?: string; dash?: readonly number[]; opacity?: number } | null | undefined): string =>
  p ? [`w${p.weight}`, p.color, p.dash?.length ? `d${p.dash.join('/')}` : '', p.opacity !== undefined && p.opacity !== 1 ? `o${p.opacity}` : ''].filter(Boolean).join(' ') : 'ingen';

/** Fyllningen: slag, färg, mönster och opacitet (0.8.32: mönster, opacitet och bakgrund). */
const fillOf = (f: FillDef): string => {
  if (f.kind === 'none') return 'none';
  const o = f.opacity !== undefined && f.opacity !== 1 ? ` o${f.opacity}` : '';
  if (f.kind === 'solid') return `fylld ${f.color ?? ''}${o}`;
  const bg = f.background ? ` bakgrund ${f.background}${f.backgroundOpacity !== undefined && f.backgroundOpacity !== 1 ? ` o${f.backgroundOpacity}` : ''}` : '';
  if (f.kind === 'type') return `typ ${f.type}`;
  if (f.kind === 'pattern') return `mönster ${f.color} ${f.lines.map((l) => `${n(l.angle)}° a${n(l.spacing)}${l.shift ? ` f${n(l.shift)}` : ''}${l.dash ? ` d${l.dash.map(n).join('/')}` : ''}${l.phase ? ` p${l.phase.map(n).join('/')}` : ''}`).join(' + ')} w${f.weight}${o}${bg}`;
  return `hatch ${f.color} ${n(f.angle)}° a${n(f.spacing)} w${f.weight}${o}${bg}`;
};

/** En rad per primitiv: slag, geometri, penna och vems den är. */
export function primLine(p: Primitive): string {
  const who = `${p.origin ? ` @${p.origin.objectId ?? ''}${p.origin.part ? `/${p.origin.part}` : ''}` : ''}${p.under ? ' under' : ''}`;
  switch (p.kind) {
    case 'line':
      return `linje ${pt(p.a)} ${pt(p.b)} [${pen(p.pen)}]${who}`;
    case 'polyline':
      return `polylinje${p.closed ? ' sluten' : ''} ${p.points.map(pt).join(' ')} [${pen(p.pen)}]${p.dashFrom ? ` från ${n(p.dashFrom.at)}` : ''}${who}`;
    case 'arc':
      return `båge ${pt(p.center)} r${n(p.radius)} ${n((p.start * 180) / Math.PI)}°–${n((p.end * 180) / Math.PI)}° [${pen(p.pen)}]${who}`;
    case 'text':
      return `text "${p.text}" ${pt(p.at)} h${n(p.height)}${p.angle ? ` ${n((p.angle * 180) / Math.PI)}°` : ''}${p.align ? ` ${p.align}` : ''}${p.bold ? ' fet' : ''} [${pen(p.pen)}]${who}`;
    case 'region':
      return `yta ${fillOf(p.fill)} [${pen(p.outline)}] ${p.rings.map((r) => r.map(pt).join(' ')).join(' | ')}${who}`;
    case 'image':
      return `bild ${p.source.asset} ${pt(p.corner)} ${pt(p.u)} ${pt(p.v)}${who}`;
  }
}

const drawing = (prims: readonly Primitive[]): string => `${prims.map(primLine).join('\n')}\n`;

/** 3D-formerna: vad, material och höjd, och formen i plan. */
function model(shapes: readonly Shape3D[]): string {
  return `${shapes
    .map((s) =>
      s.kind === 'edges'
        ? `kanter @${s.id} ${s.part ?? ''} ${s.segments.length}`
        : `form @${s.id} ${s.material} z${n(s.z0)}–${n(s.z1)}${s.top || s.bottom ? ' sned' : ''}${s.cuts ? ` urtag ${s.cuts.length}` : ''} ${s.rings.map((r) => r.map(pt).join(' ')).join(' | ')}`,
    )
    .join('\n')}\n`;
}

const file = (name: string) => `./referens/${name}.txt`;

function referenceSet(name: string, doc: ProjectDoc, storey = doc.storeys[0].id) {
  const ex = doc.states.find((s) => s.kind === 'existing');
  const proposal = doc.states.find((s) => s.kind !== 'existing')!;
  const compare = { state: proposal.id, compareTo: ex?.id };
  const markers = Object.values(doc.elements)
    .filter((e) => e.type === 'Elevation' || e.type === 'Section')
    .map((e) => e.id)
    .sort();

  describe(name, () => {
    it('plan, förslaget jämfört med befintligt', async () => {
      await expect(drawing(buildPlan(doc, storey, compare).prims)).toMatchFileSnapshot(file(`${name}-plan`));
    });
    if (ex) {
      it('plan, befintligt', async () => {
        await expect(drawing(buildPlan(doc, storey, { state: ex.id }).prims)).toMatchFileSnapshot(file(`${name}-plan-befintligt`));
      });
    }
    for (const id of markers) {
      it(`${doc.elements[id].type === 'Section' ? 'sektion' : 'fasad'} ${id}`, async () => {
        await expect(drawing(buildSection(doc, id, compare)!.prims)).toMatchFileSnapshot(file(`${name}-${id}`));
      });
    }
    it('3D', async () => {
      await expect(model(buildModel3d(doc, compare))).toMatchFileSnapshot(file(`${name}-3d`));
    });
  });
}

referenceSet('exempel', sampleProject());
referenceSet('rumsrutnat', roomGrid(3));
referenceSet('former', shapesProject());
// Marken ritas på Platsen (0.10.25).
referenceSet('mark', groundProject(), 'platsen');

/**
 * Den färdiga marken som siffror (0.10.6): höjderna (mm från ±0) i rutorna
 * som markobjekten ändrat, schakt och fyll per objekt, medelmarknivån,
 * byggnadshöjden och stödmurens krön och fot.
 */
it('mark: den färdiga marken, volymerna och höjderna', async () => {
  const store = new DocStore(groundProject());
  const ctx = planCtx(store);
  const f = finishedTerrain(ctx)!;
  const { W } = f.terrain.grid;
  const datum = store.doc.site!.datum;
  const ch = f.changed!;
  const rows = [`ändrat i ${ch.i0}–${ch.i1}, ${ch.j0}–${ch.j1}; ${n(f.min * 1000)}–${n(f.max * 1000)}`];
  for (let j = ch.j0; j <= ch.j1; j++) {
    const row: string[] = [];
    for (let i = ch.i0; i <= ch.i1; i++) row.push(n((f.z[j * W + i] - datum) * 1000));
    rows.push(row.join(' '));
  }
  for (const [id, v] of f.volumes) rows.push(`${id} schakt ${v.cut.toFixed(2)} fyll ${v.fill.toFixed(2)}`);
  const bh = buildingHeight(ctx)!;
  const crest = wallCrest(ctx, store.doc.elements['m-stod'])!;
  rows.push(`medelmarknivå ${n(meanGround(ctx)!)}, befintlig ${n(meanGround(ctx, true)!)}`);
  rows.push(`byggnadshöjd ${n(bh.height!)}, fasaden ${pt(bh.main.a)} ${pt(bh.main.b)}`);
  rows.push(`stödmuren ${n(crest.top)}–${n(crest.bottom)}`);
  await expect(`${rows.join('\n')}\n`).toMatchFileSnapshot(file('mark-siffror'));
});

/** Detaljnivåerna (0.8.37, i referensritningarna sedan 0.8.38): littera, 2D-symboler och 3D var för sig. */
describe('detaljnivåer', () => {
  const doc = sampleProject();
  const storey = doc.storeys[0].id;
  const ex = doc.states.find((s) => s.kind === 'existing')!;
  const proposal = doc.states.find((s) => s.kind !== 'existing')!;
  const compare = { state: proposal.id, compareTo: ex.id };
  it('plan: skiss med littera i detalj', async () => {
    await expect(drawing(buildPlan(doc, storey, { ...compare, detail: 'sketch', labelDetail: 'detail' }).prims)).toMatchFileSnapshot(file('nivaer-plan-skiss'));
  });
  it('plan: detalj med littera i skiss', async () => {
    await expect(drawing(buildPlan(doc, storey, { ...compare, detail: 'detail', labelDetail: 'sketch', modelDetail: 'sketch' }).prims)).toMatchFileSnapshot(file('nivaer-plan-detalj'));
  });
  it('3D och fasad i detalj, planen i skiss', async () => {
    const view = { ...compare, detail: 'sketch' as const, modelDetail: 'detail' as const };
    await expect(model(buildModel3d(doc, view))).toMatchFileSnapshot(file('nivaer-3d-detalj'));
    await expect(drawing(buildSection(doc, 'fasad-1', view)!.prims)).toMatchFileSnapshot(file('nivaer-fasad-1-detalj'));
  });
});

/**
 * Två våningar (0.9–0.9.2, i referensritningarna sedan 0.9.3): plan 2 med
 * håltagningen, sektionen med nivåer och höjdmått, en fasad och 3D, också
 * med bara plan 1 (väggarna kapas av bjälklaget ovanför).
 */
describe('två våningar', () => {
  const doc = twoStoreys();
  const ex = doc.states.find((s) => s.kind === 'existing')!;
  const proposal = doc.states.find((s) => s.kind !== 'existing')!;
  const compare = { state: proposal.id, compareTo: ex.id };
  it('plan 2', async () => {
    await expect(drawing(buildPlan(doc, 'pl-2', compare).prims)).toMatchFileSnapshot(file('tva-plan-2'));
  });
  for (const id of ['sektion-a', 'fasad-1']) {
    it(id, async () => {
      await expect(drawing(buildSection(doc, id, compare)!.prims)).toMatchFileSnapshot(file(`tva-${id}`));
    });
  }
  it('3D, alla våningar och bara plan 1', async () => {
    await expect(model(buildModel3d(doc, compare))).toMatchFileSnapshot(file('tva-3d'));
    await expect(model(buildModel3d(doc, compare, 'pl-1'))).toMatchFileSnapshot(file('tva-3d-plan-1'));
  });
});

describe('blad', () => {
  it('A3 med plan i 1:100 och fasad i 1:50, med exempelmallbladet', async () => {
    const store = new DocStore(sampleProject());
    const id = createSheet(store, { number: 'A-40.1-101', name: 'Plan och fasad', fields: { datum: '2026-10-20' } });
    addViewport(store, id, { view: 'vy-a-bl', scale: 100, at: centeredAt(store.doc, 'vy-a-bl', 100, [150, 160]) });
    addViewport(store, id, { view: modelViewId('fasad-1'), scale: 50, at: centeredAt(store.doc, modelViewId('fasad-1'), 50, [300, 200]) });
    const d = buildSheet(store.doc, store.doc.sheets.find((s) => s.id === id)!, { today: '2026-10-20' });
    await expect(drawing(d.prims)).toMatchFileSnapshot(file('blad-a3'));
  });

  it('A3 med 2D-formerna och de egna pennorna i 1:50 (0.8.32)', async () => {
    const store = new DocStore(shapesProject());
    const id = createSheet(store, { number: 'A-40.1-102', name: 'Former', fields: { datum: '2026-10-25' } });
    addViewport(store, id, { view: modelViewId('pl-1'), scale: 50, at: [200, 150] });
    const d = buildSheet(store.doc, store.doc.sheets.find((s) => s.id === id)!, { today: '2026-10-25' });
    await expect(drawing(d.prims)).toMatchFileSnapshot(file('blad-former'));
  });
});
