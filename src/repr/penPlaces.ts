import type { ActionKey, CategoryStyle, LineDef, Material, NumberedPen, PenDef, StyleBook, StyleResources } from '../core/graphics';
import { LINE_TYPES, lineTypeDash, lineTypeList } from '../core/lineTypes';
import type { ProjectDoc, ViewDef } from '../core/model';
import { categoryOf, effectiveCategory, overridesFrom, putCategory, resetViewOverrides, VIEW_TYPES, viewTypeOf, type ViewCategory, type ViewType } from '../core/viewCategories';
import { penDefault, penGroupsFor, penRowOf } from './penRows';

/**
 * Ställena (0.10.36): ett ställe är en rad i en vykategori, eller i en vy
 * som avviker från sin kategori, där en objekttyp och del får sin penna,
 * linjetyp eller fyllningstyp. Pennorna är projektets numrerade pennor
 * (`penList`); ett ställe hör till pennan med samma tjocklek och färg, så
 * att ritningen läser ställenas värden som förut. Linjetyperna och
 * fyllningstyperna har ställen på samma sätt, och materialens fyllningar
 * är ställen för fyllningstyperna.
 */

export type PlaceWhere = { kind: 'cat'; type: ViewType; cat: string } | { kind: 'view'; type: ViewType; view: string } | { kind: 'material'; material: string };

export interface StylePlace {
  /** Unik nyckel: var och vad. */
  id: string;
  where: PlaceWhere;
  /** `pens.<nyckel>`, `outline.<åtgärd>`, `fill.<åtgärd>` eller `mfill.<plan|cut|surface>`. */
  key: string;
  label: string;
  /** Gruppen (rubriken) raden står under. */
  group: string;
  /** Kategorin, vyn eller materialet, som det står i listan. */
  whereName: string;
  /** Automatiska taggar: vytypen (plan, fasad, illustrationsplan …) och objektet och delen (vägg, snitt, mått …). */
  viewTags: string[];
  tags: string[];
  /** Pennan som den gäller (pennornas och linjetypernas ställen). */
  pen?: PenDef;
  /** Linjetypens nyckel; '' = en streckning som inte är en linjetyp. */
  linetype?: string;
  /** Fyllningstypens nyckel (fyllningstypernas ställen). */
  fillType?: string;
}

export const ACTION_NAMES: Record<ActionKey, string> = { plain: 'Nybyggnad', existing: 'Befintligt', demolished: 'Rivs', new: 'Planerat' };
const ACTIONS = Object.keys(ACTION_NAMES) as ActionKey[];
const TYPE_TAG: Record<ViewType, string> = { site: 'platsen', storey: 'plan', facade: 'fasad', section: 'sektion', worksheet: 'arbetsblad' };
const KIND_TAG: Record<string, string> = { situation: 'situationsplan', grading: 'markplanering', illustration: 'illustrationsplan' };
const MAT_FILLS = { plan: 'Planen', cut: 'Snittet', surface: 'Ytan i fasad' } as const;
/** Vytyperna där väggarnas snitt ritas (åtgärdernas kontur och fyllning). */
const CUT_TYPES: readonly ViewType[] = ['storey', 'facade', 'section'];

const typeName = (t: ViewType) => VIEW_TYPES.find((x) => x.type === t)?.name ?? t;
const viewTagsOf = (c: ViewCategory) => [TYPE_TAG[c.type], ...(c.type === 'site' && KIND_TAG[c.kind ?? 'situation'] ? [KIND_TAG[c.kind ?? 'situation']] : [])];

/** Färgen som den jämförs: svart utan färg, annars som den står (gemener). */
export const colorKey = (c: string | undefined) => (!c || c === 'ink' ? 'ink' : c.toLowerCase());
/** Pennans nyckel: tjocklek och färg. */
export const penKey = (p: { weight: number; color?: string }) => `${p.weight}|${colorKey(p.color)}`;

/** Linjetypen för en streckning (konturens): heldragen, en med samma mönster, eller ''. */
function lineTypeOfDash(res: StyleResources, dash: readonly number[] | undefined): string {
  if (!dash?.length) return 'solid';
  return lineTypeList(res).find((t) => t.dash.length === dash.length && t.dash.every((x, i) => x === dash[i]))?.id ?? '';
}

/** Pennan som en rad ger: förvalet med kategorins värden ovanpå. */
const effectivePenDef = (style: CategoryStyle, k: string): PenDef => ({ ...penDefault(k), ...style.pens?.[k] });

