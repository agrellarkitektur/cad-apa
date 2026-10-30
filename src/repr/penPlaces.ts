import type { ActionKey, CategoryStyle, Material, NumberedPen, PenDef, StyleBook, StyleResources } from '../core/graphics';
import { LINE_TYPES, lineTypeDash, lineTypeList } from '../core/lineTypes';
import { isSite, type Definition, type Element, type Id, type OwnPen, type OwnPenPart, type ProjectDoc, type ViewDef } from '../core/model';
import { categoryOf, effectiveCategory, overridesFrom, putCategory, resetViewOverrides, sameValue, VIEW_TYPES, viewTypeOf, type ViewCategory, type ViewType } from '../core/viewCategories';
import { penDefault, penGroupsFor, putPen } from './penRows';
import { typeOf } from '../elements/registry';

/**
 * Ställena (0.10.36): ett ställe är en rad i en vykategori, eller i en vy
 * som avviker från sin kategori, där en objekttyp och del får sin penna,
 * linjetyp eller fyllningstyp. Pennorna är projektets numrerade pennor
 * (`penList`); ett ställe hör till pennan med samma tjocklek och färg, så
 * att ritningen läser ställenas värden som förut. Linjetyperna och
 * fyllningstyperna har ställen på samma sätt, och materialens fyllningar
 * är ställen för fyllningstyperna.
 */

export type PlaceWhere =
  | { kind: 'cat'; type: ViewType; cat: string }
  | { kind: 'view'; type: ViewType; view: string }
  | { kind: 'material'; material: string }
  /** En typs egen penna (0.10.37). */
  | { kind: 'def'; def: Id }
  /** Ett objekts egen penna (0.10.37). */
  | { kind: 'object'; id: Id };

/** Det ställena läses ur: stilboken, vyerna och objekten, och typerna och våningarna när de finns (0.10.37). */
export type PlacesDoc = Pick<ProjectDoc, 'graphics' | 'views' | 'elements'> & Partial<Pick<ProjectDoc, 'definitions' | 'storeys'>>;

export interface StylePlace {
  /** Unik nyckel: var och vad. */
  id: string;
  where: PlaceWhere;
  /** `pens.<nyckel>`, `outline.<åtgärd>`, `fill.<åtgärd>`, `mfill.<plan|cut|surface>`, `mpen` (materialets kontur) eller `own.<main|symbol|above>` (en egen penna). */
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

const ACTION_NAMES: Record<ActionKey, string> = { plain: 'Nybyggnad', existing: 'Befintligt', demolished: 'Rivs', new: 'Planerat' };
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
function placesOfStyle(res: StyleResources, c: ViewCategory, style: CategoryStyle, where: Extract<PlaceWhere, { kind: 'cat' | 'view' }>, whereName: string, viewTags: string[], only?: Set<string>): StylePlace[] {
  const out: StylePlace[] = [];
  const wk = where.kind === 'cat' ? `cat:${where.type}:${where.cat}` : `view:${where.view}`;
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
      // Åtgärdens kontur har bara färg och streckning (0.10.38): ett ställe för linjetypen, inte för en penna.
      if (act.cutOutline) {
        const o = act.cutOutline;
        add({ key: `outline.${a}`, label: `Snittets kontur, ${ACTION_NAMES[a].toLowerCase()}`, group: 'Åtgärder', tags: ['vägg', 'bjälklag', 'snitt', 'kontur', ACTION_NAMES[a].toLowerCase()], linetype: lineTypeOfDash(res, o.dash) });
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
    if (!sameValue(x.cutOutline, y.cutOutline)) keys.add(`outline.${a}`);
    if (!sameValue(x.cutFill, y.cutFill)) keys.add(`fill.${a}`);
  }
  return keys;
}

/** Alla ställen i projektet: kategoriernas, vyernas avvikelser och materialens fyllningar. */
export function stylePlaces(doc: PlacesDoc): StylePlace[] {
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
    // Materialets konturpenna i planen (0.10.37), när den är satt.
    if (m.pen?.weight) {
      const pen = plainPen(m.pen.weight, m.pen.color);
      out.push({ id: `mat:${m.id}|mpen`, where: { kind: 'material', material: m.id }, key: 'mpen', label: 'Konturen i planen', group: 'Material', whereName: `Material ${m.name}`, viewTags: ['plan', 'platsen'], tags: ['material', m.name.toLowerCase(), 'kontur'], pen });
    }
  }
  // Typernas och objektens egna pennor (0.10.37).
  for (const d of Object.values(doc.definitions ?? {})) {
    if (d.pen) out.push(...ownPlaces(d.pen, { kind: 'def', def: d.id }, `def:${d.id}`, `Typen ${d.name}`, [], [objectTypeName(d.elementType).toLowerCase(), 'typ']));
  }
  const storeyName = new Map((doc.storeys ?? []).map((x) => [x.id, x.name]));
  for (const el of Object.values(doc.elements)) {
    if (!el.pen || el.type === 'Shape2D') continue;
    const storey = isSite(el.storey) ? 'Platsen' : (storeyName.get(el.storey) ?? '');
    const name = `${objectTypeName(el.type)}${el.name ? ` ${el.name}` : ''}${storey ? `, ${storey}` : ''}`;
    out.push(...ownPlaces(el.pen, { kind: 'object', id: el.id }, `obj:${el.id}`, name, [isSite(el.storey) ? 'platsen' : 'plan'], [objectTypeName(el.type).toLowerCase(), 'objekt']));
  }
  return out;
}

