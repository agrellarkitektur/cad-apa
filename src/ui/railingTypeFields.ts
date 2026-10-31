import { newId } from '../core/ids';
import type { Id, ProjectDoc } from '../core/model';
import type { DocStore } from '../core/store';
import { newPart, PART_KIND_LABELS, RAILING_GROUPS, railingModel, railNum, railValues, type RailingTypeModel, type RailNum, type RailPart, type RailPartKind } from '../core/railingTypes';
import { updateRailingType } from '../core/railings';
import { railingTypeOf } from '../elements/railing';
import { escapeHtml } from './labels';

/**
 * Räckestypen i egenskaperna (0.11.1, bruten ur `railingFields.ts` i
 * granskningen efter 0.11.5): markupen under *Påverkar fler objekt*
 * (tavla 2), fälten `rail:type:<def>:…` och knapparna för parametrar och
 * delar. Räckestypeditorn i stilboken (0.11.2) använder samma fält och
 * knappar.
 */

const mm = (v: number) => Math.round(v).toLocaleString('sv-SE');
const text = (key: string, label: string, value: RailNum | undefined, title = '') =>
  `<label class="field"${title ? ` title="${escapeHtml(title)}"` : ''}><span>${escapeHtml(label)}</span><input type="text" autocomplete="off" data-key="${escapeHtml(key)}" value="${escapeHtml(value === undefined ? '' : String(value))}"></label>`;

export const num = (raw: string): number => Number(raw.replace(/\s/g, '').replace(',', '.').replace('−', '-'));
/** Ett mått i typen: ett tal, eller formeln som den står. */
const railNumOf = (raw: string): RailNum | undefined => {
  const t = raw.trim();
  if (!t) return undefined;
  const n = num(t);
  return Number.isFinite(n) ? n : t;
};