/** Ställena i en stil (kategorins eller den en vy ser ut med); `only` begränsar till de nycklar vyn avviker på. */
function placesOfStyle(res: StyleResources, c: ViewCategory, style: CategoryStyle, where: PlaceWhere, whereName: string, viewTags: string[], only?: Set<string>): StylePlace[] {
  const out: StylePlace[] = [];
  const wk = where.kind === 'cat' ? `cat:${where.type}:${where.cat}` : where.kind === 'view' ? `view:${where.view}` : `mat:${where.material}`;
  const add = (p: Omit<StylePlace, 'id' | 'where' | 'whereName' | 'viewTags'>) => {
    if (!only || only.has(p.key)) out.push({ id: `${wk}|${p.key}`, where, whereName, viewTags, ...p });
  };
  for (const g of penGroupsFor(c.type)) {
    for (const r of g.rows) {
      const pen = effectivePenDef(style, r.key);
      add({ key: `pens.${r.key}`, label: r.label, group: g.title, tags: [...r.tags], pen, linetype: pen.linetype ?? 'solid' });
    }
  }
  if (CUT_TYPES.includes(c.type)) {
    for (const a of ACTIONS) {
      const act = style.actions[a];
      if (act.cutOutline) {
        const o = act.cutOutline;
        add({ key: `outline.${a}`, label: `Snittets kontur, ${ACTION_NAMES[a].toLowerCase()}`, group: 'Åtgärder', tags: ['vägg', 'bjälklag', 'snitt', 'kontur', ACTION_NAMES[a].toLowerCase()], pen: { weight: o.weight, ...(colorKey(o.color) !== 'ink' ? { color: o.color } : {}) }, linetype: lineTypeOfDash(res, o.dash) });
      }
      if (act.cutFill.kind === 'type') add({ key: `fill.${a}`, label: `Snittets fyllning, ${ACTION_NAMES[a].toLowerCase()}`, group: 'Åtgärder', tags: ['vägg', 'bjälklag', 'snitt', 'fyllning', ACTION_NAMES[a].toLowerCase()], fillType: act.cutFill.type });
    }
  }
  return out;
}

/** Ställena som en vy avviker på: de nycklar i stilen som skiljer från kategorin. */
function viewKeys(c: ViewCategory, cur: CategoryStyle): Set<string> {
  const keys = new Set<string>();
  for (const k of new Set([...Object.keys(c.style.pens ?? {}), ...Object.keys(cur.pens ?? {})])) {
    if (penKey(effectivePenDef(c.style, k)) !== penKey(effectivePenDef(cur, k)) || (effectivePenDef(c.style, k).linetype ?? 'solid') !== (effectivePenDef(cur, k).linetype ?? 'solid')) keys.add(`pens.${k}`);
  }
  for (const a of ACTIONS) {
    const x = c.style.actions[a];
    const y = cur.actions[a];
    if (JSON.stringify(x.cutOutline) !== JSON.stringify(y.cutOutline)) keys.add(`outline.${a}`);
    if (JSON.stringify(x.cutFill) !== JSON.stringify(y.cutFill)) keys.add(`fill.${a}`);
  }
  return keys;
}

/** Alla ställen i projektet: kategoriernas, vyernas avvikelser och materialens fyllningar. */
export function stylePlaces(doc: Pick<ProjectDoc, 'graphics' | 'views' | 'elements'>): StylePlace[] {
  const book = doc.graphics;
  const out: StylePlace[] = [];
  for (const c of book.categories) out.push(...placesOfStyle(book, c, c.style, { kind: 'cat', type: c.type, cat: c.id }, `${typeName(c.type)} › ${c.name}`, viewTagsOf(c)));
  for (const v of doc.views) {
    if (!v.overrides) continue;
    const type = viewTypeOf(doc, v);
    const c = categoryOf(book, type, v.category);
    const cur = effectiveCategory(c, v.overrides).style;
    const keys = viewKeys(c, cur);
    if (keys.size) out.push(...placesOfStyle(book, c, cur, { kind: 'view', type, view: v.id }, `Vyn ${v.name}`, [...viewTagsOf(c), 'vy'], keys));
  }
  for (const m of book.materials ?? []) {
    for (const f of Object.keys(MAT_FILLS) as (keyof typeof MAT_FILLS)[]) {
      const fill = m[f] as { fill?: string; fillType?: string } | undefined;
      if (fill?.fill === 'type' && fill.fillType) {
        const where: PlaceWhere = { kind: 'material', material: m.id };
        out.push({ id: `mat:${m.id}|mfill.${f}`, where, key: `mfill.${f}`, label: `${MAT_FILLS[f]}`, group: 'Material', whereName: `Material ${m.name}`, viewTags: f === 'plan' ? ['plan', 'platsen'] : f === 'cut' ? ['sektion', 'plan'] : ['fasad'], tags: ['material', m.name.toLowerCase()], fillType: fill.fillType });
      }
    }
  }
  return out;
}

