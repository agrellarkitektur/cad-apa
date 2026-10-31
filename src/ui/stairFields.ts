import type { Element, Id, ProjectDoc } from '../core/model';
import type { DocStore } from '../core/store';
import { geometryOfStair, stairHoleIn, stairParams, storeyAbove } from '../elements/stair';
import { railingsOnStair } from '../elements/railing';
import { stairHandrailWarning } from '../elements/railingWarnings';
import { addRailingsOnStair } from './railingFields';
import { minGoing, spiralDims, RISER_TARGET, stairWarnings, STAIR_THICKNESS, TREAD_LENGTH, WALK_LINE, HEADROOM, type StairParams } from '../elements/stairGeometry';
import { STRAIGHT } from '../geometry/arc';
import { levelOf } from '../repr/solids';
import { resolveParams } from '../elements/registry';
import { escapeHtml } from './labels';
import { numberField } from './fieldMarkup';
import { BUILT, builtDims } from '../elements/stairBuilt';

/**
 * Trappans fält i egenskaperna (0.11): bredd, stigning, steg, gånglinje,
 * början och slut, svängar och vilplan, uppbyggnad och hålet. Varningarna
 * (praxis och BFS 2024:9, 2 kap. 12 § för ledstången) står överst; de spärrar
 * aldrig.
 */

const mm = (v: number) => Math.round(v).toLocaleString('sv-SE');

function select(key: string, label: string, value: string, options: [string, string][], disabled: string[] = []): string {
  return `<label class="field"><span>${label}</span><select data-key="${key}">${options.map(([v, l]) => `<option value="${v}"${v === value ? ' selected' : ''}${disabled.includes(v) ? ' disabled' : ''}>${escapeHtml(l)}</option>`).join('')}</select></label>`;
}

