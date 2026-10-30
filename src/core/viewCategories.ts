import { COLOUR_CODED, POCHE, SWEDISH_STANDARD, type ActionKey, type ActionStyle, type CategoryStyle, type PenDef, type StyleBook, type StyleSheet } from './graphics';
import { isSite, type Id, type ProjectDoc, type SiteCategory, type ViewDef } from './model';
import { normalizeUnderlays, type ViewUnderlay } from './viewUnderlays';

/**
 * Stilboken i tre nivåer med arv (0.10.32): projektets resurser (pennor,
 * linjetyper, fyllningstyper, material, text) → en vykategori per vytyp →
 * den enskilda vyn. En vy följer sin kategori och får avvika rad för rad
 * (`ViewDef.overrides`); det som inte avviker ändras med kategorin.
 *
 * En kategori har två delar: *visningen* (det vyns Visa-meny styr:
 * detaljnivåer, jämförelsen, det som döljs) och *stilen* (åtgärderna,
 * öppningsmarkeringen och penntabellen, förut projektets stilmall).
 */

export type DetailLevel = 'sketch' | 'normal' | 'detail';

/** Vytyperna i stilboken. Varje vy hör till en, efter var den ritas. */
export type ViewType = 'site' | 'storey' | 'facade' | 'section' | 'worksheet';

/** Vytyperna i vänsterkanten, i ordning; de utan `type` kommer senare och är tonade. */
export const VIEW_TYPES: readonly { type?: ViewType; name: string; icon: string; later?: string }[] = [
  { type: 'site', name: 'Platsen', icon: 'site' },
  { type: 'storey', name: 'Våningar', icon: 'storey' },
  { type: 'facade', name: 'Fasader', icon: 'elevation' },
  { type: 'section', name: 'Sektioner', icon: 'section' },
  { name: '3D-vyer', icon: 'cube', later: 'Kommer med 3D-vyerna (0.12.1)' },
  { type: 'worksheet', name: 'Arbetsblad', icon: 'worksheet' },
  { name: 'Uppställningar', icon: 'sheet', later: 'Efter pilotprojektet' },
  { name: 'Förteckningar', icon: 'list', later: 'Efter pilotprojektet' },
];

/** Det som vyns Visa-meny styr; vyns egna värden är avvikelser från det här. */
export interface CategoryShow {
  compare: boolean;
  detail: DetailLevel;
  labelDetail: DetailLevel;
  modelDetail: DetailLevel;
  /** Det som döljs (eller med plus tänds), som förut i vyn. */
  hide: string[];
  hideDemolished: boolean;
  /** Underlagen i vyn (0.10.35), nedifrån och upp. Utelämnade = inga. */
  underlays?: ViewUnderlay[];
}

export interface ViewCategory {
  id: string;
  name: string;
  type: ViewType;
  /** Platsens kategorier: hur materialen ritas (planen, situationsplanen eller illustrationsplanen). */
  kind?: SiteCategory;
  /** Skalan för nya vyer med kategorin (nämnaren). Vyn har sin egen skala. */
  scale: number;
  show: CategoryShow;
  style: CategoryStyle;
}

/**
 * En vys avvikelser från kategorin, en rad per nyckel:
 * - `compare`, `detail`, `labelDetail`, `modelDetail`, `hideDemolished`: visningen.
 * - `hide:<nyckel>`: sant = döljs (eller tänds med `+`), falskt = som kategorin utan den.
 * - `underlays`: hela listan med underlag (0.10.35), när den skiljer sig från kategorins.
 * - `actions.<åtgärd>`, `openingMark`, `pens.<nyckel>` (null = programmets förval): stilen.
 */
export type ViewOverrides = Record<string, unknown>;

const SHOW_KEYS = ['compare', 'detail', 'labelDetail', 'modelDetail', 'hideDemolished'] as const;
const isStyleKey = (k: string) => k === 'openingMark' || k.startsWith('actions.') || k.startsWith('pens.');

/** Stilen ur en förinställning: åtgärderna, markeringen och pennorna. */
export const styleOfPreset = (p: StyleSheet): CategoryStyle => structuredClone({ actions: p.actions, openingMark: p.openingMark, ...(p.pens ? { pens: p.pens } : {}) });