const COLOR_RANK = (c: string) => (c === 'ink' ? 0 : c === 'muted' ? 1 : c === 'paper' ? 3 : 2);

/** Ordningen i pennlistan som förval (0.10.36): efter färg och sedan tjocklek. */
export function penOrder(a: { weight: number; color?: string }, b: { weight: number; color?: string }): number {
  const ca = colorKey(a.color);
  const cb = colorKey(b.color);
  return COLOR_RANK(ca) - COLOR_RANK(cb) || (ca < cb ? -1 : ca > cb ? 1 : 0) || a.weight - b.weight;
}

/**
 * Pennlistan med ställena (0.10.36): projektets sparade pennor, och efter
 * dem de tjocklekar och färger som ställena har men listan saknar,
 * numrerade i tur och ordning efter färg och tjocklek. Varje ställe hör
 * till pennan med samma tjocklek och färg.
 */
export function penTable(book: Pick<StyleBook, 'penList'>, places: readonly StylePlace[]): { pen: NumberedPen; places: StylePlace[] }[] {
  const rows = (book.penList ?? []).map((pen) => ({ pen, places: [] as StylePlace[] }));
  const byKey = new Map(rows.map((r) => [penKey(r.pen), r]));
  const extra: { pen: NumberedPen; places: StylePlace[] }[] = [];
  for (const p of places) {
    if (!p.pen) continue;
    const k = penKey(p.pen);
    let r = byKey.get(k);
    if (!r) {
      r = { pen: { no: 0, weight: p.pen.weight, ...(colorKey(p.pen.color) !== 'ink' ? { color: p.pen.color } : {}) }, places: [] };
      byKey.set(k, r);
      extra.push(r);
    }
    r.places.push(p);
  }
  let no = rows.reduce((m, r) => Math.max(m, r.pen.no), 0);
  for (const r of extra.sort((a, b) => penOrder(a.pen, b.pen))) r.pen.no = ++no;
  return [...rows, ...extra];
}

/** Pennlistan som den sparas: varje tjocklek och färg som ett ställe har får ett nummer, sparade pennor är kvar. */
export function frozenPens(doc: Pick<ProjectDoc, 'graphics' | 'views' | 'elements'>): NumberedPen[] {
  return penTable(doc.graphics, stylePlaces(doc)).map((r) => r.pen);
}

/** Stilboken med pennlistan sparad (numren låses), om den ändrats. */
export function withFrozenPens(doc: Pick<ProjectDoc, 'graphics' | 'views' | 'elements'>): StyleBook {
  const list = frozenPens(doc);
  const now = doc.graphics.penList ?? [];
  if (list.length === now.length && list.every((p, i) => p.no === now[i].no && penKey(p) === penKey(now[i]))) return doc.graphics;
  return { ...doc.graphics, penList: list };
}

/** Ändringen av ett ställe: i dess kategoris eller vys stil, eller i materialet. */
export interface PlaceEdit {
  style?: (style: CategoryStyle, key: string, res: StyleResources) => void;
  material?: (m: Material, key: string) => void;
}

/**
 * Ändra ställena: varje kategori och vy en gång, i stilboken och vyerna.
 * Svarar med de nya; materialen som ändrats står i `materials` (objekten
 * med dem behöver den nya fyllningen, `relinked`).
 */
export function editPlaces(doc: Pick<ProjectDoc, 'graphics' | 'views' | 'elements'>, places: readonly StylePlace[], edit: PlaceEdit): { book: StyleBook; views: ViewDef[]; materials: Material[] } {
  let book = doc.graphics;
  let views = doc.views as ViewDef[];
  const materials: Material[] = [];
  const groups = new Map<string, StylePlace[]>();
  for (const p of places) {
    const k = p.id.slice(0, p.id.indexOf('|'));
    groups.set(k, [...(groups.get(k) ?? []), p]);
  }
  for (const list of groups.values()) {
    const w = list[0].where;
    if (w.kind === 'cat') {
      const c = categoryOf(book, w.type, w.cat);
      const style = structuredClone(c.style);
      for (const p of list) edit.style?.(style, p.key, book);
      book = putCategory(book, { ...c, style });
    } else if (w.kind === 'view') {
      const v = views.find((x) => x.id === w.view);
      if (!v) continue;
      const c = categoryOf(book, w.type, v.category);
      const cur = structuredClone(effectiveCategory(c, v.overrides));
      for (const p of list) edit.style?.(cur.style, p.key, book);
      const ov = overridesFrom(c, cur);
      views = ov ? views.map((x) => (x.id === v.id ? { ...x, overrides: ov } : x)) : resetViewOverrides(views, v.id);
    } else {
      const m = book.materials?.find((x) => x.id === w.material);
      if (!m) continue;
      const next = structuredClone(m);
      for (const p of list) edit.material?.(next, p.key);
      book = { ...book, materials: book.materials!.map((x) => (x.id === m.id ? next : x)) };
      materials.push(next);
    }
  }
  return { book, views, materials };
}

