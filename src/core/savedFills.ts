import type { SavedFill, StyleSheet } from './graphics';
import type { Element, Id } from './model';
import type { DocStore } from './store';
import { effectiveFill, FILL_FIELDS, type FillParams } from '../elements/drawing2d';

/**
 * Sparade fyllningar i stilmallen (0.10.14). Ett objekt kopplas till en
 * sparad fyllning med `fillStyle` och har dessutom en kopia av dess fält,
 * så att det ser likadant ut om den sparade tas bort. Fyllningen kan ligga
 * direkt i objektets parametrar eller i en egen parameter (`nested`, t.ex.
 * slänternas `slopeFill`).
 */

/** Objektets fyllning: direkt i parametrarna eller i parametern `nested`. */
export function fillOfElement(el: Element, nested?: string): Partial<FillParams> {
  const params = el.params as Record<string, unknown>;
  return (nested ? (params[nested] ?? {}) : params) as Partial<FillParams>;
}

/** Objektet med fyllningen `fill` (hela fyllningens fält byts ut). */
export function withFill(el: Element, fill: Partial<FillParams>, nested?: string): Element {
  const params = { ...el.params } as Record<string, unknown>;
  if (nested) {
    if (fill.fill === undefined) delete params[nested];
    else params[nested] = fill;
    return { ...el, params };
  }
  for (const k of [...FILL_FIELDS, 'fillStyle'] as const) {
    if ((fill as Record<string, unknown>)[k] === undefined) delete params[k];
    else params[k] = (fill as Record<string, unknown>)[k];
  }
  return { ...el, params };
}

/** Bara fyllningens fält (utan kopplingen). */
export function fillFieldsOf(p: Partial<FillParams>): Partial<FillParams> {
  const out: Record<string, unknown> = {};
  for (const k of FILL_FIELDS) if ((p as Record<string, unknown>)[k] !== undefined) out[k] = (p as Record<string, unknown>)[k];
  return out as Partial<FillParams>;
}

/** En ny nyckel som inte krockar med någon annan sparad fyllning. */
function newId(style: StyleSheet): string {
  const used = new Set((style.fills ?? []).map((f) => f.id));
  let i = 1;
  while (used.has(`sparad-${i}`)) i++;
  return `sparad-${i}`;
}

/** Varje objekt (och slänterna) som är kopplat till `id` får `fn` på fyllningen. */
function eachLinked(doc: { elements: Record<Id, Element> }, id: string, fn: (el: Element, nested?: string) => Element | null): Element[] {
  const out: Element[] = [];
  for (const el of Object.values(doc.elements)) {
    let next: Element | null = el;
    if ((el.params as Record<string, unknown>).fillStyle === id) next = fn(next) ?? next;
    const slope = (el.params as Record<string, unknown>).slopeFill as Partial<FillParams> | undefined;
    if (slope?.fillStyle === id) next = fn(next, 'slopeFill') ?? next;
    if (next !== el) out.push(next);
  }
  return out;
}

/**
 * Spara objektets fyllning i stilmallen med namnet `name` och koppla
 * objekten `ids` till den. Finns redan en sparad med samma namn skrivs den
 * över, och alla objekt som är kopplade till den följer med. Svarar med den
 * sparades nyckel.
 */
export function saveFill(store: DocStore, ids: Id[], name: string, nested?: string): string | null {
  const doc = store.doc;
  const first = ids.map((id) => doc.elements[id]).find(Boolean);
  const style = doc.graphics;
  if (!first || !name.trim()) return null;
  const now = effectiveFill(fillOfElement(first, nested) as FillParams, style);
  const fields = { ...fillFieldsOf(now), fillOpacity: now.fillOpacity ?? now.opacity ?? 100 };
  if (!fields.fill) return null;
  const old = (style.fills ?? []).find((f) => f.name.toLowerCase() === name.trim().toLowerCase());
  const id = old?.id ?? newId(style);
  const saved: SavedFill = { id, name: old?.name ?? name.trim(), ...fields };
  store.transact(old ? `Uppdatera sparad fyllning: ${saved.name}` : `Spara fyllning: ${saved.name}`, (tx) => {
    tx.setGraphics({ ...style, fills: old ? style.fills!.map((f) => (f.id === id ? saved : f)) : [...(style.fills ?? []), saved] });
    const link = (el: Element, n?: string) => withFill(el, { ...fields, fillStyle: id }, n);
    for (const el of eachLinked(tx.doc, id, link)) tx.putElement(el);
    for (const eid of ids) {
      const el = tx.doc.elements[eid];
      if (el) tx.putElement(link(el, nested));
    }
  });
  return id;
}

/** Koppla objekten till den sparade fyllningen `id` (med en kopia av dess fält), eller koppla loss dem (`null`). */
export function linkFill(store: DocStore, ids: Id[], id: string | null, nested?: string): void {
  const style = store.doc.graphics;
  const saved = id ? style.fills?.find((f) => f.id === id) : undefined;
  if (id && !saved) return;
  store.transact(saved ? `Fyllning: ${saved.name}` : 'Egen fyllning', (tx) => {
    for (const eid of ids) {
      const el = tx.doc.elements[eid];
      if (!el) continue;
      // Kopplad: en kopia av den sparades fält. Loss: det som syntes, som objektets egna.
      const fill = saved ? { ...fillFieldsOf(saved as Partial<FillParams>), fillStyle: saved.id } : fillFieldsOf(effectiveFill(fillOfElement(el, nested) as FillParams, style));
      tx.putElement(withFill(el, fill, nested));
    }
  });
}

/** Ta bort den sparade fyllningen; objekten som var kopplade behåller hur de ser ut. */
export function deleteSavedFill(store: DocStore, id: string): void {
  const style = store.doc.graphics;
  const saved = style.fills?.find((f) => f.id === id);
  if (!saved) return;
  store.transact(`Ta bort sparad fyllning: ${saved.name}`, (tx) => {
    for (const el of eachLinked(tx.doc, id, (e, n) => withFill(e, fillFieldsOf(saved as Partial<FillParams>), n))) tx.putElement(el);
    const rest = style.fills!.filter((f) => f.id !== id);
    const next = { ...style };
    if (rest.length) next.fills = rest;
    else delete next.fills;
    tx.setGraphics(next);
  });
}