/** Objekttypen som den heter i listorna (registrets namn). */
const objectTypeName = (t: string) => typeOf(t)?.label ?? t;

/** En penna utan nummer: tjockleken, och färgen bara när den inte är bläck. */
const plainPen = (weight: number, color: string | undefined): { weight: number; color?: string } => ({ weight, ...(colorKey(color) !== 'ink' ? { color } : {}) });
const OWN_PARTS = { main: { label: 'Egen penna', tag: 'snitt' }, symbol: { label: 'Egen penna, symbol', tag: 'symbol' }, above: { label: 'Egen penna, över snittet', tag: 'över snittet' } } as const;
type OwnPartKey = keyof typeof OWN_PARTS;
const ownPart = (pen: OwnPen | undefined, k: OwnPartKey): OwnPenPart | undefined => (k === 'main' ? pen : pen?.[k]);

/** Ställena i en egen penna: varje del med en tjocklek (en penna) eller en linjetyp. */
function ownPlaces(pen: OwnPen, where: PlaceWhere, wk: string, whereName: string, viewTags: string[], tags: string[]): StylePlace[] {
  const out: StylePlace[] = [];
  for (const k of Object.keys(OWN_PARTS) as OwnPartKey[]) {
    const part = ownPart(pen, k);
    if (!part || (!part.weight && part.linetype === undefined)) continue;
    out.push({
      id: `${wk}|own.${k}`,
      where,
      key: `own.${k}`,
      label: OWN_PARTS[k].label,
      group: where.kind === 'def' ? 'Typer' : 'Objekt',
      whereName,
      viewTags,
      tags: [...tags, 'egen penna', OWN_PARTS[k].tag],
      ...(part.weight ? { pen: plainPen(part.weight, part.color) } : {}),
      ...(part.linetype !== undefined ? { linetype: part.linetype } : {}),
    });
  }
  return out;
}

/** Den egna pennans del för ett ställe `own.<del>`, ändrad med `fn`; undefined om inget är kvar. */
function editOwn(pen: OwnPen | undefined, key: string, fn: (p: OwnPenPart) => void): OwnPen | undefined {
  const k = key.slice(4) as OwnPartKey;
  const next: OwnPen = structuredClone(pen ?? {});
  if (k === 'main') fn(next);
  else {
    const part: OwnPenPart = { ...next[k] };
    fn(part);
    next[k] = part;
  }
  return next;
}