export function stairFieldsMarkup(doc: ProjectDoc, el: Element): string {
  const p = stairParams(doc, el);
  const g = geometryOfStair(p);
  const own = typeof el.params.rise === 'number';
  const above = storeyAbove(doc, el.storey);
  const warnings = g ? stairWarnings(p, g) : ['Referenslinjen är för kort för en trappa.'];
  // Ledstången på båda sidor (0.11.1, BFS 2024:9, 2 kap. 12 §): kan kvitteras.
  const handrail = g ? stairHandrailWarning(doc, el) : null;
  const acked = ((el.params.ack as string[] | undefined) ?? []).includes('handrails');
  const warn =
    warnings.length || handrail
      ? `<div class="stair-warnings" role="note">${warnings.map((w) => `<p class="skew-note"><b>!</b> ${escapeHtml(w)}</p>`).join('')}${handrail ? `<p class="skew-note"><b>!</b> ${escapeHtml(handrail)} <button class="btn btn-small" data-action="stair-ack" data-value="1">Kvittera</button></p>` : ''}</div>`
      : '';
  const on = railingsOnStair(doc, el.id);
  const railRow = `<div class="field-label">Räcken</div>
    <div class="row wrap"><button class="btn" data-action="stair-railing" data-side="left"${on.left.length ? ' disabled' : ''}>Vänster sida</button><button class="btn" data-action="stair-railing" data-side="right"${on.right.length ? ' disabled' : ''}>Höger sida</button><button class="btn" data-action="stair-railing" data-side="both"${on.left.length && on.right.length ? ' disabled' : ''}>Båda sidor</button></div>
    <p class="note">${on.left.length || on.right.length ? `Räcke på ${[on.left.length ? 'vänster' : '', on.right.length ? 'höger' : ''].filter(Boolean).join(' och ')} sida (sett uppåt).` : 'Inga räcken än.'} Räckena följer trappans kant; typen och höjderna ändras i räckets egenskaper.${acked ? ' Varningen för ledstång på båda sidor är kvitterad. <button class="btn btn-small" data-action="stair-ack" data-value="0">Ångra kvitteringen</button>' : ''}</p>`;
  const h = g?.riserHeight ?? 0;
  const going = g ? minGoing(g) : 0;
  const summary = g
    ? `${p.spiral ? 'Spiraltrappa, ' : ''}${g.risers.length} sättsteg à ${h.toLocaleString('sv-SE', { maximumFractionDigits: 1 })} mm, stegdjup ${mm(going)} mm i gånglinjen (2 × steghöjd + stegdjup = ${mm(2 * h + going)} mm)${g.landings.length ? `, ${g.landings.length === 1 ? 'ett vilplan' : `${g.landings.length} vilplan`}` : ''}.`
    : '';
  // Svängarna och sträckorna i referenslinjen.
  const line = (p.line ?? []) as [number, number][];
  const landings = new Set(p.landings ?? []);
  const turns = new Set(p.turnLandings ?? []);
  const rows: string[] = [];
  for (let i = 0; i < line.length - 1; i++) {
    rows.push(`<li><span>Sträcka ${i + 1}</span><div class="segmented" role="group"><button data-action="stair-edge" data-index="${i}" data-value="0" aria-pressed="${!landings.has(i)}">Steg</button><button data-action="stair-edge" data-index="${i}" data-value="1" aria-pressed="${landings.has(i)}" title="Vilplan härifrån: hela sträckan är plan, med svängarna i dess ändar">Vilplan</button></div></li>`);
    if (i + 1 < line.length - 1) {
      const arcSide = Math.abs(Number(p.bulges?.[i]) || 0) >= STRAIGHT || Math.abs(Number(p.bulges?.[i + 1]) || 0) >= STRAIGHT;
      const flatBy = landings.has(i) || landings.has(i + 1);
      rows.push(`<li><span>Sväng ${i + 1}</span><div class="segmented" role="group"${flatBy ? ' title="Vilplan, eftersom en sträcka intill är det"' : ''}><button data-action="stair-turn" data-index="${i + 1}" data-value="0" aria-pressed="${!turns.has(i + 1) && !flatBy}"${flatBy ? ' disabled' : ''}>Kilsteg</button><button data-action="stair-turn" data-index="${i + 1}" data-value="1" aria-pressed="${turns.has(i + 1) || flatBy}"${flatBy ? ' disabled' : ''}>Vilplan</button></div>${arcSide ? '' : ''}</li>`);
    }
  }
  // Spiraltrappan (0.11.5): diametrarna, graderna och varvriktningen i stället för bredden och linjen.
  const sp = p.spiral ? spiralDims(p.spiral) : null;
  const shape = sp
    ? `<div class="field-label">Spiraltrappa</div>
    <div class="fields">${numberField('stair:inner', 'Innerdiameter', sp.inner, 'mm')}${numberField('stair:outer', 'Ytterdiameter', sp.outer, 'mm')}${numberField('stair:sweep', 'Grader', sp.sweep, '°')}</div>
    ${select('stair:dir', 'Uppåt', sp.ccw ? 'ccw' : 'cw', [['ccw', 'Moturs'], ['cw', 'Medurs']])}
    <p class="note">Bredden är ${mm((sp.outer - sp.inner) / 2)} mm (halva skillnaden mellan diametrarna)${sp.inner >= 50 ? ', och mittpelaren har innerdiametern' : ''}. Dra i mitten för att flytta trappan och i startpunkten för att vrida den.</p>`
    : '';
  const holeNote = above ? `i bjälklaget på ${escapeHtml(above.name)}` : 'i bjälklaget ovanför (det finns ingen våning ovanför)';
  return `${warn}
    ${shape}
    <div class="fields">${sp ? '' : numberField('stair:width', 'Bredd', p.width, 'mm')}${numberField('stair:rise', 'Stigning', p.rise, 'mm')}${numberField('stair:risers', 'Antal sättsteg', g?.risers.length ?? 0, 'st')}${numberField('stair:riserHeight', 'Steghöjd', h, 'mm', 1)}${numberField('stair:going', 'Stegdjup', going, 'mm')}${numberField('level:level', 'Fot mot våningen', levelOf(p), 'mm')}</div>
    <label class="check" title="Stigningen följer våningshöjden, så att trappan går till golvet ovanför"><input type="checkbox" data-key="stair:toStorey"${own ? '' : ' checked'}> Till våningen ovanför</label>
    <p class="note">${escapeHtml(summary)} Ändras stegdjupet ${p.spiral ? 'ändras graderna' : 'förlängs eller kortas trappans sista sträcka'}; antal sättsteg och steghöjden följer varandra (förval ${RISER_TARGET} mm).</p>
    <div class="fields">${numberField('stair:walkLine', 'Gånglinjen', p.walkLine ?? WALK_LINE, 'mm')}</div>
    ${select('stair:walkSide', 'Gånglinjen från', p.walkSide ?? '', [['', 'Utsidan (svängarnas)'], ['left', 'Vänster sida'], ['right', 'Höger sida']])}
    ${sp ? '' : select('stair:refSide', 'Referenslinjen', p.refSide ?? 'center', [['left', 'Vänster kant'], ['center', 'Mitten'], ['right', 'Höger kant']])}
    <div class="fields">${select('stair:start', 'Början', p.start ?? 'riser', [['riser', 'Sättsteg'], ['tread', 'Plansteg']])}${p.start === 'tread' ? numberField('stair:startTread', 'Första plansteget', p.startTread ?? TREAD_LENGTH, 'mm') : ''}</div>
    <div class="fields">${select('stair:end', 'Slut', p.end ?? 'riser', [['riser', 'Sättsteg'], ['tread', 'Plansteg']])}${p.end === 'tread' ? numberField('stair:endTread', 'Sista plansteget', p.endTread ?? TREAD_LENGTH, 'mm') : ''}</div>
    ${railRow}
    ${sp ? '' : `<div class="field-label">Sträckor och svängar</div>
    <ul class="stair-turns">${rows.join('')}</ul>`}
    <div class="fields">${select('stair:build', 'Uppbyggnad', p.build ?? 'monolithic', [['monolithic', 'Monolitisk'], ['built', 'Byggd']])}${p.build === 'built' ? '' : numberField('stair:thickness', 'Tjocklek', p.thickness ?? STAIR_THICKNESS, 'mm')}</div>
    ${p.build === 'built' ? builtFields(doc, p) : ''}
    <div class="fields">${select('stair:contrast', 'Kontrastmarkering', p.contrast ?? 'none', [['none', 'Ingen'], ['ends', 'Första och sista'], ['all', 'Alla steg']])}${p.contrast && p.contrast !== 'none' ? numberField('stair:contrastWidth', 'Bredd', p.contrastWidth ?? BUILT.contrastWidth, 'mm') : ''}</div>
    ${select('stair:hole', 'Hålet', p.hole ?? 'auto', [['auto', 'Automatiskt'], ['none', 'Inget']])}
    <div class="fields">${numberField('stair:headroom', 'Fri höjd', p.headroom ?? HEADROOM, 'mm')}</div>
    <div class="row"><button class="btn" data-action="stair-own-hole" title="Hålet blir en vanlig håltagning i bjälklaget, som ritas om med bjälklagets grepp; trappan tar då inget eget">Gör till eget hål</button></div>
    <p class="note">Hålet ${holeNote} följer trappan och räknas ur den fria höjden över stegen${sp ? '; går det ett helt varv blir det runt, med ytterdiametern' : ''}.${sp ? '' : ' Referenslinjen går i gångriktningen, uppåt; dra i punkterna för att ändra den, eller böj en kant till en båge i Modifiera.'}</p>`;
}

