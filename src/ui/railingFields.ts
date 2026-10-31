import { newId } from '../core/ids';
import { addRailings } from '../core/railings';
import { isSite, type Element, type Id, type ProjectDoc } from '../core/model';
import type { DocStore } from '../core/store';
import type { RailNum } from '../core/railingTypes';
import { gateLittera, railingPath, railingStair, railingTypeOf, railingValues } from '../elements/railing';
import { railingWarnings } from '../elements/railingWarnings';
import { GATE_POST, hostedPath, RAIL_INSET, type RailGate, type RailingParams } from '../elements/railingGeometry';
import { geometryOfStair, stairParams } from '../elements/stair';
import { levelOf } from '../repr/solids';
import { numberField } from './fieldMarkup';
import { escapeHtml } from './labels';
import { applyTypeField, num, railingTypeAction } from './railingTypeFields';

/**
 * Räckets fält i egenskaperna (0.11.1): varningarna, kanten och läget mot
 * den (på en trappa) eller punkternas höjder (ritat), kilstegen och
 * övergången, och räckets egna värden för de parametrar typen tillåter. Under
 * *Påverkar fler objekt* står typen (tavla 2 i utredningen): grupp, kryssen,
 * parametrarna med formler och kryss *per räcke*, och delarna. Editorn i
 * stilboken (0.11.2) öppnas med *Öppna i räckestypeditorn…*.
 */

const mm = (v: number) => Math.round(v).toLocaleString('sv-SE');
const segmented = (action: string, value: string, options: [string, string][]) =>
  `<div class="segmented" role="group">${options.map(([v, l]) => `<button data-action="${action}" data-value="${v}" aria-pressed="${v === value}">${escapeHtml(l)}</button>`).join('')}</div>`;
const text = (key: string, label: string, value: RailNum | undefined, title = '') =>
  `<label class="field"${title ? ` title="${escapeHtml(title)}"` : ''}><span>${escapeHtml(label)}</span><input type="text" autocomplete="off" data-key="${escapeHtml(key)}" value="${escapeHtml(value === undefined ? '' : String(value))}"></label>`;

/** Lägg räcken längs trappans kanter (0.11.1), med trappans tillstånd och våning. */
export function addRailingsOnStair(store: DocStore, stairId: Id, sides: ('left' | 'right')[], def?: Id): Id[] {
  const st = store.doc.elements[stairId];
  if (st?.type !== 'Stair') return [];
  const made = addRailings(
    store,
    sides.map((side) => ({ storey: st.storey, host: st.id, states: st.states, ...(def ? { definition: def } : {}), params: { host: { side } } })),
    st.states,
    sides.length > 1 ? 'Räcken på båda sidor' : 'Räcke längs kanten',
  );
  return made.map((e) => e.id);
}