/** Förinställningarna som en kategoris stil kan kopieras från (förut vyns stilmall). */
export const stylePresets = (): { id: string; name: string; style: CategoryStyle }[] => [SWEDISH_STANDARD, POCHE, COLOUR_CODED].map((p, i) => ({ id: ['svensk', 'poche', 'farg'][i], name: p.name, style: styleOfPreset(p) }));

const SHOW: CategoryShow = { compare: true, detail: 'normal', labelDetail: 'normal', modelDetail: 'normal', hide: [], hideDemolished: false };

const cat = (id: string, name: string, type: ViewType, scale: number, show: Partial<CategoryShow> = {}, kind?: SiteCategory, preset: StyleSheet = SWEDISH_STANDARD): ViewCategory => ({
  id,
  name,
  type,
  ...(kind ? { kind } : {}),
  scale,
  show: { ...structuredClone(SHOW), ...structuredClone(show) },
  style: styleOfPreset(preset),
});

/** Det som döljs i planer utan inredning (0.10.33): möbler, dörrarnas öppningssätt och öppningarnas littera. */
const BARE = ['Furniture', 'swing', 'littera:Door', 'littera:Window'];

/**
 * Kategorierna i ett nytt projekt: Platsens tre förinställningar (0.10.25)
 * och en förvalskategori för var och en av de andra vytyperna, med det
 * som förut var projektets stilmall.
 */
export function defaultCategories(): ViewCategory[] {
  return [
    // Gränser, grannhus, träd, huset, höjdkurvorna och markobjektens höjder; inga markörer.
    cat('situation', 'Situationsplan', 'site', 400, { compare: false, hide: ['Elevation', 'Section', 'BasisFacade', 'littera:Ground'] }, 'situation'),
    // Allt om marken, också de branta slänterna och stödmurarnas littera.
    cat('grading', 'Markplaneringsritning', 'site', 200, { compare: false, hide: ['Elevation', 'Section', 'BasisFacade', '+steepSlopes'] }, 'grading'),
    // Färglagd och mindre teknisk: utan höjdkurvor, mått, littera och markörer.
    cat('illustration', 'Illustrationsplan', 'site', 200, { compare: false, hide: ['Terrain', 'Elevation', 'Section', 'BasisFacade', 'Dimension', 'Label', 'littera:Ground'] }, 'illustration'),
    cat('plan', 'Plan', 'storey', 100),
    // Förslagen i Ny vy… (0.10.33): planen med mått och littera utan möbler, undertaket och golvet.
    cat('matt', 'Mått och littera', 'storey', 100, { hide: ['Furniture'] }),
    cat('undertak', 'Undertak', 'storey', 50, { hide: [...BARE, 'littera:Wall', 'Dimension'] }),
    cat('golv', 'Golvplan', 'storey', 50, { hide: [...BARE, 'littera:Wall'] }),
    // Förinställningarna som egna kategorier (0.10.33): svart poché, och statusen i färg.
    cat('poche', 'Poché', 'storey', 100, {}, undefined, POCHE),
    cat('farg', 'Färgmarkerad', 'storey', 100, {}, undefined, COLOUR_CODED),
    cat('fasad', 'Fasad', 'facade', 100),
    cat('fasad-farg', 'Färgmarkerad', 'facade', 100, {}, undefined, COLOUR_CODED),
    cat('sektion', 'Sektion', 'section', 100),
    cat('sektion-poche', 'Poché', 'section', 100, {}, undefined, POCHE),
    cat('sektion-farg', 'Färgmarkerad', 'section', 100, {}, undefined, COLOUR_CODED),
    cat('arbetsblad', 'Arbetsblad', 'worksheet', 100),
  ];
}

/** Vytypen för ett ställe: ett arbetsblad, en fasad eller sektion, Platsen eller en våning. */
export function viewTypeAt(doc: Pick<ProjectDoc, 'elements'>, storey: Id, marker?: Id | null, worksheet?: Id | null): ViewType {
  if (worksheet) return 'worksheet';
  if (marker && doc.elements[marker]) return doc.elements[marker].type === 'Section' ? 'section' : 'facade';
  return isSite(storey) ? 'site' : 'storey';
}

