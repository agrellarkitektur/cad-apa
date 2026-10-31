import { openingSettingsOf } from '../core/general';
import type { Element, Id, ProjectDoc } from '../core/model';
import { kindOfElementType, OP_LABEL, type OpeningKind } from '../core/openingTypes';
import type { DocStore } from '../core/store';
import { openingLitteras } from '../elements/openingLittera';
import { customFrame, hingeLetters, openingModelOf, uMapping, viewFace, type OpeningObjParams } from '../elements/openingSpec';
import { resolveParams } from '../elements/registry';
import { outsideSide } from '../elements/wallSides';
import { numberField } from './fieldMarkup';
import { escapeHtml } from './labels';

/**
 * Dörrarnas och fönstrens fält i egenskaperna (0.11.8, tavla 2): måtten
 * (modulmått, karmyttermått och hålmått), höjden (höjdläge, överkant karm
 * och bröstning), läget i väggen, hängningen och litteran. Nycklarna
 * börjar med `open:`.
 */

const nf = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 });
const mm = (v: number) => nf.format(Math.round(v));

/** Ett modulmått som text: "12×13", "12 x 13", "12 13" → [1200, 1300] mm. */
export function parseModule(text: string): [number, number] | null {
  const m = text.trim().match(/^(\d+(?:[.,]\d+)?)\s*(?:[×xX*]|\s)\s*(\d+(?:[.,]\d+)?)$/);
  if (!m) return null;
  const a = Number(m[1].replace(',', '.'));
  const b = Number(m[2].replace(',', '.'));
  if (!(a > 0 && b > 0)) return null;
  // Skrivet i mm (1200×1300) eller i moduler (12×13).
  const toMm = (v: number) => (v >= 100 ? Math.round(v) : Math.round(v * 100));
  return [toMm(a), toMm(b)];
}

/** Modulmåttet som text: 12 × 13, eller *eget (≈ 12 × 13)* när karmyttermåttet är fritt. */
export function moduleLabel(p: OpeningObjParams): string {
  const w = Math.round((p.frameW + 2 * p.gap) / 100);
  const h = Math.round((p.frameH + (p.floor ? p.gap : 2 * p.gap)) / 100);
  if (customFrame(p)) {
    const exact = Math.abs(w * 100 - 2 * p.gap - p.frameW) < 0.5 && Math.abs(h * 100 - (p.floor ? p.gap : 2 * p.gap) - p.frameH) < 0.5;
    return exact ? `${w} × ${h}` : `eget (≈ ${w} × ${h})`;
  }
  return `${Math.round(p.width / 100)} × ${Math.round(p.height / 100)}`;
}

function select(key: string, label: string, value: string, options: [string, string][]): string {
  return `<label class="field"><span>${label}</span><select data-key="${key}">${options.map(([v, l]) => `<option value="${v}"${v === value ? ' selected' : ''}>${escapeHtml(l)}</option>`).join('')}</select></label>`;
}

/** Hängningen sedd utifrån (eller inifrån enligt Allmänt): *V · H*. */
export function hingeText(doc: ProjectDoc, el: Element): string {
  const host = el.host ? doc.elements[el.host] : undefined;
  if (!host) return '';
  const p = resolveParams<OpeningObjParams>(doc, el);
  const m = openingModelOf(doc, el);
  const kind = kindOfElementType(el.type) ?? 'window';
  const vf = viewFace(outsideSide(doc, host), kind, p.swing);
  const { mirrored } = uMapping(m, vf, p.hinge ?? 'start', 0, 1);
  return hingeLetters(m, mirrored, openingSettingsOf(doc.graphics).hingeFrom === 'inside').split('').join(' · ');
}

/** Typerna för en sort, i editorns grupper, som `<option>`. */
export function openingTypeOptions(doc: ProjectDoc, kind: OpeningKind, current: Id | undefined): string {
  const defs = Object.values(doc.definitions).filter((d) => d.opening?.kind === kind);
  const groups = new Map<string, typeof defs>();
  for (const d of defs) {
    const g = d.opening!.group;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(d);
  }
  return [...groups.entries()]
    .map(([g, list]) => `<optgroup label="${escapeHtml(g)}">${list.map((d) => `<option value="${d.id}"${d.id === current ? ' selected' : ''}>${escapeHtml(d.name)}</option>`).join('')}</optgroup>`)
    .join('');
}

