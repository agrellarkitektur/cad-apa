import { PRESETS, type StyleSheet } from '../core/graphics';
import { onPaper, modelViewId, type Element, type Id, type ProjectDoc, type Sheet, type ViewDef, type Viewport, type Worksheet } from '../core/model';
import { FRAME_MARGIN, masterOf, paperSize } from '../core/sheets';
import { defaultState, existingState, type ViewStates } from '../core/states';
import { markerName } from '../elements/markers';
import { textWidth } from '../formats/drawingFont';
import { clipPrims } from '../geometry/clipRect';
import { buildPlan, type Pickable } from './plan';
import { boundsOf, type Bounds, type Primitive, type Vec2 } from './primitives';
import { buildSection } from './section';
import { smartVars } from './smartText';

/**
 * Ritningsblad (0.8 del 3): mallbladets grafik (0.8.8), vyerna ritade i sin
 * skala på papperet och det som är ritat direkt på bladet (0.8.9). Allt anges i mm på papperet med
 * nollpunkten i nedre vänstra hörnet och y uppåt, så att skärmen och
 * PDF-exporten ritar samma primitiver.
 *
 * En vy på ett blad (`Viewport`) har `at`: var vyns nollpunkt (modellens
 * 0,0, eller fasadens och sektionens början) hamnar på papperet. Vyn visar
 * det som är ritat i den med lite luft runt; underlag som är större klipps
 * mot den ramen. En vy kan också ha en egen ram (`crop`, 0.8.7) i modellens
 * koordinater; då klipps allt mot den.
 */

/** Det en vy på ett blad kan visa: en sparad vy eller modellvyn av en våning, fasad, sektion eller ett arbetsblad. */
export interface ViewSource {
  id: Id;
  name: string;
  /** Den sparade vyn, eller inställningarna som modellvyn ritas med. */
  def: ViewDef;
}

/** Luften runt det som är ritat i en vy på ett blad, mm på papperet. */
export const VIEWPORT_PAD = 4;

/** Det en vy på ett blad pekar på, eller null om vyn eller det den visar har tagits bort. */
export function viewSource(doc: ProjectDoc, ref: Id): ViewSource | null {
  const saved = doc.views.find((v) => v.id === ref);
  if (saved) {
    if (saved.marker && !doc.elements[saved.marker]) return null;
    if (saved.worksheet && !doc.worksheets.some((w) => w.id === saved.worksheet && !onPaper(w))) return null;
    return { id: ref, name: saved.name, def: saved };
  }
  if (!ref.startsWith('modell:')) return null;
  const place = ref.slice('modell:'.length);
  const ex = existingState(doc);
  const base = {
    id: ref,
    state: defaultState(doc),
    compare: !!ex,
    detail: 'normal' as const,
    hide: [],
    hideDemolished: false,
  };
  const storey = doc.storeys.find((s) => s.id === place);
  if (storey) return { id: ref, name: storey.name, def: { ...base, name: storey.name, storey: storey.id } };
  const el = doc.elements[place];
  if (el && (el.type === 'Section' || el.type === 'Elevation')) {
    const name = markerName(doc, el);
    return { id: ref, name, def: { ...base, name, storey: el.storey, marker: el.id } };
  }
  const ws = doc.worksheets.find((w) => w.id === place);
  if (ws && !onPaper(ws)) return { id: ref, name: ws.name, def: { ...base, name: ws.name, storey: doc.storeys[0].id, worksheet: ws.id } };
  return null;
}

/** Allt som går att lägga på ett blad: sparade vyer först, sedan modellvyerna. */
export function placeableViews(doc: ProjectDoc): ViewSource[] {
  const out: ViewSource[] = [];
  for (const v of doc.views) {
    const s = viewSource(doc, v.id);
    if (s) out.push(s);
  }
  const places = [
    ...doc.storeys.map((s) => s.id),
    ...Object.values(doc.elements)
      .filter((e) => e.type === 'Elevation' || e.type === 'Section')
      .map((e) => e.id),
    ...doc.worksheets.filter((w) => !onPaper(w)).map((w) => w.id),
  ];
  for (const p of places) {
    const s = viewSource(doc, modelViewId(p));
    if (s) out.push(s);
  }
  return out;
}