export const viewTypeOf = (doc: Pick<ProjectDoc, 'elements'>, v: Pick<ViewDef, 'storey' | 'marker' | 'worksheet'>) => viewTypeAt(doc, v.storey, v.marker, v.worksheet);

/** Kategorin med nyckeln, om den hör till vytypen; annars vytypens första. */
export function categoryOf(book: Pick<StyleBook, 'categories'>, type: ViewType, id?: string | null): ViewCategory {
  return book.categories.find((c) => c.id === id && c.type === type) ?? book.categories.find((c) => c.type === type) ?? defaultCategories().find((c) => c.type === type)!;
}

export const categoriesOf = (book: Pick<StyleBook, 'categories'>, type: ViewType) => book.categories.filter((c) => c.type === type);

/** Visningen som den gäller: kategorins med vyns avvikelser. */
export function resolveShow(c: ViewCategory, ov: ViewOverrides | undefined): CategoryShow {
  const s = structuredClone(c.show);
  if (!ov) return s;
  for (const k of SHOW_KEYS) if (k in ov) (s as unknown as Record<string, unknown>)[k] = ov[k];
  for (const [k, v] of Object.entries(ov)) {
    if (!k.startsWith('hide:')) continue;
    const key = k.slice(5);
    s.hide = v ? (s.hide.includes(key) ? s.hide : [...s.hide, key]) : s.hide.filter((h) => h !== key);
  }
  if ('underlays' in ov) {
    const u = normalizeUnderlays(ov.underlays);
    if (u.length) s.underlays = u;
    else delete s.underlays;
  }
  return s;
}

/** Underlagen i en visning, utan utelämnade. */
export const underlaysOf = (s: Pick<CategoryShow, 'underlays'>): ViewUnderlay[] => s.underlays ?? [];

/** Avvikelserna i visningen: det i `show` som skiljer sig från kategorin, rad för rad. */
export function showOverrides(c: ViewCategory, show: CategoryShow): ViewOverrides {
  const ov: ViewOverrides = {};
  for (const k of SHOW_KEYS) if (show[k] !== c.show[k]) ov[k] = show[k];
  for (const h of show.hide) if (!c.show.hide.includes(h)) ov[`hide:${h}`] = true;
  for (const h of c.show.hide) if (!show.hide.includes(h)) ov[`hide:${h}`] = false;
  if (!sameValue(underlaysOf(show), underlaysOf(c.show))) ov.underlays = structuredClone(underlaysOf(show));
  return ov;
}

/** Bara stilens avvikelser. */
export const styleOverrides = (ov: ViewOverrides | undefined): ViewOverrides => Object.fromEntries(Object.entries(ov ?? {}).filter(([k]) => isStyleKey(k)));

/** Vyns avvikelser med visningen utbytt mot `show` (stilens avvikelser är kvar). */
export function withShow(c: ViewCategory, ov: ViewOverrides | undefined, show: CategoryShow): ViewOverrides | undefined {
  const out = { ...styleOverrides(ov), ...showOverrides(c, show) };
  return Object.keys(out).length ? out : undefined;
}

/** JSON med nycklarna i ordning, så att två lika värden jämförs lika oavsett ordningen. */
const canon = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));
export const sameValue = (a: unknown, b: unknown) => canon(a) === canon(b);

/** Stilens avvikelser (0.10.33): det i `style` som skiljer sig från `base`, rad för rad. */
export function styleDiff(base: CategoryStyle, style: CategoryStyle): ViewOverrides {
  const ov: ViewOverrides = {};
  for (const k of Object.keys(style.actions) as ActionKey[]) if (!sameValue(style.actions[k], base.actions[k])) ov[`actions.${k}`] = structuredClone(style.actions[k]);
  if ((style.openingMark ?? 0) !== (base.openingMark ?? 0)) ov.openingMark = style.openingMark;
  for (const k of new Set([...Object.keys(base.pens ?? {}), ...Object.keys(style.pens ?? {})])) {
    const a = base.pens?.[k];
    const b = style.pens?.[k];
    if (!sameValue(a ?? null, b ?? null)) ov[`pens.${k}`] = b ? structuredClone(b) : null;
  }
  return ov;
}

