import { openingSettingsOf, type OpeningRule } from '../core/general';
import type { Element, Id, ProjectDoc } from '../core/model';
import { buildingStoreys } from '../core/model';
import { kindOfElementType } from '../core/openingTypes';
import { northAngle } from './markers';
import { hingeLetters, openingModelOf, uMapping, viewFace, type OpeningObjParams } from './openingSpec';
import { resolveParams } from './registry';
import { wallFrame, type WallParams } from './wall';
import { outsideSide } from './wallSides';

/**
 * Dörrarnas, fönstrens och vägghålens littera (0.11.8). Projektets
 * litteraregel (stilboken › Allmänt) avgör vad som räknas som samma:
 *
 * - *Bara bokstav och modulmått*: F 12×13, utan nummer.
 * - *Typ och mått*: samma typ och karmyttermått får samma littera (F01, F02 …).
 * - *Typ, mått och hängning*: V och H får var sin.
 *
 * Numret för en kombination sparas i projektet (`openingNumbers`), så att
 * litteran står still när andra tillkommer; en ny kombination får nästa
 * lediga nummer, och *Numrera om* sorterar efter våning, fasad (N–Ö–S–V)
 * och läge (vänster till höger sett utifrån). En egen littera
 * (`littera`) är låst och går före.
 */

export const OPENING_TYPES = ['Window', 'Door', 'WallHole'] as const;
export type OpeningElementType = (typeof OPENING_TYPES)[number];

interface Info {
  key: string;
  /** Sorteringen: våning, fasad, läge, id. */
  sort: [number, number, number, string];
  module: string;
  hinge: string;
}

/** Bokstaven ur formeln: `YD{nr:2}` → YD. */
export const formulaLetter = (formula: string): string => formula.replace(/\{[^}]*\}/g, '').trim();

/** Formeln med numret: `F{nr:2}` och 3 → F03; `{nr}` utan siffror. */
export function applyFormula(formula: string, n: number): string {
  if (!/\{nr(:\d+)?\}/.test(formula)) return `${formula}${String(n).padStart(2, '0')}`;
  return formula.replace(/\{nr(?::(\d+))?\}/g, (_, d: string | undefined) => (d ? String(n).padStart(Number(d), '0') : String(n)));
}

function infoOf(doc: ProjectDoc, el: Element, rule: OpeningRule, elevation: Map<Id, number>, outsides: Map<Id, 1 | -1 | null>, fromInside: boolean): Info | null {
  const host = el.host ? doc.elements[el.host] : undefined;
  if (!host) return null;
  const p = resolveParams<OpeningObjParams>(doc, el);
  const m = openingModelOf(doc, el);
  let out = outsides.get(host.id);
  if (out === undefined) outsides.set(host.id, (out = outsideSide(doc, host)));
  const kind = kindOfElementType(el.type) ?? 'window';
  const vf = viewFace(out, kind, p.swing);
  const { mirrored } = uMapping(m, vf, p.hinge ?? 'start', 0, 1);
  const hinge = hingeLetters(m, mirrored, fromInside);
  const wp = resolveParams<WallParams>(doc, host);
  const f = wallFrame(wp).local(p.at);
  const pos = f.at(p.at, 0);
  let facade = 4;
  let along = 0;
  if (out !== null) {
    const n: [number, number] = [f.n[0] * out, f.n[1] * out];
    const a = (Math.atan2(n[1], n[0]) * 180) / Math.PI;
    const bearing = (((northAngle(doc) - a) % 360) + 360) % 360;
    facade = Math.round(bearing / 90) % 4;
    // Höger sett utifrån: betraktaren tittar mot −n.
    const right: [number, number] = [-n[1], n[0]];
    along = pos[0] * right[0] + pos[1] * right[1];
  } else along = pos[0] + pos[1] * 1e-3;
  return {
    key: `${el.definition ?? '-'}|${Math.round(p.frameW)}×${Math.round(p.frameH)}${rule === 'hinge' ? `|${hinge}` : ''}`,
    sort: [elevation.get(el.storey) ?? 0, facade, Math.round(along), el.id],
    module: `${Math.round(p.width / 100)}×${Math.round(p.height / 100)}`,
    hinge,
  };
}

const cmp = (a: Info['sort'], b: Info['sort']) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || (a[3] < b[3] ? -1 : a[3] > b[3] ? 1 : 0);

interface Computed {
  littera: Map<Id, string>;
  keys: Map<Id, { type: string; key: string }>;
  /** Kombinationerna som saknar ett sparat nummer, med det de får nu. */
  missing: Record<string, Record<string, number>>;
}

const cache = new WeakMap<object, Computed>();