/** Den byggda trappans delar: vangstycken, plansteg och sättsteg med mått och material (0.11.4). */
function builtFields(doc: ProjectDoc, p: StairParams): string {
  const d = builtDims(p);
  const materials = (doc.graphics.materials ?? []).filter((x) => x.building);
  const mat = (key: string, value: string | undefined, none: string) =>
    `<label class="field"><span>Material</span><select data-key="stair:${key}"><option value="">${none}</option>${materials.map((x) => `<option value="${escapeHtml(x.id)}"${x.id === value ? ' selected' : ''}>${escapeHtml(x.name)}</option>`).join('')}</select></label>`;
  return `<div class="field-label">Vangstycken</div>
    <div class="fields">${select('stair:stringerSides', 'Sidor', d.sides, [['both', 'Båda'], ['left', 'Vänster'], ['right', 'Höger'], ['none', 'Inga']])}${numberField('stair:stringerWidth', 'Bredd', d.stringerWidth, 'mm')}${numberField('stair:stringerHeight', 'Höjd', d.stringerHeight, 'mm')}${mat('stringerMaterial', d.stringerMaterial, 'Målat')}</div>
    <div class="field-label">Plansteg</div>
    <div class="fields">${numberField('stair:treadThickness', 'Tjocklek', d.treadThickness, 'mm')}${numberField('stair:nosing', 'Stegnos', d.nosing, 'mm')}${mat('treadMaterial', d.treadMaterial, 'Trä')}</div>
    <div class="field-label">Sättsteg</div>
    <div class="fields">${numberField('stair:riserThickness', 'Tjocklek', d.riserThickness, 'mm')}${mat('riserMaterial', d.riserMaterial, 'Målat')}</div>
    <p class="note">Vangstyckena står innanför trappans bredd, med överkanten ${BUILT.stringerAbove} mm över stegnoslinjen; höjden mäts lodrätt. Sättsteg 0 mm ger en öppen trappa (utan stegnos). I planen syns vangstyckenas insida i Normal och Detalj, och stegnosen, kontrastmarkeringen och stegens nummer i Detalj.</p>`;
}