/** Typen i *Påverkar fler objekt* (tavla 2): grupp, kryss, parametrar och delar. */
export function railingTypeMarkup(doc: ProjectDoc, defId: Id): string {
  const def = doc.definitions[defId];
  const m = railingModel(def);
  if (!def || !m) return '';
  const users = Object.values(doc.elements).filter((e) => e.definition === defId).length;
  const k = (rest: string) => `rail:type:${defId}:${rest}`;
  const groups = [...new Set([...RAILING_GROUPS, ...Object.values(doc.definitions).flatMap((d) => (d.railing ? [d.railing.group] : []))])];
  const vals = railValues(m);
  const params = m.params
    .map(
      (q, i) => `<li class="rail-param">
        <input type="text" aria-label="Namn" data-key="${k(`param:${i}:name`)}" value="${escapeHtml(q.name)}">
        <input type="text" aria-label="Värde eller formel" data-key="${k(`param:${i}:value`)}" value="${escapeHtml(String(q.value))}" title="${typeof q.value === 'string' ? `= ${mm(vals.get(q.name) ?? 0)} mm` : 'mm, eller en formel med de andra parametrarna'}">
        <label class="check" title="Får ändras på det enskilda räcket"><input type="checkbox" data-key="${k(`param:${i}:per`)}"${q.perRailing ? ' checked' : ''}> per räcke</label>
        <button class="icon-btn" data-action="railtype-param-remove" data-def="${defId}" data-index="${i}" title="Ta bort parametern" aria-label="Ta bort">×</button>
      </li>`,
    )
    .join('');
  const materials = (doc.graphics.materials ?? []).filter((x) => x.building);
  const partFields = (q: RailPart, i: number): string => {
    const f = (field: string, label: string, v: RailNum | undefined, title = '') => text(k(`part:${i}:${field}`), label, v, title);
    const shape = q.kind !== 'surface' ? `<label class="field"><span>Profil</span><select data-key="${k(`part:${i}:shape`)}"><option value="rect"${q.profile?.shape !== 'round' ? ' selected' : ''}>Rektangel</option><option value="round"${q.profile?.shape === 'round' ? ' selected' : ''}>Rund</option></select></label>${f('w', q.profile?.shape === 'round' ? 'Diameter' : 'Bredd', q.profile?.w ?? 40)}${q.profile?.shape === 'round' ? '' : f('h', 'Höjd', q.profile?.h ?? q.profile?.w ?? 40)}` : f('thickness', 'Tjocklek', q.thickness ?? 10);
    const heights = q.kind === 'along' ? f('z', 'Överkant', q.z, 'Höjden över referenslinjen: mm eller en formel') : `${f('from', 'Underkant', q.from)}${f('to', 'Överkant', q.to)}`;
    const spacing = q.kind === 'point' ? f('spacing', 'Största delning', q.spacing) : q.kind === 'repeat' ? f('spacing', 'Största öppning', q.spacing) : '';
    const ext = q.kind === 'along' ? f('extend', 'Förlängning', q.extend, 'Förbi början och slutet, vågrätt') : '';
    const mat = `<label class="field"><span>Material</span><select data-key="${k(`part:${i}:material`)}"><option value="">${q.kind === 'surface' ? 'Glas' : 'Metall'}</option>${materials.map((x) => `<option value="${escapeHtml(x.id)}"${x.id === q.material ? ' selected' : ''}>${escapeHtml(x.name)}</option>`).join('')}</select></label>`;
    return `<div class="fields">${shape}${heights}${spacing}${ext}${f('offset', 'Inåt', q.offset, 'Läge i sidled från referenslinjen; positivt inåt')}${mat}</div>`;
  };
  const parts = m.parts
    .map(
      (q, i) => `<li class="rail-part">
        <div class="rail-part-head"><input type="text" aria-label="Delens namn" data-key="${k(`part:${i}:name`)}" value="${escapeHtml(q.name)}"><span>${PART_KIND_LABELS[q.kind]}</span>
        <button class="icon-btn" data-action="railtype-part-remove" data-def="${defId}" data-index="${i}" title="Ta bort delen" aria-label="Ta bort">×</button></div>
        ${partFields(q, i)}
      </li>`,
    )
    .join('');
  const add = (Object.keys(PART_KIND_LABELS) as RailPartKind[]).map((kind) => `<button class="btn btn-small" data-action="railtype-part-add" data-def="${defId}" data-kind="${kind}">+ ${PART_KIND_LABELS[kind]}</button>`).join('');
  return `<div class="shared-block rail-type">
    <div class="shared-head">Typen ${escapeHtml(def.name)} <span>gäller alla ${users} ${users === 1 ? 'räcke' : 'räcken'}</span></div>
    <div class="fields">
      <label class="field"><span>Littera</span><input type="text" data-key="${k('name')}" value="${escapeHtml(def.name)}"></label>
      <label class="field"><span>Beskrivning</span><input type="text" data-key="${k('description')}" value="${escapeHtml(def.description ?? '')}"></label>
      <label class="field"><span>Grupp</span><input type="text" list="rail-groups" data-key="${k('group')}" value="${escapeHtml(m.group)}"></label>
    </div>
    <datalist id="rail-groups">${groups.map((g) => `<option value="${escapeHtml(g)}">`).join('')}</datalist>
    <div class="row wrap">
      <label class="check" title="Visas på Platsen"><input type="checkbox" data-key="${k('ground')}"${m.ground ? ' checked' : ''}> Mark</label>
      <label class="check" title="Visas på våningarna"><input type="checkbox" data-key="${k('building')}"${m.building ? ' checked' : ''}> Byggnad</label>
      <label class="check" title="Varningarna för öppningar och klätterbarhet (BFS 2024:9, 2 kap. 11 §)"><input type="checkbox" data-key="${k('childSafe')}"${m.childSafe ? ' checked' : ''}> Barnsäkert</label>
    </div>
    <div class="row"><button class="btn btn-small" data-action="style-railing-type" data-def="${defId}" title="Stilboken › Räckestyper: typlistan, förhandsvisningen och delarna">Öppna i räckestypeditorn…</button></div>
    <div class="field-label">Parametrar</div>
    <ul class="rail-params">${params}</ul>
    <div class="row"><button class="btn btn-small" data-action="railtype-param-add" data-def="${defId}">+ Parameter</button></div>
    <div class="field-label">Delar</div>
    <ul class="rail-parts">${parts}</ul>
    <div class="row wrap">${add}</div>
    <p class="note">Måtten är mm eller formler med parametrarna, t.ex. <code>Skyddshöjd - 40</code>. Höjderna räknas från referenslinjen: stegnoslinjen i en trappa, marken på Platsen, golvet annars.</p>
  </div>`;
}