export interface ViewPrimOptions {
  /** Skalans nämnare; texter och mått ritas för den (annoteringsskalan). */
  scale: number;
  /** Måttsätt det nya automatiskt, som på skärmen. */
  autoDims?: boolean;
}

function styleOf(doc: ProjectDoc, name: string | undefined): StyleSheet {
  const preset = name ? PRESETS.find((p) => p.name === name) : undefined;
  const g = doc.graphics;
  return preset ? { ...preset, labels: g.labels, ...(g.lineTypes ? { lineTypes: g.lineTypes } : {}), ...(g.fillTypes ? { fillTypes: g.fillTypes } : {}) } : g;
}

/**
 * Det som ritats i en fasad eller sektion, delat i det som ligger under
 * modellen och det som ligger över: underlagen, och sedan 0.10.10 de
 * fyllningar och linjer i 2D-formerna som ligger bakom (ritordningen, som
 * bakom väggarna i planen).
 */
export function splitPlaced(prims: readonly Primitive[]): { under: Primitive[]; over: Primitive[] } {
  const under: Primitive[] = [];
  const over: Primitive[] = [];
  for (const q of prims) (q.origin?.objectType === 'Underlay' || q.under ? under : over).push(q);
  return { under, over };
}

/** En vys inställningar som de gäller när den ritas. */
export function viewStatesFor(doc: ProjectDoc, v: ViewDef, opt: ViewPrimOptions): ViewStates {
  const ex = existingState(doc);
  return {
    state: v.state,
    compareTo: v.compare && ex && ex.id !== v.state ? ex.id : undefined,
    detail: v.detail,
    labelDetail: v.labelDetail,
    modelDetail: v.modelDetail,
    hide: v.hide,
    hideDemolished: v.hideDemolished,
    autoDims: opt.autoDims,
    viewId: v.id,
    viewTags: v.tags ?? [],
    scale: opt.scale,
  };
}

/** En vys primitiver i modellens (eller fasadens och sektionens) koordinater. */
export function buildViewPrims(doc: ProjectDoc, v: ViewDef, opt: ViewPrimOptions): Primitive[] {
  const vs = viewStatesFor(doc, v, opt);
  const style = styleOf(doc, v.style);
  if (v.marker) {
    const marker = doc.elements[v.marker];
    const section = marker ? buildSection(doc, marker.id, vs, style) : null;
    if (!marker || !section) return [];
    const drawn = buildPlan(doc, marker.storey, { ...vs, place: marker.id }, style);
    const { under, over } = splitPlaced(drawn.prims);
    return [...under, ...section.prims, ...over];
  }
  if (v.worksheet) return buildPlan(doc, v.storey, { ...vs, place: v.worksheet }, style).prims;
  return buildPlan(doc, v.storey, vs, style).prims;
}

/** Vyerna som senast ritades, så att ett blad inte räknar om fasader och sektioner vid varje panorering. */
const cache = new WeakMap<ProjectDoc, Map<string, Primitive[]>>();

/**
 * Projektet som vyerna ritas ur (0.8.11): utan bladen och det som är ritat
 * på dem, som ingen vy visar. Det blir samma objekt så länge bara bladen
 * ändrats, så att en flyttad vy eller en text på bladet inte räknar om alla
 * fasader och sektioner på bladet.
 */
