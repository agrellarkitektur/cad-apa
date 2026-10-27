import { modelViewId, type Element, type Id, type ProjectDoc } from './model';

/**
 * Synlighet för 2D-element, text och mått (format 5). Ett element hör hemma
 * på en yta: våningens plan, en fasad, en sektion eller ett arbetsblad. Utan
 * `show` syns det i alla vyer av den ytan; med `show` bara i vissa vyer
 * (uppräknade, eller vyer med vissa vy-taggar).
 */

/** En vy som något kan synas i: en sparad vy eller en modellvy. */
export interface ViewIdentity {
  /** Den sparade vyns id, eller `modelViewId(yta)` för modellvyn. */
  id: Id;
  /** Ytan vyn visar: våningens, fasadens, sektionens eller arbetsbladets id. */
  place: Id;
  /** Vyns vy-taggar. Modellvyer har inga. */
  tags: readonly string[];
}

/** Ytan elementet hör hemma på. */
export function homeOf(el: Pick<Element, 'storey' | 'space'>): Id {
  return el.space ?? el.storey;
}

/** Om elementet syns i vyn. Element utan `show` syns på sin egen yta. */
export function shownIn(el: Pick<Element, 'storey' | 'space' | 'show'>, view: ViewIdentity): boolean {
  const s = el.show;
  if (!s) return homeOf(el) === view.place;
  if (s.kind === 'views') return s.views.includes(view.id);
  if (homeOf(el) !== view.place || !s.tags.length) return false;
  return s.match === 'all' ? s.tags.every((t) => view.tags.includes(t)) : s.tags.some((t) => view.tags.includes(t));
}

/** Ytan en sparad vy visar. */
export function placeOfView(v: { storey: Id; marker?: Id | null; worksheet?: Id | null }): Id {
  return v.worksheet ?? v.marker ?? v.storey;
}

/**
 * Alla vyer i projektet: modellvyn av varje våning, fasad, sektion och
 * arbetsblad, och de sparade vyerna. Används för "Syns nu i N vyer" och
 * listan med kryssrutor under Visas i.
 */
export function allViews(doc: ProjectDoc): (ViewIdentity & { name: string; model: boolean })[] {
  const out: (ViewIdentity & { name: string; model: boolean })[] = [];
  for (const s of doc.storeys) out.push({ id: modelViewId(s.id), place: s.id, tags: [], name: `${s.name} · modell`, model: true });
  for (const el of Object.values(doc.elements)) {
    if (el.type !== 'Section' && el.type !== 'Elevation') continue;
    out.push({ id: modelViewId(el.id), place: el.id, tags: [], name: el.name ?? '', model: true });
  }
  for (const w of doc.worksheets) out.push({ id: modelViewId(w.id), place: w.id, tags: [], name: w.name, model: true });
  for (const v of doc.views) out.push({ id: v.id, place: placeOfView(v), tags: v.tags ?? [], name: v.name, model: false });
  return out;
}

/** Hur många vyer elementet syns i, med `show` utbytt mot ett förslag. */
export function countViews(doc: ProjectDoc, el: Pick<Element, 'storey' | 'space' | 'show'>): number {
  return allViews(doc).filter((v) => shownIn(el, v)).length;
}

/**
 * Dolda objekt (0.10.15): ett enskilt objekt döljs i en vy med `obj:` och
 * objektets id i vyns `hide`, bredvid de dolda typerna.
 */
export const HIDDEN_OBJECT = 'obj:';

/** Nyckeln i vyns `hide` som döljer ett enskilt objekt. */
export function hiddenObjectKey(id: Id): string {
  return HIDDEN_OBJECT + id;
}

/** Id för de enskilt dolda objekten i en vys `hide`. */
export function hiddenObjects(hide: readonly string[] | undefined): Id[] {
  return (hide ?? []).filter((h) => h.startsWith(HIDDEN_OBJECT)).map((h) => h.slice(HIDDEN_OBJECT.length));
}

/**
 * Om objektet är dolt i vyn, för sig eller genom sin typ (0.10.15). En dörr
 * eller ett fönster följer väggen: döljs väggen döljs öppningarna i den.
 */
export function hiddenBy(doc: Pick<ProjectDoc, 'elements'>, el: Pick<Element, 'id' | 'type' | 'host'>, hide: readonly string[] | undefined, objects?: ReadonlySet<Id>): boolean {
  if (!hide?.length) return false;
  const objs = objects ?? new Set(hiddenObjects(hide));
  if (hide.includes(el.type) || objs.has(el.id)) return true;
  const host = el.host ? doc.elements[el.host] : undefined;
  return !!host && (hide.includes(host.type) || objs.has(host.id));
}