function compute(doc: ProjectDoc): Computed {
  const hit = cache.get(doc.elements);
  if (hit && cache.get(doc.graphics) === hit && cache.get(doc.project) === hit) return hit;
  const st = openingSettingsOf(doc.graphics);
  const elevation = new Map(buildingStoreys(doc).map((s) => [s.id, s.elevation]));
  const outsides = new Map<Id, 1 | -1 | null>();
  const fromInside = st.hingeFrom === 'inside';
  const littera = new Map<Id, string>();
  const keys = new Map<Id, { type: string; key: string }>();
  const missing: Computed['missing'] = {};
  for (const type of OPENING_TYPES) {
    const list: { el: Element; info: Info }[] = [];
    for (const id in doc.elements) {
      const el = doc.elements[id];
      if (el.type !== type) continue;
      const info = infoOf(doc, el, st.rule, elevation, outsides, fromInside);
      if (info) list.push({ el, info });
    }
    list.sort((a, b) => cmp(a.info.sort, b.info.sort));
    const formula = st.formulas[type];
    if (st.rule === 'module') {
      const letter = formulaLetter(formula) || (type === 'Door' ? 'D' : type === 'Window' ? 'F' : 'V');
      for (const { el, info } of list) littera.set(el.id, ownLittera(el) ?? `${letter} ${info.module}`);
      continue;
    }
    const stored = doc.project.openingNumbers?.[type] ?? {};
    const numbers = new Map<string, number>(Object.entries(stored));
    let max = Math.max(0, ...numbers.values());
    for (const { el, info } of list) {
      keys.set(el.id, { type, key: info.key });
      if (ownLittera(el)) continue;
      if (!numbers.has(info.key)) {
        numbers.set(info.key, ++max);
        (missing[type] ??= {})[info.key] = max;
      }
    }
    for (const { el, info } of list) littera.set(el.id, ownLittera(el) ?? applyFormula(formula, numbers.get(info.key)!));
  }
  const out = { littera, keys, missing };
  cache.set(doc.elements, out);
  cache.set(doc.graphics, out);
  cache.set(doc.project, out);
  return out;
}

const ownLittera = (el: Element): string | undefined => {
  const v = (el.params as { littera?: unknown }).littera;
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
};

/** Varje dörrs, fönsters och vägghåls littera. */
export function openingLitteras(doc: ProjectDoc): Map<Id, string> {
  return compute(doc).littera;
}

/** Nummer för nya kombinationer som ännu inte sparats (för att spara dem efter en ändring). */
export function missingOpeningNumbers(doc: ProjectDoc): Record<string, Record<string, number>> {
  return compute(doc).missing;
}

/** Kombinationens nyckel för ett objekt (för *Samma littera som …*). */
export function openingKeyOf(doc: ProjectDoc, id: Id): string | undefined {
  return compute(doc).keys.get(id)?.key;
}

/**
 * *Numrera om* (0.11.8): nya nummer i ordningen våning, fasad (N–Ö–S–V) och
 * läge, för de valda sorterna. Samma kombination får samma nummer; låsta
 * hoppas över. Returnerar projektets nya `openingNumbers`, och vad som
 * ändras (gammal → ny littera) för förhandsvisningen.
 */
export function renumberOpenings(doc: ProjectDoc, types: readonly string[]): { numbers: NonNullable<ProjectDoc['project']['openingNumbers']>; changes: { id: Id; from: string; to: string }[] } {
  const st = openingSettingsOf(doc.graphics);
  const elevation = new Map(buildingStoreys(doc).map((s) => [s.id, s.elevation]));
  const outsides = new Map<Id, 1 | -1 | null>();
  const before = openingLitteras(doc);
  const numbers = { ...(doc.project.openingNumbers ?? {}) };
  const changes: { id: Id; from: string; to: string }[] = [];
  for (const type of OPENING_TYPES) {
    if (!types.includes(type) || st.rule === 'module') continue;
    const list: { el: Element; info: Info }[] = [];
    for (const id in doc.elements) {
      const el = doc.elements[id];
      if (el.type !== type || ownLittera(el)) continue;
      const info = infoOf(doc, el, st.rule, elevation, outsides, st.hingeFrom === 'inside');
      if (info) list.push({ el, info });
    }
    list.sort((a, b) => cmp(a.info.sort, b.info.sort));
    const map: Record<string, number> = {};
    let n = 0;
    for (const { info } of list) if (!(info.key in map)) map[info.key] = ++n;
    numbers[type] = map;
    for (const { el, info } of list) {
      const to = applyFormula(st.formulas[type], map[info.key]);
      const from = before.get(el.id) ?? '';
      if (from !== to) changes.push({ id: el.id, from, to });
    }
  }
  return { numbers, changes };
}