const modelDocs = new WeakMap<ProjectDoc, ProjectDoc>();
let lastModel: ProjectDoc | null = null;
function modelDoc(doc: ProjectDoc): ProjectDoc {
  const hit = modelDocs.get(doc);
  if (hit) return hit;
  const sheetIds = new Set(doc.sheets.map((s) => s.id));
  const elements: Record<Id, Element> = {};
  for (const [id, el] of Object.entries(doc.elements)) if (!el.space || !sheetIds.has(el.space)) elements[id] = el;
  const prev = lastModel;
  const same =
    !!prev &&
    (Object.keys(doc) as (keyof ProjectDoc)[]).every((k) => k === 'sheets' || k === 'elements' || prev[k] === doc[k]) &&
    Object.keys(prev.elements).length === Object.keys(elements).length &&
    Object.entries(elements).every(([id, el]) => prev.elements[id] === el);
  const m = same ? prev! : { ...doc, elements, sheets: [] };
  modelDocs.set(doc, m);
  lastModel = m;
  return m;
}

/** Som `buildViewPrims`, men sparad så länge det vyerna visar är detsamma. */
export function cachedViewPrims(doc: ProjectDoc, v: ViewDef, opt: ViewPrimOptions): Primitive[] {
  const md = modelDoc(doc);
  let m = cache.get(md);
  if (!m) cache.set(md, (m = new Map()));
  const key = JSON.stringify([v, opt.scale, !!opt.autoDims]);
  let hit = m.get(key);
  if (!hit) m.set(key, (hit = buildViewPrims(md, v, opt)));
  return hit;
}

/** Ramen för det som är ritat (utan underlag), i modellens koordinater. Underlagen räknas bara om inget annat finns. */
export function contentBounds(prims: readonly Primitive[]): Bounds | null {
  return boundsOf(prims.filter((p) => p.origin?.objectType !== 'Underlay')) ?? boundsOf(prims);
}

/** Flytta och skala primitiver från modellen till papperet: p → at + p / scale. */
export function toPaper(prims: readonly Primitive[], at: Vec2, scale: number): Primitive[] {
  const t = (p: Vec2): Vec2 => [at[0] + p[0] / scale, at[1] + p[1] / scale];
  const d = (p: Vec2): Vec2 => [p[0] / scale, p[1] / scale];
  return prims.map((p): Primitive => {
    switch (p.kind) {
      case 'line':
        return { ...p, a: t(p.a), b: t(p.b) };
      case 'polyline':
        return { ...p, points: p.points.map(t), ...(p.dashFrom ? { dashFrom: { ...p.dashFrom, points: p.dashFrom.points.map(t), at: p.dashFrom.at / scale } } : {}) };
      case 'region':
        return { ...p, rings: p.rings.map((r) => r.map(t)) };
      case 'arc':
        return { ...p, center: t(p.center), radius: p.radius / scale };
      case 'text':
        return { ...p, at: t(p.at) };
      case 'image':
        return { ...p, corner: t(p.corner), u: d(p.u), v: d(p.v) };
    }
  });
}

/** En vy på ett blad, färdig att rita: ram, rubrik och primitiver på papperet. */
export interface PlacedView {
  id: Id;
  view: Id;
  name: string;
  /** Ramen på papperet. */
  frame: Bounds;
  /** Vyns läge och skala, för att räkna mellan papperet och modellen. */
  at: Vec2;
  scale: number;
  /** Ramen är ändrad för hand (`crop`). */
  cropped?: boolean;
  prims: Primitive[];
  /** Vyn eller det den visar finns inte längre. */
  missing?: boolean;
}

/** En ram på papperet i vyns modellkoordinater (för `crop`). */
export function paperToModel(b: Bounds, at: Vec2, scale: number): Bounds {
  return { minX: (b.minX - at[0]) * scale, minY: (b.minY - at[1]) * scale, maxX: (b.maxX - at[0]) * scale, maxY: (b.maxY - at[1]) * scale };
}

/** En ram i vyns modellkoordinater på papperet. */
export function modelToPaper(b: Bounds, at: Vec2, scale: number): Bounds {
  return { minX: at[0] + b.minX / scale, minY: at[1] + b.minY / scale, maxX: at[0] + b.maxX / scale, maxY: at[1] + b.maxY / scale };
}