/**
 * Kategorin som vyn ser ut med (0.10.33): kategorins visning och stil med
 * vyns avvikelser. Den ändras i stilboken när en vy är vald, och
 * avvikelserna räknas fram igen med `overridesFrom`.
 */
export const effectiveCategory = (c: ViewCategory, ov: ViewOverrides | undefined): ViewCategory => ({ ...c, show: resolveShow(c, ov), style: resolveStyle(c, ov) });

/** Avvikelserna som gör `c` till `cur`, eller undefined när de är lika. Det som inte avviker längre försvinner. */
export function overridesFrom(c: ViewCategory, cur: ViewCategory): ViewOverrides | undefined {
  const ov = { ...showOverrides(c, cur.show), ...styleDiff(c.style, cur.style) };
  return Object.keys(ov).length ? ov : undefined;
}

/** Hur många rader vyn verkligen avviker på (en sparad avvikelse som kategorin hunnit få räknas inte). */
export function deviationCount(doc: Pick<ProjectDoc, 'graphics' | 'elements'>, v: ViewDef): number {
  if (!v.overrides) return 0;
  const c = categoryOf(doc.graphics, viewTypeOf(doc, v), v.category);
  return Object.keys(overridesFrom(c, effectiveCategory(c, v.overrides)) ?? {}).length;
}

/** Stilen som den gäller: kategorins med vyns avvikelser. */
export function resolveStyle(c: ViewCategory, ov: ViewOverrides | undefined): CategoryStyle {
  const keys = Object.keys(ov ?? {}).filter(isStyleKey);
  if (!keys.length) return c.style;
  const s = structuredClone(c.style);
  for (const k of keys) {
    const v = ov![k];
    if (k === 'openingMark') s.openingMark = Number(v) || 0;
    else if (k.startsWith('actions.')) s.actions[k.slice(8) as ActionKey] = v as ActionStyle;
    else {
      const pens = { ...s.pens };
      if (v) pens[k.slice(5)] = v as PenDef;
      else delete pens[k.slice(5)];
      s.pens = pens;
    }
  }
  return s;
}

/**
 * Stilmallen som ritningen ritas med: stilbokens resurser och kategorins
 * stil med vyns avvikelser. Samma kategori och avvikelser ger samma objekt
 * så länge stilboken är densamma, så att planens cache träffar.
 */
const sheets = new WeakMap<StyleBook, Map<string, StyleSheet>>();
export function sheetFor(book: StyleBook, c: ViewCategory, ov?: ViewOverrides): StyleSheet {
  const so = styleOverrides(ov);
  const key = `${c.type}:${c.id}:${JSON.stringify(so)}`;
  let m = sheets.get(book);
  if (!m) sheets.set(book, (m = new Map()));
  let s = m.get(key);
  if (!s) {
    const { categories: _c, format: _f, version: _v, ...res } = book;
    m.set(key, (s = { ...res, ...resolveStyle(c, so), format: 'bacchus-style', version: 1 }));
  }
  return s;
}

/** Stilmallen för en vytyp utan vy: den första kategorins (formerna i panelen, 3D-marken …). */
export const defaultSheet = (book: StyleBook, type: ViewType = 'storey') => sheetFor(book, categoryOf(book, type));

/** En vys kategori, visning och stilmall som de gäller. */
export function viewSettings(doc: Pick<ProjectDoc, 'graphics' | 'elements'>, v: ViewDef): { cat: ViewCategory; show: CategoryShow; kind?: SiteCategory; style: StyleSheet; type: ViewType } {
  const type = viewTypeOf(doc, v);
  const c = categoryOf(doc.graphics, type, v.category);
  return { cat: c, type, show: resolveShow(c, v.overrides), ...(c.kind ? { kind: c.kind } : {}), style: sheetFor(doc.graphics, c, v.overrides) };
}