/** Penntabellens rad med nya värden; förvalet sparas inte (som `applyPenField`). */
function putPenRow(style: CategoryStyle, k: string, fn: (p: PenDef, d: PenDef) => void): void {
  const d = penDefault(k);
  const p: PenDef = { ...d, ...style.pens?.[k] };
  fn(p, d);
  const pens = { ...style.pens };
  if (p.weight === d.weight && p.color === d.color && (p.linetype ?? undefined) === d.linetype) delete pens[k];
  else pens[k] = p;
  if (Object.keys(pens).length) style.pens = pens;
  else delete style.pens;
}

/** Färgen i penntabellen: svart utan färg, utom när förvalet har en (då sparas svart). */
function setColor(p: PenDef, d: PenDef, color: string | undefined): void {
  if (colorKey(color) === 'ink') {
    if (d.color) p.color = 'ink';
    else delete p.color;
  } else p.color = color;
}

/** Ställets penna: tjockleken och färgen (linjetypen är kvar). */
export const setPenEdit = (pen: { weight: number; color?: string }): PlaceEdit => ({
  style: (style, key) => {
    if (key.startsWith('pens.')) putPenRow(style, key.slice(5), (p, d) => ((p.weight = pen.weight), setColor(p, d, pen.color)));
    else if (key.startsWith('outline.')) {
      const a = style.actions[key.slice(8) as ActionKey];
      const color = (colorKey(pen.color) === 'ink' ? 'ink' : pen.color) as LineDef['color'];
      if (a.cutOutline) a.cutOutline = { ...a.cutOutline, weight: pen.weight, color };
      a.lines = { ...a.lines, color };
    }
  },
});

/** Ställets linjetyp. */
export const setLineTypeEdit = (lt: string): PlaceEdit => ({
  style: (style, key, res) => {
    if (key.startsWith('pens.')) {
      putPenRow(style, key.slice(5), (p, d) => {
        if (lt === 'solid' && !d.linetype) delete p.linetype;
        else p.linetype = lt;
      });
    } else if (key.startsWith('outline.')) {
      const a = style.actions[key.slice(8) as ActionKey];
      const dash = lineTypeDash(res, lt);
      if (a.cutOutline) {
        const { dash: _d, ...o } = a.cutOutline;
        a.cutOutline = dash ? { ...o, dash: [...dash] } : o;
      }
      const { dash: _l, ...l } = a.lines;
      a.lines = dash ? { ...l, dash: [...dash] } : l;
    }
  },
});

/** Ställets fyllningstyp: åtgärdens snitt eller materialets fyllning. */
export const setFillTypeEdit = (type: string): PlaceEdit => ({
  style: (style, key) => {
    if (!key.startsWith('fill.')) return;
    const a = style.actions[key.slice(5) as ActionKey];
    if (a.cutFill.kind === 'type') a.cutFill = { ...a.cutFill, type };
  },
  material: (m, key) => {
    const f = key.slice(6) as keyof typeof MAT_FILLS;
    const fill = m[f] as Record<string, unknown> | undefined;
    if (fill?.fill === 'type') (m as unknown as Record<string, unknown>)[f] = { ...fill, fillType: type };
  },
});

/** Namnet på en linjetyp, för listorna. */
export const lineTypeName = (res: StyleResources, id: string) => (id ? (LINE_TYPES[id]?.name ?? res.lineTypes?.find((t) => t.id === id)?.name ?? 'Borttagen linjetyp') : 'Egen streckning');

/** Raden för en nyckel i en kategori finns (gruppen visas i vytypen). */
export const placeRowExists = (type: ViewType, key: string) => !key.startsWith('pens.') || !!penRowOf(key.slice(5))?.group.types.includes(type);