/** Ramen på papperet för en vy med ett visst läge, eller null om vyn är tom. */
export function viewportFrame(modelBounds: Bounds | null, at: Vec2, scale: number): Bounds | null {
  if (!modelBounds) return null;
  return {
    minX: at[0] + modelBounds.minX / scale - VIEWPORT_PAD,
    minY: at[1] + modelBounds.minY / scale - VIEWPORT_PAD,
    maxX: at[0] + modelBounds.maxX / scale + VIEWPORT_PAD,
    maxY: at[1] + modelBounds.maxY / scale + VIEWPORT_PAD,
  };
}

/** Rubrik under vyn: namnet i fet stil och skalan efter (om den inte är dold), som i ritningar. */
function viewTitle(frame: Bounds, title: string, scale: number, showScale = true): Primitive[] {
  const origin = { objectType: 'ViewTitle', part: 'vyrubrik' };
  const y = frame.minY - 6;
  const x = frame.minX + VIEWPORT_PAD;
  const width = textWidth(title, 3.5, true);
  return [
    { kind: 'text', at: [x, y], text: title, height: 3.5, bold: true, pen: { weight: 0.25 }, origin },
    { kind: 'line', a: [x, y - 1.2], b: [x + width, y - 1.2], pen: { weight: 0.25 }, origin },
    ...(showScale ? [{ kind: 'text', at: [x + width + 2.5, y], text: `SKALA 1:${scale}`, height: 2.5, pen: { weight: 0.18 }, origin } as Primitive] : []),
  ];
}

/** En vy på ett blad, ritad på papperet. */
export function placeView(doc: ProjectDoc, vp: Viewport, opt: { autoDims?: boolean } = {}): PlacedView {
  const src = viewSource(doc, vp.view);
  const name = vp.title?.trim() || src?.name || 'Vyn finns inte längre';
  if (!src) {
    const frame = { minX: vp.at[0] - 30, minY: vp.at[1] - 20, maxX: vp.at[0] + 30, maxY: vp.at[1] + 20 };
    const pen = { weight: 0.18, color: 'muted' as const, dash: [2, 1] };
    return {
      id: vp.id,
      view: vp.view,
      name,
      missing: true,
      at: vp.at,
      scale: vp.scale,
      frame,
      prims: [
        { kind: 'polyline', points: [[frame.minX, frame.minY], [frame.maxX, frame.minY], [frame.maxX, frame.maxY], [frame.minX, frame.maxY]], closed: true, pen },
        { kind: 'text', at: [frame.minX + 3, frame.maxY - 6], text: 'Vyn finns inte längre', height: 3, pen: { weight: 0.18, color: 'muted' } },
      ],
    };
  }
  const model = cachedViewPrims(doc, src.def, { scale: vp.scale, autoDims: opt.autoDims });
  const base = { id: vp.id, view: vp.view, name, at: vp.at, scale: vp.scale };
  const title = (f: Bounds) => viewTitle(f, name, vp.scale, !vp.hideScale);
  const paper = toPaper(model, vp.at, vp.scale);
  if (vp.crop) {
    // En egen ram (0.8.7): allt klipps mot den.
    const frame = modelToPaper(vp.crop, vp.at, vp.scale);
    return { ...base, frame, cropped: true, prims: [...clipPrims(paper, frame), ...title(frame)] };
  }
  const frame = viewportFrame(contentBounds(model), vp.at, vp.scale) ?? { minX: vp.at[0] - 20, minY: vp.at[1] - 15, maxX: vp.at[0] + 20, maxY: vp.at[1] + 15 };
  // Underlagen klipps mot ramen; det som är ritat ligger redan inom den.
  const under = clipPrims(
    paper.filter((p) => p.origin?.objectType === 'Underlay'),
    frame,
  );
  const rest = paper.filter((p) => p.origin?.objectType !== 'Underlay');
  return { ...base, frame, prims: [...under, ...rest, ...title(frame)] };
}

