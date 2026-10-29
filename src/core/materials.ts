import type { Material, MaterialUse, StyleSheet } from './graphics';
import type { Element, Id } from './model';
import type { DocStore } from './store';
import { effectiveFill, FILL_FIELDS, type FillParams } from '../elements/drawing2d';

/**
 * Materialen (0.10.28, ersätter de sparade fyllningarna från 0.10.14). Ett
 * material bor i stilmallen; ett objekt kopplas till det med `material` och
 * har dessutom en kopia av planens fyllning, så att det ser likadant ut om
 * materialet tas bort. Fyllningen kan ligga direkt i objektets parametrar
 * eller i en egen parameter (`nested`, t.ex. slänternas `slopeFill`).
 * Opaciteten och vridningen kan överstyras per objekt (`materialOpacity`,
 * `materialAngle`).
 */

/** Kopplingens fält: materialet och objektets egna överstyrningar. */
const LINK_FIELDS = ['material', 'materialOpacity', 'materialAngle'] as const;

/** Objektets fyllning: direkt i parametrarna eller i parametern `nested`. */
export function fillOfElement(el: Element, nested?: string): Partial<FillParams> {
  const params = el.params as Record<string, unknown>;
  return (nested ? (params[nested] ?? {}) : params) as Partial<FillParams>;
}