/** Patch där undefined tar bort nyckeln (så att förvalet och våningens värde gäller). */
function patchStair(store: DocStore, ids: Id[], label: string, fn: (p: StairParams, el: Element) => Record<string, unknown> | null): boolean {
  const doc = store.doc;
  const patches: [Id, Record<string, unknown>][] = [];
  for (const id of ids) {
    const el = doc.elements[id];
    if (el?.type !== 'Stair') continue;
    const patch = fn(stairParams(doc, el), el);
    if (!patch) return false;
    patches.push([id, patch]);
  }
  store.transact(label, (tx) => {
    for (const [id, patch] of patches) {
      const el = tx.doc.elements[id];
      if (!el) continue;
      const params: Record<string, unknown> = { ...el.params };
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) delete params[k];
        else params[k] = v;
      }
      tx.putElement({ ...el, params });
    }
  });
  return true;
}

/** Ett ändrat fält med nyckeln `stair:namn`. Ger false när värdet inte gick att använda. */
export function applyStairField(store: DocStore, ids: Id[], name: string, input: HTMLInputElement | HTMLSelectElement): boolean {
  const raw = input.value;
  const num = Number(raw.replace(',', '.').replace('−', '-'));
  const pos = (min: number) => Number.isFinite(num) && num >= min;
  switch (name) {
    case 'inner':
    case 'outer':
    case 'sweep':
      return pos(0) && patchStair(store, ids, name === 'sweep' ? 'Spiraltrappans grader' : 'Spiraltrappans diameter', (p) => spiralPatch(p, { [name]: Math.round(num) }));
    case 'dir':
      return patchStair(store, ids, 'Varvriktning', (p) => spiralPatch(p, { dir: raw === 'cw' ? 'cw' : undefined }));
    case 'width':
      return pos(300) && patchStair(store, ids, 'Trappans bredd', () => ({ width: Math.round(num) }));
    case 'rise':
      return pos(100) && patchStair(store, ids, 'Trappans stigning', () => ({ rise: Math.round(num) }));
    case 'toStorey': {
      const on = (input as HTMLInputElement).checked;
      return patchStair(store, ids, on ? 'Till våningen ovanför' : 'Egen stigning', (p) => ({ rise: on ? undefined : Math.round(p.rise) }));
    }
    case 'risers':
      return pos(2) && patchStair(store, ids, 'Antal sättsteg', () => ({ risers: Math.round(num) }));
    case 'riserHeight':
      return pos(50) && patchStair(store, ids, 'Steghöjd', (p) => ({ risers: Math.max(2, Math.round(p.rise / num)) }));
    case 'going':
      return pos(100) && patchStair(store, ids, 'Stegdjup', (p) => goingPatch(p, num));
    case 'walkLine':
      return pos(0) && patchStair(store, ids, 'Gånglinjen', () => ({ walkLine: Math.round(num) === WALK_LINE ? undefined : Math.round(num) }));
    case 'walkSide':
      return patchStair(store, ids, 'Gånglinjens sida', () => ({ walkSide: raw === 'left' || raw === 'right' ? raw : undefined }));
    case 'refSide':
      return patchStair(store, ids, 'Referenslinjen', () => ({ refSide: raw === 'left' || raw === 'right' ? raw : undefined }));
    case 'start':
      return patchStair(store, ids, 'Trappans början', () => ({ start: raw === 'tread' ? 'tread' : undefined }));
    case 'end':
      return patchStair(store, ids, 'Trappans slut', () => ({ end: raw === 'tread' ? 'tread' : undefined }));
    case 'startTread':
      return pos(50) && patchStair(store, ids, 'Första plansteget', () => ({ startTread: Math.round(num) }));
    case 'endTread':
      return pos(50) && patchStair(store, ids, 'Sista plansteget', () => ({ endTread: Math.round(num) }));
    case 'build':
      return patchStair(store, ids, 'Uppbyggnad', () => ({ build: raw === 'built' ? 'built' : undefined }));
    case 'stringerSides':
      return patchStair(store, ids, 'Vangstycken', (p) => builtPatch(p, 'stringer', 'sides', raw === 'both' ? undefined : raw));
    case 'stringerWidth':
      return pos(10) && patchStair(store, ids, 'Vangstyckenas bredd', (p) => builtPatch(p, 'stringer', 'width', Math.round(num) === BUILT.stringerWidth ? undefined : Math.round(num)));
    case 'stringerHeight':
      return pos(50) && patchStair(store, ids, 'Vangstyckenas höjd', (p) => builtPatch(p, 'stringer', 'height', Math.round(num) === BUILT.stringerHeight ? undefined : Math.round(num)));
    case 'stringerMaterial':
      return patchStair(store, ids, 'Vangstyckenas material', (p) => builtPatch(p, 'stringer', 'material', raw || undefined));
    case 'treadThickness':
      return pos(10) && patchStair(store, ids, 'Planstegens tjocklek', (p) => builtPatch(p, 'tread', 'thickness', Math.round(num) === BUILT.treadThickness ? undefined : Math.round(num)));
    case 'nosing':
      return pos(0) && patchStair(store, ids, 'Stegnos', (p) => builtPatch(p, 'tread', 'nosing', Math.round(num) === BUILT.nosing ? undefined : Math.round(num)));
    case 'treadMaterial':
      return patchStair(store, ids, 'Planstegens material', (p) => builtPatch(p, 'tread', 'material', raw || undefined));
    case 'riserThickness':
      return pos(0) && patchStair(store, ids, 'Sättstegens tjocklek', (p) => builtPatch(p, 'riser', 'thickness', Math.round(num) === BUILT.riserThickness ? undefined : Math.round(num)));
    case 'riserMaterial':
      return patchStair(store, ids, 'Sättstegens material', (p) => builtPatch(p, 'riser', 'material', raw || undefined));
    case 'contrast':
      return patchStair(store, ids, 'Kontrastmarkering', () => ({ contrast: raw === 'ends' || raw === 'all' ? raw : undefined }));
    case 'contrastWidth':
      return pos(10) && patchStair(store, ids, 'Kontrastmarkeringens bredd', () => ({ contrastWidth: Math.round(num) === BUILT.contrastWidth ? undefined : Math.round(num) }));
    case 'thickness':
      return pos(20) && patchStair(store, ids, 'Trappans tjocklek', () => ({ thickness: Math.round(num) === STAIR_THICKNESS ? undefined : Math.round(num) }));
    case 'hole':
      return patchStair(store, ids, raw === 'none' ? 'Inget hål' : 'Automatiskt hål', () => ({ hole: raw === 'none' ? 'none' : undefined }));
    case 'headroom':
      return pos(1000) && patchStair(store, ids, 'Fri höjd för hålet', () => ({ headroom: Math.round(num) === HEADROOM ? undefined : Math.round(num) }));
  }
  return false;
}