export function openingFieldsMarkup(doc: ProjectDoc, el: Element): string {
  const p = resolveParams<OpeningObjParams>(doc, el);
  const kind = kindOfElementType(el.type) ?? 'window';
  const m = openingModelOf(doc, el);
  const host = el.host ? doc.elements[el.host] : undefined;
  const exterior = host ? outsideSide(doc, host) !== null : false;
  const littera = openingLitteras(doc).get(el.id) ?? '';
  const locked = typeof p.littera === 'string' && !!p.littera;
  const st = openingSettingsOf(doc.graphics);
  const ruleText = { module: 'Bara bokstav och modulmått', type: 'Typ och mått', hinge: 'Typ, mått och hängning' }[st.rule];
  const warn: string[] = [];
  if (m.min && (p.frameW < m.min[0] || p.frameH < m.min[1])) warn.push(`Mindre än typens minsta mått (${mm(m.min[0])} × ${mm(m.min[1])}).`);
  if (m.max && (p.frameW > m.max[0] || p.frameH > m.max[1])) warn.push(`Större än typens största mått (${mm(m.max[0])} × ${mm(m.max[1])}).`);
  const ops = [...new Set(m.cells.map((c) => OP_LABEL[c.op]))].join(', ');
  const height =
    kind === 'door'
      ? ''
      : `<div class="field-label">Höjd</div><div class="fields">
        ${select('open:heightRef', 'Höjdläge', p.heightRef === 'head' ? 'head' : 'sill', [
          ['head', 'Överkant karm'],
          ['sill', 'Bröstning'],
        ])}
        ${p.heightRef === 'head' ? numberField('open:head', 'Överkant karm', p.head ?? st.head, 'mm') : numberField('param:sill', 'Bröstning', p.sill ?? 0, 'mm')}
        <label class="field"><span>${p.heightRef === 'head' ? 'Bröstning' : 'Överkant karm'}</span><input value="${mm(p.heightRef === 'head' ? (p.sill ?? 0) : (p.head ?? 0))}" readonly title="Räknas ur det andra"></label>
      </div>
      <label class="check" title="Annars räknas höjden från våningens golv och fönstret ligger kvar när väggens fot flyttas"><input type="checkbox" data-key="param:sillFromWall"${p.sillFromWall ? ' checked' : ''}> Från väggens fot</label>`;
  const place = p.place ?? (exterior && kind !== 'door' ? 'out' : 'auto');
  return `${warn.map((w) => `<p class="skew-note" role="note"><b>!</b> ${escapeHtml(w)} <i>Avviker från typen.</i></p>`).join('')}
    <p class="note">${escapeHtml(ops)}${m.spec ? ` · ${escapeHtml(m.spec)}` : ''}</p>
    <div class="field-label">Mått</div>
    <div class="fields">
      <label class="field"><span>Modulmått</span><input data-key="open:module" value="${escapeHtml(moduleLabel(p))}" title="T.ex. 12×13 (moduler) eller 1200×1300 (mm)"></label>
      ${numberField('open:frameW', 'Karmyttermått bredd', p.frameW, 'mm')}
      ${numberField('open:frameH', 'Karmyttermått höjd', p.frameH, 'mm')}
      <label class="field"><span>Hålmått</span><input value="${mm(p.holeW)} × ${mm(p.holeH)}" readonly></label>
    </div>
    <p class="note">Drevmånen ${mm(p.gap)} per sida (stilboken › Allmänt).${customFrame(p) ? ' Karmyttermåttet är eget; skriv ett modulmått för att gå tillbaka.' : ''}</p>
    ${height}
    <div class="field-label">Läge i väggen</div>
    <div class="fields">
      ${numberField('param:at', 'Läge längs vägg', p.at, 'mm')}
      ${select('open:place', 'Karmens läge', place, [
        ...(kind === 'door' || !exterior ? ([['auto', kind === 'door' ? 'Liv på slagsidan' : 'Mitt']] as [string, string][]) : []),
        ...(exterior ? ([['out', 'Liv ute'], ['in', 'Liv inne']] as [string, string][]) : []),
        ['mid', 'Mitt i väggen'],
      ])}
      <label class="field" for="f-open-inset"><span>Avstånd</span><span class="input-unit"><input type="text" data-expr inputmode="decimal" autocomplete="off" id="f-open-inset" data-key="param:inset" value="${p.inset ?? ''}" placeholder="0"><i>mm</i></span></label>
      ${numberField('param:frameDepth', 'Karmdjup', p.frameDepth, 'mm')}
    </div>
    <div class="field-label">Hängning</div>
    <div class="row wrap"><span class="note">Lufterna ${escapeHtml(hingeText(doc, el) || '–')}, sedd från ${st.hingeFrom === 'inside' ? 'insidan' : 'utsidan'}</span>
      <button class="btn" data-action="flip-hinge" title="Spegla hängningen (S)">Spegla hängning</button>${kind === 'door' ? '<button class="btn" data-action="flip-swing">Vänd slag</button>' : ''}</div>
    <div class="field-label">Littera</div>
    <div class="fields">
      <label class="field"><span>Littera</span><input data-key="open:littera" value="${escapeHtml(littera)}" title="Skriv en egen littera (den låses), eller töm fältet för regeln"></label>
      <label class="check"><input type="checkbox" data-key="open:lock"${locked ? ' checked' : ''}> Låst</label>
    </div>
    <p class="note">Regel: ${escapeHtml(ruleText)} (stilboken › Allmänt). En låst littera står kvar när regeln byts.</p>
    ${kind === 'door' ? `<label class="check"><input type="checkbox" data-key="param:mainEntrance"${p.mainEntrance ? ' checked' : ''}> Huvudentré (rum och dörrar numreras härifrån)</label>` : ''}
    <div class="fields">${`<label class="field"><span>Nummer</span><input data-key="name" value="${escapeHtml(el.name ?? '')}" placeholder="${kind === 'door' ? 'Auto (D1203)' : ''}"></label>`}</div>`;
}