export function railingFieldsMarkup(doc: ProjectDoc, el: Element): string {
  const p = el.params as RailingParams;
  const stair = railingStair(doc, el);
  const model = railingTypeOf(doc, el);
  const vals = railingValues(doc, el);
  const path = railingPath(doc, el);
  const warnings = path ? railingWarnings(doc, el) : [p.host ? 'Trappan räcket hängde på finns inte längre.' : 'Linjen är för kort för ett räcke.'];
  const warn = warnings.length ? `<div class="stair-warnings" role="note">${warnings.map((w) => `<p class="skew-note"><b>!</b> ${escapeHtml(w)}</p>`).join('')}</div>` : '';
  const out: string[] = [warn];
  if (stair && p.host) {
    out.push(`<p class="note">Längs trappans ${p.host.side === 'left' ? 'vänstra' : 'högra'} kant (sett uppåt), ${path ? `${mm(path.length)} mm` : ''}. Räcket följer trappan; höjden mäts lodrätt från stegnoslinjen.</p>`);
    out.push(`<div class="fields"><label class="field"><span>Läge mot kanten</span><select data-key="rail:place">${[
      ['inside', 'Innanför'],
      ['on', 'På kanten'],
      ['outside', 'Utanpå'],
    ]
      .map(([v, l]) => `<option value="${v}"${(p.place ?? 'inside') === v ? ' selected' : ''}>${l}</option>`)
      .join('')}</select></label>${(p.place ?? 'inside') !== 'on' ? numberField('rail:inset', 'Avstånd', p.inset ?? RAIL_INSET, 'mm') : ''}</div>`);
    out.push(`<div class="field-label">Vid kilstegen</div>${segmented('rail-winder', p.winder ?? 'smooth', [
      ['smooth', 'Utjämnad'],
      ['stepped', 'Hoppande'],
    ])}`);
  } else if (Array.isArray(p.line)) {
    const z = p.z ?? [];
    // Var det hör till (0.11.3, tavla 5): Platsen eller en våning, och höjden från marken eller fast.
    const site = isSite(el.storey);
    const homes = doc.storeys.map((s) => `<button data-action="rail-home" data-value="${escapeHtml(s.id)}" aria-pressed="${s.id === el.storey}">${escapeHtml(s.name)}</button>`).join('');
    out.push(`<div class="field-label">Hör till</div><div class="segmented wrap" role="group">${homes}</div>`);
    if (site)
      out.push(`<div class="field-label">Höjden från</div>${segmented('rail-height-from', p.heightFrom ?? 'ground', [
        ['ground', 'Färdig mark'],
        ['fixed', 'Fast höjd'],
      ])}`);
    const zLabel = !site ? 'Punkternas höjd mot golvet' : p.heightFrom === 'fixed' ? 'Punkternas höjd mot ±0' : 'Punkternas höjd över marken';
    out.push(`<div class="field-label">${zLabel}</div><div class="fields">${p.line.map((_, i) => numberField(`rail:z:${i}`, `Punkt ${i + 1}`, Number(z[i]) || 0, 'mm')).join('')}</div>`);
  }
  out.push(`<div class="field-label">Övergång lutning–plant</div>${segmented('rail-transition', p.transition ?? 'bend', [
    ['bend', 'Krök (R 150)'],
    ['knee', 'Knäck'],
  ])}`);
  const own = model.params.filter((q) => q.perRailing);
  if (own.length) {
    const fields = own
      .map((q) => {
        const mine = typeof p.values?.[q.name] === 'number';
        return `<div class="rail-own">${numberField(`rail:value:${q.name}`, q.name, vals.get(q.name) ?? 0, 'mm')}${mine ? `<button class="btn btn-small" data-action="rail-reset" data-name="${escapeHtml(q.name)}" title="Typens värde (${escapeHtml(String(q.value))})">Typens</button>` : ''}</div>`;
      })
      .join('');
    out.push(`<div class="field-label">Det här räcket</div><div class="fields">${fields}</div><p class="note">Typen bestämmer vilka mått som får ändras per räcke.</p>`);
  }
  if (stair && p.host) out.push(`<div class="row"><button class="btn" data-action="rail-detach" title="Räcket blir en ritad linje som inte längre följer trappan">Lösgör från trappan</button></div>`);
  out.push(gatesMarkup(doc, p, path?.length ?? 0));
  return out.join('');
}