/** Vyns ram när den följer innehållet, i modellens koordinater (som `crop`), eller null om vyn är tom. */
export function contentCrop(doc: ProjectDoc, vp: Viewport, opt: { autoDims?: boolean } = {}): Bounds | null {
  const src = viewSource(doc, vp.view);
  const b = src ? contentBounds(cachedViewPrims(doc, src.def, { scale: vp.scale, autoDims: opt.autoDims })) : null;
  if (!b) return null;
  const pad = VIEWPORT_PAD * vp.scale;
  return { minX: b.minX - pad, minY: b.minY - pad, maxX: b.maxX + pad, maxY: b.maxY + pad };
}

/** Mitten av en vy på papperet, med ett visst läge och en viss skala. */
export function viewCenter(doc: ProjectDoc, view: Id, scale: number, at: Vec2, opt: { autoDims?: boolean } = {}): Vec2 {
  const src = viewSource(doc, view);
  const b = src ? contentBounds(cachedViewPrims(doc, src.def, { scale, autoDims: opt.autoDims })) : null;
  if (!b) return at;
  return [at[0] + (b.minX + b.maxX) / 2 / scale, at[1] + (b.minY + b.maxY) / 2 / scale];
}

/** Läget (`at`) som lägger vyns mitt i en punkt på papperet. */
export function centeredAt(doc: ProjectDoc, view: Id, scale: number, center: Vec2, opt: { autoDims?: boolean } = {}): [number, number] {
  const src = viewSource(doc, view);
  const b = src ? contentBounds(cachedViewPrims(doc, src.def, { scale, autoDims: opt.autoDims })) : null;
  if (!b) return [Math.round(center[0]), Math.round(center[1])];
  const mid: Vec2 = [(b.minX + b.maxX) / 2 / scale, (b.minY + b.maxY) / 2 / scale];
  return [Math.round(center[0] - mid[0]), Math.round(center[1] - mid[1])];
}

/** Papperet: vitt med en tunn kant, bara på skärmen (`part: 'papper'`). */
export function paperPrim(w: number, h: number): Primitive {
  return {
    kind: 'region',
    role: 'cut',
    rings: [
      [
        [0, 0],
        [w, 0],
        [w, h],
        [0, h],
      ],
    ],
    fill: { kind: 'solid', color: 'paper' },
    outline: { weight: 0.13, color: 'muted' },
    ownFill: true,
    origin: { objectType: 'Sheet', part: 'papper' },
  };
}

/**
 * Stämpelns nollpunkt (0.8.12), bara på skärmen: ett kryss där stämpeln
 * fästs när den läggs på ett blad.
 */
export function stampOrigin(): Primitive[] {
  const pen = { weight: 0.18, color: 'muted' as const };
  const origin = { objectType: 'Sheet', part: 'skärm' };
  return [
    { kind: 'line', a: [-6, 0], b: [6, 0], pen, origin },
    { kind: 'line', a: [0, -6], b: [0, 6], pen, origin },
    { kind: 'text', at: [1.5, 1.5], text: 'Nollpunkt', height: 2, pen, origin },
  ];
}

/** Inställningarna ett mallblad ritas med (0.8.8): skala 1:1, utan tillstånd och jämförelse. Med `smart` fylls smarttexten i. */
export function masterViewStates(doc: ProjectDoc, master: Worksheet, smart?: Record<string, string>): ViewStates {
  return { state: defaultState(doc), viewId: modelViewId(master.id), place: master.id, scale: 1, ...(smart ? { smart } : {}) };
}

/** Det som är ritat på ett mallblad (mm på papperet), med smarttexten ifylld från bladet. */
export function masterPrims(doc: ProjectDoc, master: Worksheet, sheet: Sheet, todayText: string): Primitive[] {
  return buildPlan(doc, doc.storeys[0].id, masterViewStates(doc, master, smartVars(doc, sheet, todayText))).prims;
}