const num = (raw: string) => Number(raw.replace(',', '.').replace('−', '-'));

function patch(store: DocStore, ids: Id[], label: string, fn: (p: OpeningObjParams, el: Element) => Record<string, unknown>): boolean {
  store.transact(label, (tx) => {
    for (const id of ids) {
      const el = tx.doc.elements[id];
      if (!el) continue;
      const p = resolveParams<OpeningObjParams>(tx.doc, el);
      const next: Record<string, unknown> = { ...el.params, ...fn(p, el) };
      for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
      tx.putElement({ ...el, params: next });
    }
  });
  return true;
}

export function applyOpeningField(store: DocStore, ids: Id[], name: string, input: HTMLInputElement | HTMLSelectElement): boolean {
  const raw = input.value;
  const v = num(raw);
  switch (name) {
    case 'module': {
      const mod = parseModule(raw);
      return !!mod && patch(store, ids, 'Modulmått', () => ({ width: mod[0], height: mod[1], frame: undefined }));
    }
    case 'frameW':
    case 'frameH':
      if (!(v >= 50)) return false;
      return patch(store, ids, 'Karmyttermått', (p) => {
        const fr: [number, number] = [p.frameW, p.frameH];
        fr[name === 'frameW' ? 0 : 1] = Math.round(v);
        // Ligger det på modulen följer det modulen igen.
        const w = (fr[0] + 2 * p.gap) / 100;
        const h = (fr[1] + (p.floor ? p.gap : 2 * p.gap)) / 100;
        if (Number.isInteger(w) && Number.isInteger(h)) return { width: w * 100, height: h * 100, frame: undefined };
        return { frame: fr, width: Math.round(w) * 100, height: Math.round(h) * 100 };
      });
    case 'heightRef':
      return patch(store, ids, 'Höjdläge', (p) => (raw === 'head' ? { heightRef: 'head', head: p.head, sill: undefined } : { heightRef: 'sill', sill: p.sill, head: undefined }));
    case 'head':
      return Number.isFinite(v) && patch(store, ids, 'Överkant karm', () => ({ heightRef: 'head', head: Math.round(v), sill: undefined }));
    case 'place':
      return patch(store, ids, 'Karmens läge', () => ({ place: raw === 'auto' ? undefined : raw }));
    case 'littera': {
      const t = raw.trim();
      return patch(store, ids, t ? 'Egen littera' : 'Litteran följer regeln', () => ({ littera: t || undefined }));
    }
    case 'lock': {
      const on = (input as HTMLInputElement).checked;
      const now = openingLitteras(store.doc);
      return patch(store, ids, on ? 'Lås litteran' : 'Lås upp litteran', (_p, el) => ({ littera: on ? now.get(el.id) : undefined }));
    }
  }
  return false;
}

/** *Lås litteran* i smartmenyn: låser den som gäller nu, eller låser upp. */
export function toggleOpeningLock(store: DocStore, ids: Id[]): void {
  const doc = store.doc;
  const locked = ids.every((id) => typeof doc.elements[id]?.params.littera === 'string');
  const now = openingLitteras(doc);
  patch(store, ids, locked ? 'Lås upp litteran' : 'Lås litteran', (_p, el) => ({ littera: locked ? undefined : now.get(el.id) }));
}

/** Byt mått, behåll typ. */
export function setOpeningModule(store: DocStore, ids: Id[], mod: [number, number]): void {
  patch(store, ids, 'Byt mått', () => ({ width: mod[0], height: mod[1], frame: undefined }));
}

/** Samma littera som ett annat objekt. */
export function setOpeningLittera(store: DocStore, ids: Id[], littera: string): void {
  patch(store, ids, `Samma littera som ${littera}`, () => ({ littera }));
}