/** Grindarna i räcket (0.11.3, tavla 5). */
function gatesMarkup(doc: ProjectDoc, p: RailingParams, length: number): string {
  const gates = p.gates ?? [];
  const types = Object.values(doc.definitions)
    .filter((d) => d.railing?.group === 'Grindar')
    .sort((a, b) => a.name.localeCompare(b.name, 'sv', { numeric: true }));
  const rows = gates
    .map((g, i) => {
      const k = (f: string) => `rail:gate:${i}:${f}`;
      const kind = g.own ? 'own' : g.type && doc.definitions[g.type] ? g.type : 'follow';
      const opts: [string, string][] = [['follow', 'Följer staketet'], ...types.map((d): [string, string] => [d.id, `${d.name}${d.description ? ` ${d.description}` : ''}`]), ['own', 'Eget här']];
      const seg = (action: string, value: string, options: [string, string][]) =>
        `<div class="segmented" role="group">${options.map(([v, l]) => `<button data-action="${action}" data-index="${i}" data-value="${v}" aria-pressed="${v === value}">${escapeHtml(l)}</button>`).join('')}</div>`;
      const lit = gateLittera(doc, g);
      return `<li class="rail-gate">
        <div class="rail-part-head"><b>Grind ${i + 1}${lit ? ` · ${escapeHtml(lit)}` : ''}</b><span>${mm(g.width)} mm</span><button class="icon-btn" data-action="rail-gate-remove" data-index="${i}" title="Ta bort grinden (räcket går obrutet igen)" aria-label="Ta bort">×</button></div>
        <div class="fields">
          <label class="field"><span>Typ</span><select data-key="${k('type')}">${opts.map(([v, l]) => `<option value="${escapeHtml(v)}"${v === kind ? ' selected' : ''}>${escapeHtml(l)}</option>`).join('')}</select></label>
          ${numberField(k('width'), 'Bredd (hålmått)', g.width, 'mm')}
          ${numberField(k('at'), 'Från början', Math.round(g.at), 'mm')}
          ${g.own ? numberField(k('height'), 'Höjd', g.height ?? 0, 'mm') : ''}
          ${numberField(k('post'), 'Grindstolpar', g.post ?? GATE_POST, 'mm')}
          ${numberField(k('angle'), 'I planen', g.angle ?? 90, '°')}
          ${kind === 'follow' || kind === 'own' ? text(k('littera'), 'Littera', g.littera) : ''}
          ${text(k('lock'), 'Lås och stopp', g.lock)}
        </div>
        <div class="field-label">Hängning</div>${seg('rail-gate-hang', g.hang ?? 'left', [
          ['left', 'Vänster'],
          ['right', 'Höger'],
          ['pair', 'Par'],
          ['slide', 'Skjut'],
        ])}
        <div class="field-label">Öppnas</div>${seg('rail-gate-swing', g.swing ?? 'out', [
          ['out', 'Utåt'],
          ['in', 'Inåt'],
        ])}
      </li>`;
    })
    .join('');
  const note = gates.length ? '' : '<p class="note">Klicka på räcket och välj <b>Gör till grind…</b> i smartmenyn: facket mellan stolparna där du klickade blir en grind.</p>';
  return `<div class="field-label">Grindar</div>${rows ? `<ul class="rail-parts">${rows}</ul>` : ''}${note}${length && gates.some((g) => g.at + g.width > length + 1) ? '<p class="note">En grind går förbi räckets slut och kortas där.</p>' : ''}`;
}

/** Nästa lediga littera för en grind: G och två siffror, efter grindtyperna och grindarnas egna. */
function nextGateLittera(doc: ProjectDoc): string {
  const used = new Set<string>();
  for (const d of Object.values(doc.definitions)) if (d.elementType === 'Railing') used.add(d.name);
  for (const e of Object.values(doc.elements)) for (const g of ((e.params as RailingParams).gates ?? []) as RailGate[]) if (g.littera) used.add(g.littera);
  for (let n = 1; ; n++) {
    const name = `G${String(n).padStart(2, '0')}`;
    if (!used.has(name)) return name;
  }
}

/** Gör ett fack till en grind (0.11.3). */
export function addGate(store: DocStore, id: Id, span: { at: number; width: number }): number {
  const el = store.doc.elements[id];
  if (el?.type !== 'Railing') return -1;
  const p = el.params as RailingParams;
  const gt = railingTypeOf(store.doc, el).gateType;
  const typed = gt && store.doc.definitions[gt]?.railing ? gt : undefined;
  const gate: RailGate = { id: newId('g'), at: Math.round(span.at), width: Math.round(span.width), ...(typed ? { type: typed } : { littera: nextGateLittera(store.doc) }) };
  const gates = [...(p.gates ?? []), gate].sort((a, b) => a.at - b.at);
  patchRailings(store, [id], 'Gör till grind', () => ({ gates }));
  return gates.findIndex((g) => Math.round(g.at) === Math.round(span.at));
}