/** Färgernas ordning i pennlistan: svart, grå, egna färger, vit. */
export const COLOR_RANK = (c: string) => (c === 'ink' ? 0 : c === 'muted' ? 1 : c === 'paper' ? 3 : 2);

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
      r = { pen: { no: 0, ...plainPen(p.pen.weight, p.pen.color) }, places: [] };
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
export function frozenPens(doc: PlacesDoc, places: readonly StylePlace[] = stylePlaces(doc)): NumberedPen[] {
  return penTable(doc.graphics, places).map((r) => r.pen);
}

/** Stilboken med pennlistan sparad (numren låses), om den ändrats. */
export function withFrozenPens(doc: PlacesDoc): StyleBook {
  const list = frozenPens(doc);
  const now = doc.graphics.penList ?? [];
  if (list.length === now.length && list.every((p, i) => p.no === now[i].no && penKey(p) === penKey(now[i]))) return doc.graphics;
  return { ...doc.graphics, penList: list };
}

/** Ändringen av ett ställe: i dess kategoris eller vys stil, eller i materialet. */
export interface PlaceEdit {
  style?: (style: CategoryStyle, key: string, res: StyleResources) => void;
  material?: (m: Material, key: string) => void;
  /** En del av en typs eller ett objekts egen penna (0.10.37). */
  own?: (part: OwnPenPart) => void;
}

/**
 * Ändra ställena: varje kategori och vy en gång, i stilboken och vyerna,
 * och typernas och objektens egna pennor. Svarar med de nya; materialen
 * som ändrats står i `materials` (objekten med dem behöver den nya
 * fyllningen, `relinked`).
 */
export function editPlaces(doc: PlacesDoc, places: readonly StylePlace[], edit: PlaceEdit): { book: StyleBook; views: ViewDef[]; materials: Material[]; definitions: Definition[]; elements: Element[] } {
  let book = doc.graphics;
  let views = doc.views as ViewDef[];
  const materials: Material[] = [];
  const definitions: Definition[] = [];
  const elements: Element[] = [];
  const groups = new Map<string, StylePlace[]>();
  for (const p of places) {
    const k = p.id.slice(0, p.id.indexOf('|'));
    const g = groups.get(k);
    if (g) g.push(p);
    else groups.set(k, [p]);
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
    } else if (w.kind === 'def' || w.kind === 'object') {
      const item: { pen?: OwnPen } | undefined = w.kind === 'def' ? doc.definitions?.[w.def] : doc.elements[w.id];
      if (!item || !edit.own) continue;
      let pen = item.pen;
      for (const p of list) pen = editOwn(pen, p.key, edit.own);
      if (w.kind === 'def') definitions.push({ ...(item as Definition), pen });
      else elements.push({ ...(item as Element), pen });
    } else {
      const m = book.materials?.find((x) => x.id === w.material);
      if (!m) continue;
      const next = structuredClone(m);
      for (const p of list) edit.material?.(next, p.key);
      book = { ...book, materials: book.materials!.map((x) => (x.id === m.id ? next : x)) };
      materials.push(next);
    }
  }
  return { book, views, materials, definitions, elements };
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
  material: (m, key) => {
    if (key === 'mpen') m.pen = plainPen(pen.weight, pen.color);
  },
  own: (part) => {
    part.weight = pen.weight;
    if (colorKey(pen.color) === 'ink') delete part.color;
    else part.color = pen.color;
  },
  style: (style, key) => {
    if (key.startsWith('pens.')) putPen(style, key.slice(5), (p, d) => ((p.weight = pen.weight), setColor(p, d, pen.color)));
  },
});

/** Ställets linjetyp. */
export const setLineTypeEdit = (lt: string): PlaceEdit => ({
  own: (part) => {
    part.linetype = lt;
  },
  style: (style, key, res) => {
    if (key.startsWith('pens.')) {
      putPen(style, key.slice(5), (p, d) => {
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