/** Om formeln går att räkna med typens andra parametrar. */
function evalFormulaOk(v: string, m: RailingTypeModel, self: string): boolean {
  const vals = railValues({ ...m, params: m.params.filter((p) => p.name !== self) });
  return Number.isFinite(railNum(v, vals, NaN));
}

/** Ett fält i typen (`rail:type:<def>:…`). */
export function applyTypeField(store: DocStore, defId: Id, path: string[], input: HTMLInputElement | HTMLSelectElement): boolean {
  const raw = input.value;
  const checked = (input as HTMLInputElement).checked;
  const def = store.doc.definitions[defId];
  if (!def) return false;
  const [what, idx, field] = path;
  if (what === 'name') {
    const name = raw.trim();
    if (!name) return false;
    store.transact(`Byt littera till ${name}`, (tx) => tx.putDefinition({ ...def, name }));
    return true;
  }
  if (what === 'description') {
    store.transact(`Ändra typ ${def.name}`, (tx) => tx.putDefinition({ ...def, description: raw.trim() || undefined }));
    return true;
  }
  return updateRailingType(store, defId, `Ändra typ ${def.name}`, (m) => {
    if (what === 'group') m.group = raw.trim() || m.group;
    // Räckestypeditorn (0.11.3): På sluttning för alla delar, och grindtypen.
    else if (what === 'slope') {
      if (raw !== 'follow' && raw !== 'stepped') return null;
      for (const part of m.parts) {
        if (raw === 'stepped') part.slope = 'stepped';
        else delete part.slope;
      }
    } else if (what === 'gateType') {
      if (raw) m.gateType = raw;
      else delete m.gateType;
    }
    else if (what === 'ground' || what === 'building' || what === 'childSafe') m[what] = checked || undefined;
    else if (what === 'param') {
      const q = m.params[Number(idx)];
      if (!q) return null;
      if (field === 'name') {
        const next = raw.trim();
        if (!next || m.params.some((x) => x !== q && x.name === next)) return null;
        // Formlerna som pekar på det gamla namnet följer med.
        const re = new RegExp(`(?<![\\p{L}\\d_])${q.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\d_])`, 'gu');
        const rename = (v: RailNum | undefined) => (typeof v === 'string' ? v.replace(re, next) : v);
        for (const x of m.params) x.value = rename(x.value) ?? x.value;
        for (const part of m.parts) for (const key of ['z', 'from', 'to', 'offset', 'spacing', 'extend'] as const) if (part[key] !== undefined) part[key] = rename(part[key]);
        q.name = next;
      } else if (field === 'value') {
        const v = railNumOf(raw);
        if (v === undefined) return null;
        q.value = v;
      } else if (field === 'formula') {
        // En tom formel ger det räknade värdet som fast värde.
        const t = raw.trim();
        if (!t) q.value = Math.round(railValues(m).get(q.name) ?? 0);
        else {
          const v = railNumOf(t);
          if (v === undefined || (typeof v === 'string' && evalFormulaOk(v, m, q.name) === false)) return null;
          q.value = v;
        }
      } else if (field === 'per') q.perRailing = checked || undefined;
    } else if (what === 'part') {
      const q = m.parts[Number(idx)];
      if (!q) return null;
      if (field === 'name') q.name = raw.trim() || q.name;
      else if (field === 'shape') q.profile = { ...(q.profile ?? { w: 40 }), shape: raw === 'round' ? 'round' : 'rect' };
      else if (field === 'w' || field === 'h') {
        const v = num(raw);
        if (!(v > 0)) return null;
        q.profile = { ...(q.profile ?? { shape: 'rect', w: 40 }), [field]: Math.round(v) };
      } else if (field === 'thickness') {
        const v = num(raw);
        if (!(v > 0)) return null;
        q.thickness = Math.round(v);
      } else if (field === 'material') q.material = raw || undefined;
      // Räckestypeditorn (0.11.2): ändar, beteenden, ritningen och under mark.
      else if (field === 'corners') q.corners = checked;
      else if (field === 'stair') q.stair = raw === 'plumb' ? 'plumb' : undefined;
      else if (field === 'slope') q.slope = raw === 'stepped' ? 'stepped' : undefined;
      else if (field === 'gate') q.gate = raw === 'continue' ? 'continue' : raw === 'break' ? 'break' : undefined;
      else if (field === 'finish') q.finish = raw === 'down' || raw === 'wall' || raw === 'straight' ? raw : undefined;
      else if (field === 'detail') q.detail = raw === 'sketch' || raw === 'normal' || raw === 'detail' ? raw : undefined;
      else if (field === 'pen') q.pen = raw || undefined;
      else if (field === 'footing') q.below = { ...q.below, footing: checked || undefined };
      else if (field === 'depth') {
        const v = railNumOf(raw);
        if (typeof v === 'string' && !Number.isFinite(railNum(v, railValues(m), NaN))) return null;
        const below = { ...q.below, depth: v };
        if (v === undefined) delete below.depth;
        q.below = below.depth === undefined && !below.footing ? undefined : below;
      }
      else if (field === 'z' || field === 'from' || field === 'to' || field === 'offset' || field === 'spacing' || field === 'extend') {
        const v = railNumOf(raw);
        // En formel som inte går att räkna avvisas.
        if (typeof v === 'string' && !Number.isFinite(railNum(v, railValues(m), NaN))) return null;
        if (v === undefined) delete q[field];
        else q[field] = v;
      } else return null;
    } else return null;
    return m;
  });
}