/** Vyerna som har kategorin (0.10.33), i projektets ordning. */
export const viewsWithCategory = (doc: Pick<ProjectDoc, 'graphics' | 'elements' | 'views'>, c: ViewCategory) => doc.views.filter((v) => viewTypeOf(doc, v) === c.type && categoryOf(doc.graphics, c.type, v.category) === c);

/** Hur många vyer som har kategorin. */
export const categoryUses = (doc: Pick<ProjectDoc, 'graphics' | 'elements' | 'views'>, c: ViewCategory) => viewsWithCategory(doc, c).length;

const withUnderlays = (v: unknown) => {
  const u = normalizeUnderlays(v);
  return u.length ? { underlays: u } : {};
};

/** Kategorier från fil: de utan namn eller vytyp hoppas över, och varje vytyp får minst en. */
export function normalizeCategories(v: unknown, fallbackStyle: CategoryStyle): ViewCategory[] {
  const types = new Set(VIEW_TYPES.map((t) => t.type).filter(Boolean));
  const out: ViewCategory[] = [];
  const level = (x: unknown, d: DetailLevel): DetailLevel => (x === 'sketch' || x === 'normal' || x === 'detail' ? x : d);
  for (const c of Array.isArray(v) ? v : []) {
    if (!c || typeof c !== 'object' || typeof c.id !== 'string' || !types.has(c.type) || out.some((o) => o.id === c.id && o.type === c.type)) continue;
    const s = c.show ?? {};
    const detail = level(s.detail, 'normal');
    out.push({
      id: c.id,
      name: typeof c.name === 'string' && c.name.trim() ? c.name.trim() : c.id,
      type: c.type,
      ...(c.type === 'site' && ['situation', 'grading', 'illustration'].includes(c.kind) ? { kind: c.kind } : {}),
      scale: Number(c.scale) > 0 ? Number(c.scale) : 100,
      show: { compare: s.compare !== false, detail, labelDetail: level(s.labelDetail, detail), modelDetail: level(s.modelDetail, detail), hide: Array.isArray(s.hide) ? s.hide.map(String) : [], hideDemolished: s.hideDemolished === true, ...withUnderlays(s.underlays) },
      style: c.style && typeof c.style === 'object' && c.style.actions ? c.style : structuredClone(fallbackStyle),
    });
  }
  for (const d of defaultCategories()) if (!out.some((c) => c.type === d.type)) out.push({ ...d, style: structuredClone(fallbackStyle) });
  return out;
}

/**
 * Ändra en kategoris stil, och resurserna, med en funktion som ändrar en
 * stilmall (stilmallens delar i `src/ui/style/` gör så). Svarar med den nya
 * stilboken och funktionens svar; ingen ändring = null.
 */
export function editCategory<T>(book: StyleBook, c: ViewCategory, fn: (sheet: StyleSheet) => T): { book: StyleBook; result: T } {
  const r = editStyle(book, c.style, fn);
  return { book: { ...r.book, categories: book.categories.map((x) => (x === c ? { ...x, style: r.style } : x)) }, result: r.result };
}

/**
 * Ändra en stil (en kategoris eller den en vy ser ut med) och resurserna
 * med en funktion som ändrar en stilmall. Svarar med stilboken med de nya
 * resurserna (kategorierna orörda), den nya stilen och funktionens svar.
 */
export function editStyle<T>(book: StyleBook, style: CategoryStyle, fn: (sheet: StyleSheet) => T): { book: StyleBook; style: CategoryStyle; result: T } {
  const { categories: _c, format: _bf, version: _bv, ...resources } = book;
  const sheet: StyleSheet = { ...structuredClone(resources), ...structuredClone(style), format: 'bacchus-style', version: 1 };
  const result = fn(sheet);
  const { actions, openingMark, pens, format: _f, version: _v, ...res } = sheet;
  return { book: { ...book, ...res }, style: { actions, openingMark, ...(pens && Object.keys(pens).length ? { pens } : {}) }, result };
}