/** Inställningarna det som är ritat på ett blad ritas med (0.8.9): som ett mallblad, med bladets smarttext. */
export function sheetViewStates(doc: ProjectDoc, sheet: Sheet, todayText: string): ViewStates {
  return { state: defaultState(doc), viewId: modelViewId(sheet.id), place: sheet.id, scale: 1, smart: smartVars(doc, sheet, todayText) };
}

/** Det klickbara för en vy på bladet: ramen och rubriken under, lägre än det som är ritat på bladet. */
function viewportPickable(v: PlacedView): Pickable {
  const f = { ...v.frame, minY: v.frame.minY - 8 };
  return {
    id: v.id,
    priority: -100,
    regions: [],
    prims: [{ kind: 'polyline', points: [[f.minX, f.minY], [f.maxX, f.minY], [f.maxX, f.maxY], [f.minX, f.maxY]], closed: true, pen: { weight: 0.25 } }],
  };
}

export interface SheetDrawing {
  /** Papperets bredd och höjd, mm. */
  size: [number, number];
  /** Allt på bladet, mm på papperet. Papperet självt ligger först (`part: 'papper'`). */
  prims: Primitive[];
  views: PlacedView[];
  /** Det som går att markera (0.8.9): det som är ritat på bladet och vyerna, med vyns id. */
  pickables: Pickable[];
  /** Den vanliga ritningsramen (`FRAME_MARGIN`), som flyttade saker fäster mot. */
  frame: Bounds;
}

/**
 * Ett helt ritningsblad: papper, mallbladets grafik, underlagen på bladet,
 * vyerna och sedan det andra som är ritat på bladet (0.8.9).
 */
export function buildSheet(doc: ProjectDoc, sheet: Sheet, opt: { autoDims?: boolean; today: string }): SheetDrawing {
  const [w, h] = paperSize(sheet);
  const frame: Bounds = { minX: FRAME_MARGIN.left, minY: FRAME_MARGIN.bottom, maxX: w - FRAME_MARGIN.right, maxY: h - FRAME_MARGIN.top };
  const master = masterOf(doc, sheet);
  const views = sheet.viewports.map((vp) => placeView(doc, vp, opt));
  const drawn = buildPlan(doc, doc.storeys[0].id, sheetViewStates(doc, sheet, opt.today));
  const under = drawn.prims.filter((q) => q.origin?.objectType === 'Underlay');
  const over = drawn.prims.filter((q) => q.origin?.objectType !== 'Underlay');
  const prims: Primitive[] = [paperPrim(w, h), ...(master ? masterPrims(doc, master, sheet, opt.today) : []), ...under, ...views.flatMap((v) => v.prims), ...over];
  return { size: [w, h], prims, views, pickables: [...views.map(viewportPickable), ...drawn.pickables], frame };
}

/** En vy ensam på ett papper som är precis så stort som den, för export av vyer. */
export function buildViewPage(doc: ProjectDoc, ref: Id, opt: { scale?: number; autoDims?: boolean }): { size: [number, number]; prims: Primitive[]; name: string } | null {
  const src = viewSource(doc, ref);
  if (!src) return null;
  const scale = opt.scale ?? src.def.scale ?? 100;
  const model = cachedViewPrims(doc, src.def, { scale, autoDims: opt.autoDims });
  const b = contentBounds(model);
  if (!b) return null;
  const margin = 10;
  const at: Vec2 = [margin + VIEWPORT_PAD - b.minX / scale, margin + VIEWPORT_PAD - b.minY / scale];
  const frame = viewportFrame(b, at, scale)!;
  const paper = toPaper(model, at, scale);
  const under = clipPrims(
    paper.filter((p) => p.origin?.objectType === 'Underlay'),
    frame,
  );
  const rest = paper.filter((p) => p.origin?.objectType !== 'Underlay');
  return { size: [Math.ceil(frame.maxX + margin), Math.ceil(frame.maxY + margin)], prims: [...under, ...rest], name: src.name };
}