/** Knapparna i typen (parametrar och delar), i panelen och i räckestypeditorn. */
export function railingTypeAction(store: DocStore, action: string, b: HTMLElement): boolean {
  switch (action) {
    case 'railtype-param-add':
      return updateRailingType(store, b.dataset.def!, 'Ny parameter', (m) => {
        let n = 1;
        while (m.params.some((q) => q.name === `Parameter${n}`)) n++;
        m.params.push({ name: `Parameter${n}`, value: 100 });
        return m;
      });
    case 'railtype-param-remove':
      return updateRailingType(store, b.dataset.def!, 'Ta bort parameter', (m) => {
        m.params.splice(Number(b.dataset.index), 1);
        return m;
      });
    case 'railtype-part-add':
      return updateRailingType(store, b.dataset.def!, 'Ny del', (m) => {
        m.parts.push(newPart(m, b.dataset.kind as RailPartKind));
        return m;
      });
    case 'railtype-part-remove':
      return updateRailingType(store, b.dataset.def!, 'Ta bort del', (m) => {
        m.parts.splice(Number(b.dataset.index), 1);
        return m;
      });
  }
  return false;
}

/** En ny räckestyp som en kopia av den markerade, med nästa lediga littera i gruppen. */
export function duplicateRailingType(store: DocStore, ids: Id[], nextName: string): void {
  const doc = store.doc;
  const el = doc.elements[ids[0]];
  const m: RailingTypeModel = structuredClone(railingTypeOf(doc, el));
  const old = el.definition ? doc.definitions[el.definition] : undefined;
  const id = newId('t');
  store.transact(`Ny typ ${nextName}`, (tx) => {
    tx.putDefinition({ id, origin: 'component', name: nextName, elementType: 'Railing', params: {}, props: {}, railing: m, ...(old?.description ? { description: `${old.description} (kopia)` } : {}) });
    for (const i of ids) {
      const e = tx.doc.elements[i];
      if (e?.type === 'Railing') tx.putElement({ ...e, definition: id });
    }
  });
}