/** Samma ändring i alla kategoriers stil (markörernas penna, som gäller hela projektet). */
export function editAllCategories<T>(book: StyleBook, fn: (sheet: StyleSheet) => T): { book: StyleBook; result: T | undefined } {
  let result: T | undefined;
  for (const c of [...book.categories]) {
    const now = book.categories.find((x) => x.id === c.id && x.type === c.type)!;
    const r = editCategory(book, now, fn);
    book = r.book;
    result ??= r.result;
  }
  return { book, result };
}

// ---------- Kategorierna i stilboken (dialogens flikar) ----------

const replaceCat = (book: StyleBook, c: ViewCategory, next: ViewCategory): StyleBook => ({ ...book, categories: book.categories.map((x) => (x === c ? next : x)) });

/** En nyckel som inte finns bland vytypens kategorier, ur namnet. */
function freshId(book: StyleBook, type: ViewType, name: string): string {
  const base =
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'kategori';
  const taken = new Set(categoriesOf(book, type).map((c) => c.id));
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  return id;
}

/** Ett namn som inte finns bland vytypens kategorier. */
function freshName(book: StyleBook, type: ViewType, name: string): string {
  const taken = new Set(categoriesOf(book, type).map((c) => c.name));
  let out = name;
  for (let n = 2; taken.has(out); n++) out = `${name} ${n}`;
  return out;
}

/** Lägg till en kategori efter `after` (eller sist bland vytypens). */
function insertAfter(book: StyleBook, c: ViewCategory, after?: ViewCategory): StyleBook {
  const list = [...book.categories];
  const at = after ? list.indexOf(after) + 1 : list.map((x) => x.type).lastIndexOf(c.type) + 1 || list.length;
  list.splice(at, 0, c);
  return { ...book, categories: list };
}

/** Kopia av en kategori, direkt efter den. */
export function duplicateCategory(book: StyleBook, c: ViewCategory): { book: StyleBook; cat: ViewCategory } {
  const name = freshName(book, c.type, `${c.name} (kopia)`);
  const cat = { ...structuredClone(c), id: freshId(book, c.type, name), name };
  return { book: insertAfter(book, cat, c), cat };
}

/** En ny kategori med vytypens förval, sist bland vytypens. */
export function newCategory(book: StyleBook, type: ViewType, name = 'Ny kategori'): { book: StyleBook; cat: ViewCategory } {
  const d = defaultCategories().find((x) => x.type === type)!;
  const n = freshName(book, type, name);
  const cat = { ...d, id: freshId(book, type, n), name: n };
  return { book: insertAfter(book, cat), cat };
}

export function renameCategory(book: StyleBook, c: ViewCategory, name: string): StyleBook {
  const n = name.trim();
  return n && n !== c.name ? replaceCat(book, c, { ...c, name: n }) : book;
}

/**
 * Kopiera från en annan kategori eller en förinställning: en kategori av
 * samma vytyp ger allt utom namnet; en av en annan vytyp och en
 * förinställning ger bara stilen.
 */
export function copyCategoryFrom(book: StyleBook, c: ViewCategory, from: ViewCategory | { style: CategoryStyle }): StyleBook {
  if ('type' in from && from.type === c.type) {
    const { id: _i, name: _n, ...rest } = structuredClone(from);
    return replaceCat(book, c, { ...c, ...rest });
  }
  return replaceCat(book, c, { ...c, style: structuredClone(from.style) });
}

/** Kategorins förval: förvalskategorin med samma nyckel, annars vytypens första, med kategorins nyckel och namn. */
export function categoryDefault(c: Pick<ViewCategory, 'id' | 'name' | 'type'>): ViewCategory {
  const d = defaultCategories().find((x) => x.type === c.type && x.id === c.id) ?? defaultCategories().find((x) => x.type === c.type)!;
  return { ...d, id: c.id, name: c.name };
}

/** Tillbaka till förvalet. Namnet är kvar. */
export function resetCategory(book: StyleBook, c: ViewCategory): StyleBook {
  return replaceCat(book, c, categoryDefault(c));
}