/** Patch av räckets parametrar, där undefined tar bort nyckeln. */
function patchRailings(store: DocStore, ids: Id[], label: string, fn: (p: RailingParams, el: Element) => Record<string, unknown> | null): boolean {
  const doc = store.doc;
  const patches: [Id, Record<string, unknown>][] = [];
  for (const id of ids) {
    const el = doc.elements[id];
    if (el?.type !== 'Railing') continue;
    const patch = fn(el.params as RailingParams, el);
    if (patch) patches.push([id, patch]);
  }
  if (!patches.length) return false;
  store.transact(label, (tx) => {
    for (const [id, patch] of patches) {
      const el = tx.doc.elements[id];
      if (!el) continue;
      const params: Record<string, unknown> = { ...el.params };
      for (const [key, v] of Object.entries(patch)) {
        if (v === undefined) delete params[key];
        else params[key] = v;
      }
      tx.putElement({ ...el, params });
    }
  });
  return true;
}

/** Ett ändrat fält med nyckeln `rail:…` (det efter `rail:`). Ger false när värdet inte gick att använda. */
export function applyRailingField(store: DocStore, ids: Id[], rest: string, input: HTMLInputElement | HTMLSelectElement): boolean {
  const raw = input.value;
  const [name, ...more] = rest.split(':');
  if (name === 'type') return applyTypeField(store, more[0], more.slice(1), input);
  const n = num(raw);
  switch (name) {
    case 'place':
      return patchRailings(store, ids, 'Läge mot kanten', () => ({ place: raw === 'on' || raw === 'outside' ? raw : undefined }));
    case 'inset':
      return Number.isFinite(n) && n >= 0 && patchRailings(store, ids, 'Avstånd från kanten', () => ({ inset: Math.round(n) === RAIL_INSET ? undefined : Math.round(n) }));
    case 'z': {
      const i = Number(more[0]);
      return Number.isFinite(n) && patchRailings(store, ids, 'Punktens höjd', (p) => {
        const z = (p.line ?? []).map((_, j) => (j === i ? Math.round(n) : Number(p.z?.[j]) || 0));
        return { z: z.some((v) => v) ? z : undefined };
      });
    }
    case 'gate': {
      const i = Number(more[0]);
      const field = more[1];
      return patchRailings(store, ids, 'Ändra grind', (p) => {
        const list = [...(p.gates ?? [])];
        const g: RailGate = { ...list[i] };
        if (!list[i]) return null;
        if (field === 'type') {
          delete g.type;
          delete g.own;
          if (raw === 'own') g.own = true;
          else if (raw !== 'follow') g.type = raw;
        } else if (field === 'littera' || field === 'lock') {
          const t = raw.trim();
          if (t) g[field] = t;
          else delete g[field];
        } else if (field === 'width' || field === 'height' || field === 'post' || field === 'at' || field === 'angle') {
          if (!Number.isFinite(n) || n < 0 || ((field === 'width' || field === 'post') && n <= 0)) return null;
          const v = Math.round(n);
          if ((field === 'post' && v === GATE_POST) || (field === 'angle' && v === 90) || (field === 'height' && !v)) delete g[field];
          else g[field] = field === 'angle' ? Math.min(180, Math.max(1, v)) : v;
        } else return null;
        list[i] = g;
        return { gates: list };
      });
    }
    case 'value': {
      const key = more.join(':');
      return Number.isFinite(n) && patchRailings(store, ids, key, (p) => ({ values: { ...p.values, [key]: Math.round(n) } }));
    }
  }
  return false;
}