/** Objektet med fyllningen `fill` (fyllningens och kopplingens fält byts ut). */
export function withFill(el: Element, fill: Partial<FillParams>, nested?: string): Element {
  const params = { ...el.params } as Record<string, unknown>;
  if (nested) {
    if (fill.fill === undefined && fill.material === undefined) delete params[nested];
    else params[nested] = fill;
    return { ...el, params };
  }
  for (const k of [...FILL_FIELDS, ...LINK_FIELDS] as const) {
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

/** Fyllningens och kopplingens fält. */
function linkedFieldsOf(p: Partial<FillParams>): Partial<FillParams> {
  const out = fillFieldsOf(p) as Record<string, unknown>;
  for (const k of LINK_FIELDS) if ((p as Record<string, unknown>)[k] !== undefined) out[k] = (p as Record<string, unknown>)[k];
  return out as Partial<FillParams>;
}

/** En ny nyckel som inte krockar med något annat material. */
function newId(style: StyleSheet, name: string): string {
  const used = new Set((style.materials ?? []).map((m) => m.id));
  const base =
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'material';
  let id = base;
  for (let i = 2; used.has(id); i++) id = `${base}-${i}`;
  return id;
}

/** Varje objekt (och slänterna) med materialet `id` får `fn` på fyllningen. */
function eachLinked(doc: { elements: Record<Id, Element> }, id: string, fn: (el: Element, nested?: string) => Element): Element[] {
  const out: Element[] = [];
  for (const el of Object.values(doc.elements)) {
    let next = el;
    if ((el.params as Record<string, unknown>).material === id) next = fn(next);
    const slope = (el.params as Record<string, unknown>).slopeFill as Partial<FillParams> | undefined;
    if (slope?.material === id) next = fn(next, 'slopeFill');
    if (next !== el) out.push(next);
  }
  return out;
}

/** Hur många objekt (och slänter) som har materialet. */
export function materialUses(doc: { elements: Record<Id, Element> }, id: string): number {
  let n = 0;
  for (const el of Object.values(doc.elements)) {
    if ((el.params as Record<string, unknown>).material === id) n++;
    if (((el.params as Record<string, unknown>).slopeFill as Partial<FillParams> | undefined)?.material === id) n++;
  }
  return n;
}

/**
 * Vilka material som passar objektet (0.10.28.1): markobjekten markens,
 * bjälklag och tak byggnadens; 2D-former och rum alla (`undefined`).
 */
export function useOf(el: Pick<Element, 'type'> | undefined): MaterialUse | undefined {
  if (el?.type === 'Ground') return 'ground';
  if (el?.type === 'Slab' || el?.type === 'Roof') return 'building';
  return undefined;
}

/** Om materialet passar `use` (alla passar när `use` saknas). */
export function materialFits(m: Material, use: MaterialUse | undefined): boolean {
  return !use || m[use];
}

/** Objektet kopplat till materialet `m`: en kopia av planens fyllning, objektets överstyrningar kvar. */
function linkTo(el: Element, m: Material, nested?: string): Element {
  const now = fillOfElement(el, nested);
  const keep: Partial<FillParams> = {};
  if (now.material === m.id) {
    if (now.materialOpacity !== undefined) keep.materialOpacity = now.materialOpacity;
    if (now.materialAngle !== undefined) keep.materialAngle = now.materialAngle;
  }
  const rest = nested ? Object.fromEntries(Object.entries(now).filter(([k]) => !(FILL_FIELDS as readonly string[]).includes(k) && !(LINK_FIELDS as readonly string[]).includes(k))) : {};
  return withFill(el, { ...rest, ...fillFieldsOf(m.plan as Partial<FillParams>), material: m.id, ...keep } as Partial<FillParams>, nested);
}

/** Objektet utan materialet: det som syntes i planen, som objektets egen fyllning. */
function unlink(el: Element, style: StyleSheet, nested?: string): Element {
  const now = fillOfElement(el, nested);
  const rest = nested ? Object.fromEntries(Object.entries(now).filter(([k]) => !(FILL_FIELDS as readonly string[]).includes(k) && !(LINK_FIELDS as readonly string[]).includes(k))) : {};
  return withFill(el, { ...rest, ...fillFieldsOf(effectiveFill(now as FillParams, style)) } as Partial<FillParams>, nested);
}

/**
 * Spara objektets fyllning som ett material med namnet `name` och koppla
 * objekten `ids` till det. Finns redan ett med samma namn skrivs planens
 * fyllning över, och alla objekt med det följer med. Svarar med nyckeln.
 */
export function saveMaterial(store: DocStore, ids: Id[], name: string, nested?: string): string | null {
  const doc = store.doc;
  const first = ids.map((id) => doc.elements[id]).find(Boolean);
  const style = doc.graphics;
  if (!first || !name.trim()) return null;
  const now = effectiveFill(fillOfElement(first, nested) as FillParams, style);
  const plan = { ...fillFieldsOf(now), fillOpacity: now.fillOpacity ?? now.opacity ?? 100 };
  if (!plan.fill) return null;
  const old = (style.materials ?? []).find((m) => m.name.toLowerCase() === name.trim().toLowerCase());
  const m: Material = old ? { ...old, plan } : { id: newId(style, name.trim()), name: name.trim(), ground: useOf(first) === 'ground', building: useOf(first) === 'building', plan };
  store.transact(old ? `Uppdatera material: ${m.name}` : `Nytt material: ${m.name}`, (tx) => {
    tx.setGraphics({ ...style, materials: old ? style.materials!.map((q) => (q.id === m.id ? m : q)) : [...(style.materials ?? []), m] });
    for (const el of eachLinked(tx.doc, m.id, (e, n) => linkTo(e, m, n))) tx.putElement(el);
    for (const eid of ids) {
      const el = tx.doc.elements[eid];
      if (el) tx.putElement(linkTo(el, m, nested));
    }
  });
  return m.id;
}

/** Koppla objekten till materialet `id`, eller koppla loss dem (`null`, *Eget*). */
export function linkMaterial(store: DocStore, ids: Id[], id: string | null, nested?: string): void {
  const style = store.doc.graphics;
  const m = id ? style.materials?.find((q) => q.id === id) : undefined;
  if (id && !m) return;
  store.transact(m ? `Material: ${m.name}` : 'Eget', (tx) => {
    for (const eid of ids) {
      const el = tx.doc.elements[eid];
      if (el) tx.putElement(m ? linkTo(el, m, nested) : unlink(el, style, nested));
    }
  });
}

/**
 * Ändra materialet `id` (`fn` får det och svarar med det nya); objekten med
 * det får den nya planens fyllning. `label` är ångra-texten.
 */
export function updateMaterial(store: DocStore, id: string, label: string, fn: (m: Material) => Material): void {
  const style = store.doc.graphics;
  const old = style.materials?.find((q) => q.id === id);
  if (!old) return;
  const m = fn(structuredClone(old));
  store.transact(label, (tx) => {
    tx.setGraphics({ ...style, materials: style.materials!.map((q) => (q.id === id ? m : q)) });
    for (const el of eachLinked(tx.doc, id, (e, n) => linkTo(e, m, n))) tx.putElement(el);
  });
}

/** Ta bort materialet; objekten med det behåller hur de ser ut i planen och blir *Eget*. */
export function deleteMaterial(store: DocStore, id: string): void {
  const style = store.doc.graphics;
  const m = style.materials?.find((q) => q.id === id);
  if (!m) return;
  store.transact(`Ta bort material: ${m.name}`, (tx) => {
    for (const el of eachLinked(tx.doc, id, (e, n) => unlink(e, style, n))) tx.putElement(el);
    const rest = style.materials!.filter((q) => q.id !== id);
    const next = { ...style };
    if (rest.length) next.materials = rest;
    else delete next.materials;
    tx.setGraphics(next);
  });
}

/** Överstyr objektens opacitet eller vridning (0.10.28); `undefined` följer materialet igen. */
export function overrideMaterial(store: DocStore, ids: Id[], key: 'materialOpacity' | 'materialAngle', value: number | undefined, nested?: string): void {
  store.transact(key === 'materialOpacity' ? 'Ändra opacitet' : 'Vrid mönstret', (tx) => {
    for (const eid of ids) {
      const el = tx.doc.elements[eid];
      if (!el) continue;
      const now = fillOfElement(el, nested);
      if (!now.material) continue;
      const next = { ...linkedFieldsOf(now), ...(nested ? Object.fromEntries(Object.entries(now).filter(([k]) => !(FILL_FIELDS as readonly string[]).includes(k) && !(LINK_FIELDS as readonly string[]).includes(k))) : {}) } as Record<string, unknown>;
      if (value === undefined) delete next[key];
      else next[key] = value;
      tx.putElement(withFill(el, next as Partial<FillParams>, nested));
    }
  });
}

/**
 * Ett nytt material i stilmallen (0.10.28.1): grått och helt, för marken.
 * Svarar med nyckeln.
 */
export function addMaterial(store: DocStore, name = 'Nytt material'): string {
  const style = store.doc.graphics;
  let n = name;
  for (let i = 2; (style.materials ?? []).some((m) => m.name.toLowerCase() === n.toLowerCase()); i++) n = `${name} ${i}`;
  const m: Material = { id: newId(style, n), name: n, ground: true, building: false, plan: { fill: 'solid', fillColor: '#c9c6bf', fillOpacity: 80 }, color3d: '#bdbab3' };
  store.transact(`Nytt material: ${n}`, (tx) => tx.setGraphics({ ...style, materials: [...(style.materials ?? []), m] }));
  return m.id;
}

/** Flytta materialet ett steg i listan (`-1` upp, `1` ned); listorna i panelen följer ordningen. */
export function moveMaterial(store: DocStore, id: string, step: -1 | 1): void {
  const style = store.doc.graphics;
  const list = [...(style.materials ?? [])];
  const i = list.findIndex((m) => m.id === id);
  const j = i + step;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  store.transact(`Flytta material: ${list[j].name}`, (tx) => tx.setGraphics({ ...style, materials: list }));
}