/** Ett fält i en av den byggda trappans delar; tomma delar och en tom `built` tas bort. */
function builtPatch(p: StairParams, part: 'stringer' | 'tread' | 'riser', key: string, value: unknown): Record<string, unknown> {
  const built: Record<string, Record<string, unknown>> = JSON.parse(JSON.stringify(p.built ?? {}));
  const q = { ...(built[part] ?? {}) };
  if (value === undefined) delete q[key];
  else q[key] = value;
  if (Object.keys(q).length) built[part] = q;
  else delete built[part];
  return { built: Object.keys(built).length ? built : undefined };
}

/** Spiraltrappans mått (0.11.5), rimliga, med bredden som följer diametrarna. Null för andra trappor. */
function spiralPatch(p: StairParams, change: Record<string, unknown>): Record<string, unknown> | null {
  if (!p.spiral) return null;
  const merged = { ...p.spiral, ...change };
  if (change.inner !== undefined && Number(change.inner) > merged.outer - 300) merged.outer = Number(change.inner) + 300;
  const d = spiralDims(merged);
  return { spiral: { inner: d.inner, outer: d.outer, sweep: d.sweep, ...(d.ccw ? {} : { dir: 'cw' }) }, width: Math.round((d.outer - d.inner) / 2) };
}

/**
 * Stegdjupet: den sista sträckan förlängs eller kortas så att det sista
 * loppets steg får djupet (när den är rak). Annars null.
 */