/** Knapparna i räckets fält och typen. */
export function railingAction(store: DocStore, ids: Id[], action: string, b: HTMLElement): boolean {
  switch (action) {
    case 'rail-winder':
      return patchRailings(store, ids, b.dataset.value === 'stepped' ? 'Hoppande vid kilstegen' : 'Utjämnad vid kilstegen', () => ({ winder: b.dataset.value === 'stepped' ? 'stepped' : undefined }));
    case 'rail-transition':
      return patchRailings(store, ids, b.dataset.value === 'knee' ? 'Knäck' : 'Krök', () => ({ transition: b.dataset.value === 'knee' ? 'knee' : undefined }));
    case 'rail-height-from':
      return patchRailings(store, ids, b.dataset.value === 'fixed' ? 'Fast höjd' : 'Höjden från marken', () => ({ heightFrom: b.dataset.value === 'fixed' ? 'fixed' : undefined }));
    case 'rail-home': {
      const to = b.dataset.value!;
      if (!store.doc.storeys.some((s) => s.id === to)) return false;
      store.transact('Flytta till våning', (tx) => {
        for (const id of ids) {
          const el = tx.doc.elements[id];
          if (el?.type !== 'Railing' || el.host || el.storey === to) continue;
          const seen = (el.seenOn ?? []).filter((x) => x !== to);
          const { seenOn: _, ...rest } = el;
          tx.putElement({ ...rest, storey: to, ...(seen.length ? { seenOn: seen } : {}) });
        }
      });
      return true;
    }
    case 'rail-gate-remove':
    case 'rail-gate-hang':
    case 'rail-gate-swing': {
      const i = Number(b.dataset.index);
      const v = b.dataset.value;
      return patchRailings(store, ids, action === 'rail-gate-remove' ? 'Ta bort grind' : 'Ändra grind', (p) => {
        const list = [...(p.gates ?? [])];
        if (!list[i]) return null;
        if (action === 'rail-gate-remove') list.splice(i, 1);
        else {
          const g: RailGate = { ...list[i] };
          if (action === 'rail-gate-hang') {
            if (v === 'right' || v === 'pair' || v === 'slide') g.hang = v;
            else delete g.hang;
          } else if (v === 'in') g.swing = 'in';
          else delete g.swing;
          list[i] = g;
        }
        return { gates: list.length ? list : undefined };
      });
    }
    case 'rail-reset': {
      const name = b.dataset.name!;
      return patchRailings(store, ids, `Typens ${name}`, (p) => {
        const { [name]: _, ...rest } = p.values ?? {};
        return { values: Object.keys(rest).length ? rest : undefined };
      });
    }
    case 'rail-detach': {
      store.transact('Lösgör räcket', (tx) => {
        for (const id of ids) {
          const el = tx.doc.elements[id];
          const st = el ? railingStair(tx.doc, el) : undefined;
          const p = el?.params as RailingParams | undefined;
          if (!el || !st || !p?.host) continue;
          const sp = stairParams(tx.doc, st);
          const g = geometryOfStair(sp);
          const path = g ? hostedPath(g, { ...p, transition: 'knee' }, p.host) : null;
          if (!path) continue;
          const lv = levelOf(sp);
          const line: [number, number][] = [];
          const z: number[] = [];
          path.pts.forEach((q, i) => {
            const last = line[line.length - 1];
            const r: [number, number] = [Math.round(q[0]), Math.round(q[1])];
            if (last && Math.hypot(r[0] - last[0], r[1] - last[1]) < 1) {
              z[z.length - 1] = Math.round(Math.max(z[z.length - 1], path.z[i] + lv));
              return;
            }
            line.push(r);
            z.push(Math.round(path.z[i] + lv));
          });
          const { host: _h, place: _p, inset: _i, winder: _w, ...rest } = p;
          const { host: _eh, ...plain } = el;
          tx.putElement({ ...plain, params: { ...rest, line, z } });
        }
      });
      return true;
    }
  }
  return railingTypeAction(store, action, b);
}