/** Ta bort en kategori; den sista av en vytyp går inte att ta bort. Vyerna med den får vytypens första. */
export function deleteCategory(doc: Pick<ProjectDoc, 'graphics' | 'views' | 'elements'>, c: ViewCategory): { book: StyleBook; views: ViewDef[] } | null {
  if (categoriesOf(doc.graphics, c.type).length < 2) return null;
  const book = { ...doc.graphics, categories: doc.graphics.categories.filter((x) => x !== c) };
  const views = doc.views.map((v) => {
    if (viewTypeOf(doc, v) !== c.type || v.category !== c.id) return v;
    const { category: _c, ...rest } = v;
    return rest;
  });
  return { book, views };
}

/** Ändra en kategoris visning, skala eller sort (Platsens). */
export function updateCategory(book: StyleBook, c: ViewCategory, patch: Partial<Pick<ViewCategory, 'show' | 'scale' | 'kind'>>): StyleBook {
  return replaceCat(book, c, { ...c, ...structuredClone(patch) });
}

/** Flytta en kategori ett steg bland vytypens. */
export function moveCategory(book: StyleBook, c: ViewCategory, dir: -1 | 1): StyleBook {
  const list = [...book.categories];
  const i = list.indexOf(c);
  let j = i + dir;
  while (j >= 0 && j < list.length && list[j].type !== c.type) j += dir;
  if (i < 0 || j < 0 || j >= list.length) return book;
  [list[i], list[j]] = [list[j], list[i]];
  return { ...book, categories: list };
}

/** En stilmall i alla kategorier, med resurserna (prov, och förinställningar för hela projektet). */
export const bookWithSheet = (book: StyleBook, sheet: StyleSheet): StyleBook => editAllCategories(book, (s) => void Object.assign(s, structuredClone(sheet))).book;

/** Lägg `next` i stället för kategorin med samma nyckel och vytyp. */
export const putCategory = (book: StyleBook, next: ViewCategory): StyleBook => ({ ...book, categories: book.categories.map((x) => (x.id === next.id && x.type === next.type ? next : x)) });

// ---------- En vy och dess kategori (0.10.33) ----------

const withoutOverrides = (v: ViewDef): ViewDef => {
  const { overrides: _o, ...rest } = v;
  return rest;
};

/** Vyerna med vyn `id` utan avvikelser: tillbaka till kategorin. */
export const resetViewOverrides = (views: readonly ViewDef[], id: string): ViewDef[] => views.map((v) => (v.id === id ? withoutOverrides(v) : v));

/**
 * Gör vyns avvikelser till kategorins förval: kategorin får det vyn ser ut
 * med, och vyn följer den utan avvikelser. Andra vyer med kategorin följer
 * med, med sina egna avvikelser kvar.
 */
export function viewToCategoryDefault(doc: Pick<ProjectDoc, 'graphics' | 'elements' | 'views'>, id: string): { book: StyleBook; views: ViewDef[] } | null {
  const v = doc.views.find((x) => x.id === id);
  if (!v) return null;
  const c = categoryOf(doc.graphics, viewTypeOf(doc, v), v.category);
  const cur = effectiveCategory(c, v.overrides);
  return { book: replaceCat(doc.graphics, c, { ...c, show: cur.show, style: cur.style }), views: resetViewOverrides(doc.views, id) };
}

/** Spara vyns utseende som en ny kategori direkt efter dess, och låt vyn följa den nya utan avvikelser. */
export function viewToNewCategory(doc: Pick<ProjectDoc, 'graphics' | 'elements' | 'views'>, id: string, name: string): { book: StyleBook; views: ViewDef[]; cat: ViewCategory } | null {
  const v = doc.views.find((x) => x.id === id);
  if (!v || !name.trim()) return null;
  const c = categoryOf(doc.graphics, viewTypeOf(doc, v), v.category);
  const cur = effectiveCategory(c, v.overrides);
  const n = freshName(doc.graphics, c.type, name.trim());
  const next: ViewCategory = { ...structuredClone(cur), id: freshId(doc.graphics, c.type, n), name: n };
  return { book: insertAfter(doc.graphics, next, c), views: doc.views.map((x) => (x.id === id ? { ...withoutOverrides(x), category: next.id } : x)), cat: next };
}