function goingPatch(p: StairParams, going: number): Record<string, unknown> | null {
  const g = geometryOfStair(p);
  // Spiraltrappan (0.11.5): graderna ändras så att loppets steg får djupet.
  if (p.spiral && g?.turn && g.runs.length) {
    const run = g.runs[g.runs.length - 1];
    const L = g.length + (going - run.going) * run.treads;
    return spiralPatch(p, { sweep: Math.round((L / g.turn) * 360) });
  }
  const line = (p.line ?? []) as [number, number][];
  const n = line.length;
  if (!g || n < 2 || !g.runs.length) return null;
  if (Math.abs(Number(p.bulges?.[n - 2]) || 0) >= STRAIGHT) return null;
  const run = g.runs[g.runs.length - 1];
  const delta = (going - run.going) * run.treads;
  const a = line[n - 2];
  const b = line[n - 1];
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (l + delta < 100) return null;
  const k = (l + delta) / l;
  const end: [number, number] = [Math.round(a[0] + (b[0] - a[0]) * k), Math.round(a[1] + (b[1] - a[1]) * k)];
  return { line: [...line.slice(0, -1), end] };
}

/** Knapparna: kilsteg eller vilplan i en sväng, steg eller vilplan på en sträcka, och hålet som eget. */
export function stairAction(store: DocStore, ids: Id[], action: string, b: HTMLElement): boolean {
  const i = Number(b.dataset.index);
  const on = b.dataset.value === '1';
  if (action === 'stair-turn' || action === 'stair-edge') {
    const key = action === 'stair-turn' ? 'turnLandings' : 'landings';
    return patchStair(store, ids, on ? 'Vilplan' : action === 'stair-turn' ? 'Kilsteg' : 'Steg', (p) => {
      const set = new Set(p[key] ?? []);
      if (on) set.add(i);
      else set.delete(i);
      const list = [...set].sort((x, y) => x - y);
      return { [key]: list.length ? list : undefined };
    });
  }
  if (action === 'stair-ack') {
    const on = b.dataset.value === '1';
    return patchStair(store, ids, on ? 'Kvittera ledstången' : 'Ångra kvitteringen', (_, el) => {
      const set = new Set((el.params.ack as string[] | undefined) ?? []);
      if (on) set.add('handrails');
      else set.delete('handrails');
      return { ack: set.size ? [...set] : undefined };
    });
  }
  if (action === 'stair-railing') {
    const side = b.dataset.side as 'left' | 'right' | 'both';
    return addRailingsOnStair(store, ids[0], side === 'both' ? ['left', 'right'] : [side]).length > 0;
  }
  if (action === 'stair-own-hole') {
    const doc = store.doc;
    const el = doc.elements[ids[0]];
    const above = el ? storeyAbove(doc, el.storey) : undefined;
    if (!el || !above) return false;
    const slabs = Object.values(doc.elements).filter((s) => s.type === 'Slab' && s.storey === above.id && !s.space && s.states.some((st) => el.states.includes(st)));
    store.transact('Gör till eget hål', (tx) => {
      for (const s of slabs) {
        const sp = resolveParams<{ thickness: number; level?: number; holes?: { points: [number, number][] }[] }>(doc, s);
        const ring = stairHoleIn(doc, el, above.id, levelOf(sp), Math.max(1, sp.thickness), true);
        if (!ring) continue;
        const points = ring.map((q): [number, number] => [Math.round(q[0]), Math.round(q[1])]);
        tx.putElement({ ...s, params: { ...s.params, holes: [...(sp.holes ?? []), { points }] } });
      }
      tx.putElement({ ...el, params: { ...el.params, hole: 'none' } });
    });
    return true;
  }
  return false;
}
