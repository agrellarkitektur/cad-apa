import { newId } from '../../core/ids';
import type { Id, Sheet } from '../../core/model';
import { addTitleBlock, addViewport, createSheet, FRAME_MARGIN, moveOnSheet, paperSize, removeFromSheet, setLogo, setViewportCrop, today } from '../../core/sheets';
import { buildSheet, cachedViewPrims, contentBounds, paperToModel, VIEWPORT_PAD, viewSource, type PlacedItem, type SheetDrawing } from '../../repr/sheet';
import type { Bounds, Vec2 } from '../../repr/primitives';
import type { Camera } from '../../view2d/camera';
import type { ViewPointer, ViewTool } from '../../view2d/planView';
import { isNarrow } from '../sheet';
import { saveUiSettings } from '../uiSettings';
import type { SheetFormHost } from '../sheetForms';
import type { SmartMenuCustom } from '../smartMenu';
import type { AppContext } from './context';
import { screenBox } from './selectionPlace';
import { installSheetText } from './sheetText';
import type { InlineTextEditor } from '../textEditor';
import { base64Of } from './underlays';

/** Det som går att markera och flytta på ett blad: en vy, ett ritningshuvud (0.8.6) eller en text (0.8.7). */
export type SheetThing = { kind: 'viewport' | 'titleBlock' | 'sheetText'; id: Id };

const thingOf = (it: PlacedItem): SheetThing => ({ kind: it.kind === 'text' ? 'sheetText' : 'titleBlock', id: it.id });

/** Ett grepp i en vys ram: vilka kanter det flyttar (0.8.7). */
type Grip = { x: -1 | 0 | 1; y: -1 | 0 | 1 };
const GRIPS: Grip[] = [
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
  { x: -1, y: 1 },
  { x: -1, y: 0 },
];
const gripCursor = (g: Grip) => (g.x === 0 ? 'ns-resize' : g.y === 0 ? 'ew-resize' : g.x === g.y ? 'nesw-resize' : 'nwse-resize');
const gripAt = (b: Bounds, g: Grip): Vec2 => [g.x < 0 ? b.minX : g.x > 0 ? b.maxX : (b.minX + b.maxX) / 2, g.y < 0 ? b.minY : g.y > 0 ? b.maxY : (b.minY + b.maxY) / 2];
/** Ramen med greppets kanter flyttade, aldrig mindre än 5 mm. */
function resized(b: Bounds, g: Grip, d: Vec2): Bounds {
  const r = { ...b };
  const min = 5;
  if (g.x < 0) r.minX = Math.min(b.minX + d[0], b.maxX - min);
  if (g.x > 0) r.maxX = Math.max(b.maxX + d[0], b.minX + min);
  if (g.y < 0) r.minY = Math.min(b.minY + d[1], b.maxY - min);
  if (g.y > 0) r.maxY = Math.max(b.maxY + d[1], b.minY + min);
  return r;
}

/**
 * Ritningsbladen i appen (0.8 del 3): bladet som visas, verktyget som
 * markerar och flyttar vyerna och ritningshuvudena (0.8.6) på det, att lägga
 * en vy på ett blad och formulären i egenskapspanelen. Det markerade på ett
 * blad är det som är valt i egenskapspanelen, inte objekt i `selection`.
 *
 * På ett blad är koordinaterna mm på papperet och ritningsskalan 1:1, så
 * att texter och linjer får sin storlek på papper.
 */
export function installSheets(app: AppContext, textEditor: InlineTextEditor) {
  let last: { doc: unknown; sheet: Sheet; autoDims: boolean; drawing: SheetDrawing } | null = null;

  /** Bladet som visas, ritat. Sparas tills projektet eller bladet ändras. */
  function drawing(): SheetDrawing | null {
    const sheet = app.ui.layout ? app.store.doc.sheets.find((s) => s.id === app.ui.layout) : undefined;
    if (!sheet) return null;
    const doc = app.store.doc;
    const autoDims = app.uiSettings.autoDims;
    if (last && last.doc === doc && last.sheet === sheet && last.autoDims === autoDims) return last.drawing;
    const d = buildSheet(doc, sheet, { autoDims, today: today() });
    last = { doc, sheet, autoDims, drawing: d };
    return d;
  }

  /** Det på bladet som är valt i egenskapspanelen: en vy, ett ritningshuvud eller en text. */
  function pickedThing(): SheetThing | null {
    const t = app.panel.treeItem;
    if (!app.ui.layout || !t || (t.kind !== 'viewport' && t.kind !== 'titleBlock' && t.kind !== 'sheetText')) return null;
    return frameOf(t.id) ? { kind: t.kind, id: t.id } : null;
  }
  const picked = (): Id | null => pickedThing()?.id ?? null;

  /** Anropas när det valda på bladet eller Flytta ändras, t.ex. för Modifiera-raden. */
  const listeners: (() => void)[] = [];
  const changed = () => listeners.forEach((f) => f());

  function pick(item: { kind: 'sheet' | SheetThing['kind']; id: Id } | null): void {
    app.selection.clear();
    if (moving && moving.thing.id !== item?.id) cancelMove();
    app.panel.showTreeItem(item);
    if (item && !isNarrow() && !app.ui.panelOpen) app.setPanel(true);
    if (app.ui.navOpen) app.navigator.render();
    if (app.smartMenu.custom && (!item || item.kind === 'sheet')) app.smartMenu.hide();
    app.view.requestRender();
    changed();
  }

  const textEdit = installSheetText(app, textEditor, pick);

  /** Ytan på papperet för en vy, ett ritningshuvud eller en text på bladet som visas. */
  function frameOf(id: Id): Bounds | null {
    const d = drawing();
    return d?.items.find((i) => i.id === id)?.frame ?? d?.views.find((v) => v.id === id)?.frame ?? null;
  }

  /** Det översta på bladet under en punkt: ritningshuvudena och texterna ligger över vyerna. */
  function hit(p: Vec2): SheetThing | null {
    const d = drawing();
    if (!d) return null;
    const pad = 2 / app.view.camera.scale;
    const inside = (f: Bounds, below = 0, m = 0) => p[0] >= f.minX - m && p[0] <= f.maxX + m && p[1] >= f.minY - below - m && p[1] <= f.maxY + m;
    // Texterna först, så att en text i ett ritningshuvud går att träffa.
    for (let i = d.items.length - 1; i >= 0; i--) if (d.items[i].kind === 'text' && inside(d.items[i].frame, 0, pad)) return thingOf(d.items[i]);
    for (let i = d.items.length - 1; i >= 0; i--) if (inside(d.items[i].frame)) return thingOf(d.items[i]);
    for (let i = d.views.length - 1; i >= 0; i--) if (inside(d.views[i].frame, 8)) return { kind: 'viewport', id: d.views[i].id };
    return null;
  }

  /**
   * Fäst en flyttad yta mot de andra sakernas kanter och mittlinjer och mot
   * ritningsramen. Svarar med förflyttningen och stödlinjerna.
   */
  function snapMove(id: Id, f: Bounds, d: Vec2, shift: boolean): { d: Vec2; guides: [Vec2, Vec2][] } {
    if (shift) d = Math.abs(d[0]) > Math.abs(d[1]) ? [d[0], 0] : [0, d[1]];
    const dr = drawing();
    const tol = 8 / app.view.camera.scale;
    const others = [...(dr?.views ?? []), ...(dr?.items ?? [])].filter((v) => v.id !== id).map((v) => v.frame);
    const xs = (b: Bounds) => [b.minX, (b.minX + b.maxX) / 2, b.maxX];
    const ys = (b: Bounds) => [b.minY, (b.minY + b.maxY) / 2, b.maxY];
    const fx = dr ? [dr.frame.minX, dr.frame.maxX] : [];
    const fy = dr ? [dr.frame.minY, dr.frame.maxY] : [];
    const best = (mine: number[], theirs: number[]) => {
      let r: { off: number; at: number } | null = null;
      for (const m of mine) for (const t of theirs) if (Math.abs(t - m) < tol && (!r || Math.abs(t - m) < Math.abs(r.off))) r = { off: t - m, at: t };
      return r;
    };
    const moved: Bounds = { minX: f.minX + d[0], maxX: f.maxX + d[0], minY: f.minY + d[1], maxY: f.maxY + d[1] };
    const guides: [Vec2, Vec2][] = [];
    if (!shift || d[0] !== 0) {
      const sx = best(xs(moved), [...others.flatMap(xs), ...fx]);
      if (sx) {
        d = [d[0] + sx.off, d[1]];
        guides.push([
          [sx.at, -1e4],
          [sx.at, 1e4],
        ]);
      }
    }
    if (!shift || d[1] !== 0) {
      const sy = best(ys(moved), [...others.flatMap(ys), ...fy]);
      if (sy) {
        d = [d[0], d[1] + sy.off];
        guides.push([
          [-1e4, sy.at],
          [1e4, sy.at],
        ]);
      }
    }
    return { d, guides };
  }

  const moveLabel = (t: SheetThing) => (t.kind === 'titleBlock' ? 'Flytta ritningshuvudet' : t.kind === 'sheetText' ? 'Flytta texten' : 'Flytta vyn på bladet');

  /** Ett grepp i den valda vyns ram under en punkt på skärmen (0.8.7). */
  function gripHit(p: ViewPointer): { vp: Id; frame: Bounds; grip: Grip } | null {
    const t = pickedThing();
    if (t?.kind !== 'viewport' || !p.screen) return null;
    const v = drawing()?.views.find((x) => x.id === t.id);
    if (!v || v.missing) return null;
    const cam = app.view.camera;
    for (const g of GRIPS) {
      const s = cam.toScreen(gripAt(v.frame, g));
      if (Math.abs(s[0] - p.screen[0]) <= 7 && Math.abs(s[1] - p.screen[1]) <= 7) return { vp: v.id, frame: v.frame, grip: g };
    }
    return null;
  }

  /** Fäst en dragen kant i vyns ram mot de andra sakernas kanter och ritningsramen. */
  function snapEdge(id: Id, value: number, axis: 0 | 1): { at: number; guide: [Vec2, Vec2] | null } {
    const dr = drawing();
    if (!dr) return { at: value, guide: null };
    const tol = 8 / app.view.camera.scale;
    const others = [...dr.views, ...dr.items].filter((v) => v.id !== id).map((v) => v.frame);
    const lines = axis === 0 ? [dr.frame.minX, dr.frame.maxX, ...others.flatMap((b) => [b.minX, b.maxX])] : [dr.frame.minY, dr.frame.maxY, ...others.flatMap((b) => [b.minY, b.maxY])];
    let best: number | null = null;
    for (const l of lines) if (Math.abs(l - value) < tol && (best === null || Math.abs(l - value) < Math.abs(best - value))) best = l;
    if (best === null) return { at: value, guide: null };
    return { at: best, guide: axis === 0 ? [[best, -1e4], [best, 1e4]] : [[-1e4, best], [1e4, best]] };
  }

  /** Återställ vyns ram till innehållet. */
  function resetCrop(vpId: Id): void {
    if (app.ui.layout) setViewportCrop(app.store, app.ui.layout, vpId, null);
    app.smartMenu.refresh(true);
  }

  /** Flytta med två klick (Flytta i smartmenyn eller Modifiera-raden): baspunkt, sedan dit. */
  let moving: { thing: SheetThing; frame: Bounds; base: Vec2 | null; d: Vec2; guides: [Vec2, Vec2][] } | null = null;

  function startMove(thing = pickedThing()): void {
    const frame = thing && frameOf(thing.id);
    if (!thing || !frame) return;
    if (pickedThing()?.id !== thing.id) pick(thing);
    moving = { thing, frame, base: null, d: [0, 0], guides: [] };
    app.smartMenu.refresh(true);
    app.hint('Klicka på en baspunkt, sedan dit den ska. Esc avbryter.', 4000);
    app.view.requestRender();
    changed();
  }

  /** Avbryt Flytta. Svarar med om något pågick. */
  function cancelMove(): boolean {
    if (!moving) return false;
    moving = null;
    app.smartMenu.refresh(true);
    app.view.requestRender();
    changed();
    return true;
  }

  /** Ta bort det valda på bladet. Svarar med om något togs bort. */
  function removePicked(): boolean {
    const t = pickedThing();
    if (!t || !app.ui.layout) return false;
    const sheetId = app.ui.layout;
    cancelMove();
    removeFromSheet(app.store, sheetId, [t.id]);
    pick({ kind: 'sheet', id: sheetId });
    return true;
  }

  /** Smartmenyn för en vy eller ett ritningshuvud på bladet. */
  function menuFor(thing: SheetThing): SmartMenuCustom | null {
    const sheet = app.store.doc.sheets.find((s) => s.id === app.ui.layout);
    if (!sheet) return null;
    const alive = () => !!frameOf(thing.id) && pickedThing()?.id === thing.id;
    const anchor = () => {
      const f = frameOf(thing.id);
      return f ? screenBox(app.view, app.pane2d, thing.kind === 'viewport' ? { ...f, minY: f.minY - 8 } : f) : null;
    };
    const move = { id: 'move', label: 'Flytta', icon: 'move' as const, pressed: moving?.thing.id === thing.id };
    if (thing.kind === 'sheetText') {
      const it = sheet.items.find((i) => i.id === thing.id);
      const first = it?.kind === 'text' ? it.text.split('\n')[0] : '';
      return {
        title: 'Text',
        sub: first.length > 28 ? `${first.slice(0, 27)}…` : first,
        buttons: [move, { id: 'edit', label: 'Redigera', icon: 'text' }, { id: 'props', label: 'Egenskaper', icon: 'properties' }, { id: 'remove', label: 'Ta bort', icon: 'trash', danger: true }],
        anchor,
        alive,
        run: (id) => menuAction(thing, id),
      };
    }
    if (thing.kind === 'titleBlock') {
      return {
        title: 'Ritningshuvud',
        sub: `BH90 på ${sheet.number}`,
        buttons: [move, { id: 'props', label: 'Egenskaper', icon: 'properties' }, { id: 'remove', label: 'Ta bort', icon: 'trash', danger: true }],
        anchor,
        alive,
        run: (id) => menuAction(thing, id),
      };
    }
    const vp = sheet.viewports.find((v) => v.id === thing.id);
    if (!vp) return null;
    return {
      title: vp.title || viewSource(app.store.doc, vp.view)?.name || 'Vy',
      sub: `1:${vp.scale} på ${sheet.number}`,
      buttons: [
        move,
        { id: 'open', label: 'Öppna vyn', icon: 'navigator' },
        ...(vp.crop ? [{ id: 'reset-crop', label: 'Återställ ramen till innehållet', icon: 'fit' as const }] : []),
        { id: 'props', label: 'Egenskaper', icon: 'properties' },
        { id: 'remove', label: 'Ta bort', icon: 'trash', danger: true },
      ],
      anchor,
      alive,
      run: (id) => menuAction(thing, id),
    };
  }

  function menuAction(thing: SheetThing, id: string): void {
    switch (id) {
      case 'move':
        if (moving) cancelMove();
        else startMove(thing);
        break;
      case 'props':
        pick(thing);
        if (!app.ui.panelOpen) app.setPanel(true);
        break;
      case 'edit':
        textEdit.edit(thing.id);
        break;
      case 'reset-crop':
        resetCrop(thing.id);
        break;
      case 'open': {
        const vp = app.store.doc.sheets.find((s) => s.id === app.ui.layout)?.viewports.find((v) => v.id === thing.id);
        if (vp) openView(vp.view);
        break;
      }
      case 'remove':
        removePicked();
        app.smartMenu.hide();
        break;
    }
  }

  /** Visa smartmenyn för det valda på bladet. */
  function showMenu(thing: SheetThing, clientX: number, clientY: number): void {
    const m = menuFor(thing);
    if (m) app.smartMenu.showCustom(m, clientX, clientY);
  }

  /** Öppna det en vy på bladet visar. */
  function openView(ref: Id): void {
    const v = app.store.doc.views.find((x) => x.id === ref);
    if (v) {
      app.applyView(v);
      return;
    }
    const place = ref.startsWith('modell:') ? ref.slice('modell:'.length) : ref;
    const doc = app.store.doc;
    if (doc.storeys.some((s) => s.id === place)) app.goTo({ kind: 'storey', id: place });
    else if (doc.elements[place]) app.goTo({ kind: 'marker', id: place });
    else if (doc.worksheets.some((w) => w.id === place)) app.goTo({ kind: 'worksheet', id: place });
    else app.hint('Vyn finns inte längre.');
  }

  /**
   * Markera och flytta vyerna och ritningshuvudena på bladet. Dubbelklick på
   * en vy öppnar den. Ett klick visar smartmenyn bredvid det valda.
   */
  class SheetTool implements ViewTool {
    cursor = 'default';
    private dragging: { thing: SheetThing; start: Vec2; frame: Bounds; d: Vec2; guides: [Vec2, Vec2][] } | null = null;
    /** Ett grepp i vyns ram som dras (0.8.7). */
    private cropping: { vp: Id; start: Vec2; frame: Bounds; grip: Grip; now: Bounds; guides: [Vec2, Vec2][] } | null = null;
    private hoveredGrip: Grip | null = null;
    private hovered: Id | null = null;
    private lastUp = { id: '' as Id | null, t: 0 };

    down(p: ViewPointer): 'capture' | 'pan' | 'ignore' {
      if (moving) return 'capture';
      const g = gripHit(p);
      if (g) {
        this.cropping = { vp: g.vp, start: p.model, frame: g.frame, grip: g.grip, now: g.frame, guides: [] };
        return 'capture';
      }
      const t = hit(p.model);
      const frame = t && frameOf(t.id);
      if (!t || !frame) return 'pan';
      if (picked() !== t.id) pick(t);
      this.dragging = { thing: t, start: p.model, frame, d: [0, 0], guides: [] };
      return 'capture';
    }

    drag(p: ViewPointer): void {
      if (moving) {
        this.follow(p);
        return;
      }
      const c = this.cropping;
      if (c) {
        const d: Vec2 = [p.model[0] - c.start[0], p.model[1] - c.start[1]];
        const raw = resized(c.frame, c.grip, d);
        const guides: [Vec2, Vec2][] = [];
        const edge = (key: keyof Bounds, axis: 0 | 1) => {
          const r = snapEdge(c.vp, raw[key], axis);
          raw[key] = r.at;
          if (r.guide) guides.push(r.guide);
        };
        if (c.grip.x < 0) edge('minX', 0);
        if (c.grip.x > 0) edge('maxX', 0);
        if (c.grip.y < 0) edge('minY', 1);
        if (c.grip.y > 0) edge('maxY', 1);
        c.now = resized(raw, { x: 0, y: 0 }, [0, 0]);
        c.guides = guides;
        app.view.requestRender();
        return;
      }
      const g = this.dragging;
      if (!g) return;
      const r = snapMove(g.thing.id, g.frame, [p.model[0] - g.start[0], p.model[1] - g.start[1]], p.shift);
      g.d = r.d;
      g.guides = r.guides;
      app.view.requestRender();
    }

    /** Flytta med två klick: skuggan följer markören efter baspunkten. */
    private follow(p: ViewPointer): void {
      if (!moving?.base) return;
      const r = snapMove(moving.thing.id, moving.frame, [p.model[0] - moving.base[0], p.model[1] - moving.base[1]], p.shift);
      moving.d = r.d;
      moving.guides = r.guides;
      app.view.requestRender();
    }

    up(p: ViewPointer, moved: boolean): void {
      const sheetId = app.ui.layout;
      if (moving) {
        if (!moving.base) {
          moving.base = p.model;
          app.hint('Klicka dit den ska. Shift: bara vågrätt eller lodrätt.', 4000);
        } else {
          this.follow(p);
          const m = moving;
          moving = null;
          if (sheetId) moveOnSheet(app.store, sheetId, [m.thing.id], m.d, moveLabel(m.thing));
          app.smartMenu.refresh(true);
          changed();
        }
        app.view.requestRender();
        return;
      }
      const c = this.cropping;
      this.cropping = null;
      if (c) {
        const vp = drawing()?.views.find((v) => v.id === c.vp);
        const same = (['minX', 'minY', 'maxX', 'maxY'] as const).every((k) => Math.abs(c.now[k] - c.frame[k]) < 0.05);
        if (moved && sheetId && vp && !same) setViewportCrop(app.store, sheetId, c.vp, paperToModel(c.now, vp.at, vp.scale));
        app.smartMenu.refresh(true);
        app.view.requestRender();
        return;
      }
      const g = this.dragging;
      this.dragging = null;
      if (!g) return;
      if (moved && sheetId && Math.hypot(g.d[0], g.d[1]) > 0.05) {
        moveOnSheet(app.store, sheetId, [g.thing.id], g.d, moveLabel(g.thing));
      } else if (!moved) {
        const now = performance.now();
        // Dubbelklick på en text: redigera den där den står.
        if (g.thing.kind === 'sheetText' && this.lastUp.id === g.thing.id && now - this.lastUp.t < 400) {
          this.lastUp = { id: null, t: 0 };
          textEdit.edit(g.thing.id);
          return;
        }
        // Dubbelklick på en vy: öppna den.
        if (g.thing.kind === 'viewport' && this.lastUp.id === g.thing.id && now - this.lastUp.t < 400) {
          const vp = app.store.doc.sheets.find((s) => s.id === sheetId)?.viewports.find((v) => v.id === g.thing.id);
          app.smartMenu.hide();
          if (vp) openView(vp.view);
          this.lastUp = { id: null, t: 0 };
          return;
        }
        this.lastUp = { id: g.thing.id, t: now };
        if (app.uiSettings.smartMenu && !isNarrow() && p.screen) {
          const r = app.view.svg.getBoundingClientRect();
          showMenu(g.thing, r.left + p.screen[0], r.top + p.screen[1]);
        }
      }
      app.view.requestRender();
    }

    tap(): void {
      // Ett klick bredvid det som ligger på bladet visar bladets inställningar.
      if (moving) return;
      app.smartMenu.hide();
      if (app.ui.layout) pick({ kind: 'sheet', id: app.ui.layout });
    }

    cancel(): void {
      this.dragging = null;
      this.cropping = null;
      app.view.requestRender();
    }

    hover(p: ViewPointer | null): void {
      if (moving) {
        if (p) this.follow(p);
        return;
      }
      const grip = p ? (gripHit(p)?.grip ?? null) : null;
      const h = grip ? null : p ? (hit(p.model)?.id ?? null) : null;
      if (h !== this.hovered || grip !== this.hoveredGrip) {
        this.hovered = h;
        this.hoveredGrip = grip;
        this.cursor = grip ? gripCursor(grip) : h ? 'move' : 'default';
        app.view.svg.style.cursor = this.cursor;
        app.view.requestRender();
      }
    }

    overlay(cam: Camera): string {
      const d = drawing();
      if (!d) return '';
      const rect = (b: Bounds, cls: string) => {
        const a = cam.toScreen([b.minX, b.maxY]);
        const c = cam.toScreen([b.maxX, b.minY]);
        return `<rect class="${cls}" x="${a[0].toFixed(1)}" y="${a[1].toFixed(1)}" width="${(c[0] - a[0]).toFixed(1)}" height="${(c[1] - a[1]).toFixed(1)}"/>`;
      };
      const by = (b: Bounds, v: Vec2): Bounds => ({ minX: b.minX + v[0], maxX: b.maxX + v[0], minY: b.minY + v[1], maxY: b.maxY + v[1] });
      const out: string[] = [];
      const sel = picked();
      const g = this.dragging && Math.hypot(this.dragging.d[0], this.dragging.d[1]) > 0 ? this.dragging : moving?.base ? moving : null;
      const c = this.cropping;
      const busy = g?.thing.id ?? c?.vp;
      for (const v of [...d.views, ...d.items]) {
        if (v.id === busy) continue;
        if (v.id === sel) out.push(rect(v.frame, 'vp-frame picked'));
        else if (v.id === this.hovered) out.push(rect(v.frame, 'vp-frame hover'));
      }
      // Greppen i den valda vyns ram (0.8.7).
      const pickedView = !g && pickedThing()?.kind === 'viewport' ? d.views.find((v) => v.id === sel && !v.missing) : undefined;
      if (pickedView) {
        const b = c ? c.now : pickedView.frame;
        if (c) out.push(rect(b, 'vp-frame moving'));
        for (const gr of GRIPS) {
          const s = cam.toScreen(gripAt(b, gr));
          out.push(`<rect class="vp-grip" x="${(s[0] - 4).toFixed(1)}" y="${(s[1] - 4).toFixed(1)}" width="8" height="8"/>`);
        }
        for (const [a, e] of c?.guides ?? []) {
          const s1 = cam.toScreen(a);
          const s2 = cam.toScreen(e);
          out.push(`<line class="vp-guide" x1="${s1[0].toFixed(1)}" y1="${s1[1].toFixed(1)}" x2="${s2[0].toFixed(1)}" y2="${s2[1].toFixed(1)}"/>`);
        }
      }
      if (g) {
        out.push(rect(by(g.frame, g.d), 'vp-frame moving'));
        for (const [a, b] of g.guides) {
          const s = cam.toScreen(a);
          const e = cam.toScreen(b);
          out.push(`<line class="vp-guide" x1="${s[0].toFixed(1)}" y1="${s[1].toFixed(1)}" x2="${e[0].toFixed(1)}" y2="${e[1].toFixed(1)}"/>`);
        }
      }
      return out.join('');
    }
  }

  const tool = new SheetTool();

  /**
   * Var en ny vy får plats på bladet: uppifrån till vänster, utan att lägga
   * sig på de andra vyerna eller ritningshuvudena. Svarar med mitten.
   */
  function freeSpot(sheet: Sheet, size: [number, number]): Vec2 {
    const [W, H] = paperSize(sheet);
    const area: Bounds = { minX: FRAME_MARGIN.left + 6, minY: FRAME_MARGIN.bottom + 6, maxX: W - FRAME_MARGIN.right - 6, maxY: H - FRAME_MARGIN.top - 6 };
    const taken: Bounds[] = (drawing()?.views ?? []).map((v) => ({ ...v.frame, minY: v.frame.minY - 12 }));
    taken.push(...(drawing()?.items ?? []).map((i) => i.frame));
    const [w, h] = [size[0], size[1] + 12];
    const gap = 6;
    const free = (b: Bounds) => taken.every((t) => b.maxX + gap <= t.minX || b.minX >= t.maxX + gap || b.maxY + gap <= t.minY || b.minY >= t.maxY + gap);
    for (let y = area.maxY; y - h >= area.minY; y -= 5)
      for (let x = area.minX; x + w <= area.maxX; x += 5) {
        const b = { minX: x, maxX: x + w, minY: y - h, maxY: y };
        if (free(b)) return [x + w / 2, y - h / 2 + 6];
      }
    return [(area.minX + area.maxX) / 2, (area.minY + area.maxY) / 2];
  }

  /** Lägg en vy på ett blad. */
  function place(sheetId: Id, view: Id, scale: number): void {
    const doc = app.store.doc;
    const sheet = doc.sheets.find((s) => s.id === sheetId);
    const src = viewSource(doc, view);
    if (!sheet || !src) return;
    const b = contentBounds(cachedViewPrims(doc, src.def, { scale, autoDims: app.uiSettings.autoDims }));
    const size: [number, number] = b ? [(b.maxX - b.minX) / scale + 2 * VIEWPORT_PAD, (b.maxY - b.minY) / scale + 2 * VIEWPORT_PAD] : [40, 30];
    if (app.ui.layout !== sheetId) app.goTo({ kind: 'sheet', id: sheetId });
    const c = freeSpot(sheet, size);
    const mid: Vec2 = b ? [(b.minX + b.maxX) / 2 / scale, (b.minY + b.maxY) / 2 / scale] : [0, 0];
    const id = addViewport(app.store, sheetId, { view, scale, at: [Math.round(c[0] - mid[0]), Math.round(c[1] - mid[1])] });
    const [W, H] = paperSize(sheet);
    if (size[0] > W - 40 || size[1] > H - 30) app.hint(`Vyn är större än bladet i 1:${scale}. Välj en mindre skala eller ett större format.`, 5000);
    if (id) pick({ kind: 'viewport', id });
  }

  /** Ett nytt blad, blankt eller med ritningshuvud efter det senaste valet (0.8.6). */
  function newSheet(): void {
    const id = createSheet(app.store, { name: 'Nytt blad', titleBlock: app.uiSettings.newSheetTitleBlock });
    app.goTo({ kind: 'sheet', id });
    pick({ kind: 'sheet', id });
    if (isNarrow()) {
      app.setNav(false);
      app.setPanel(true, 'full');
    }
    requestAnimationFrame(() => app.panel.el.querySelector<HTMLInputElement>('.sheet-form input[name="name"]')?.select());
    app.hint(app.uiSettings.newSheetTitleBlock ? 'Ett nytt blad med ritningshuvud. Lägg vyer på det i egenskaperna.' : 'Ett blankt blad. Lägg vyer och ritningshuvud på det i egenskaperna.', 4000);
  }

  /** Lägg ett ritningshuvud på ett blad och visa det. */
  function placeTitleBlock(sheetId: Id): void {
    if (app.ui.layout !== sheetId) app.goTo({ kind: 'sheet', id: sheetId });
    const id = addTitleBlock(app.store, sheetId);
    if (id) pick({ kind: 'titleBlock', id });
  }

  /** Välj en bild som logga i ritningshuvudet. */
  function chooseLogo(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp,image/svg+xml';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      const bytes = new Uint8Array(await file.arrayBuffer());
      const url = URL.createObjectURL(file);
      try {
        const ratio = await new Promise<number>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img.naturalWidth / Math.max(1, img.naturalHeight));
          img.onerror = () => reject(new Error('Bilden kunde inte läsas.'));
          img.src = url;
        });
        setLogo(app.store, { id: newId('logga'), name: file.name, mime: file.type || 'image/png', data: base64Of(bytes), ratio: ratio || 3 });
        app.hint('Loggan syns i ritningshuvudet på alla blad.');
      } catch (err) {
        app.hint((err as Error).message, 4000);
      } finally {
        URL.revokeObjectURL(url);
      }
    });
    input.click();
  }

  const host: SheetFormHost = {
    pick,
    place,
    placeTitleBlock,
    openView,
    chooseLogo,
    startText: () => {
      app.setTool('text');
      requestAnimationFrame(() => app.toolOptions.querySelector<HTMLInputElement>('#text-value')?.select());
    },
    newSheetTitleBlock: () => app.uiSettings.newSheetTitleBlock,
    setNewSheetTitleBlock: (on) => {
      app.uiSettings.newSheetTitleBlock = on;
      saveUiSettings(app.uiSettings);
    },
    saved: () => {
      app.hint('Sparat.');
      // Formuläret ritas om med det sparade, så att Spara blir grå igen.
      app.panel.el.querySelector('.panel-body')!.innerHTML = '';
      app.panel.render();
      if (app.ui.navOpen) app.navigator.render();
    },
    closed: () => {
      app.panel.showTreeItem(null);
      if (app.ui.navOpen) app.navigator.render();
    },
    rerender: () => {
      app.panel.el.querySelector('.panel-body')!.innerHTML = '';
      app.panel.render();
    },
  };
  app.panel.sheetHost = host;

  // Högerklick på ett blad: smartmenyn för en vy eller ett ritningshuvud, annars bladets meny.
  app.pane2d.addEventListener(
    'contextmenu',
    (e) => {
      const sheet = app.ui.layout ? app.store.doc.sheets.find((s) => s.id === app.ui.layout) : undefined;
      if (!sheet) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      cancelMove();
      const r = app.pane2d.getBoundingClientRect();
      const t = hit(app.view.camera.toModel([e.clientX - r.left, e.clientY - r.top]));
      if (t) {
        pick(t);
        showMenu(t, e.clientX, e.clientY);
        return;
      }
      app.smartMenu.hide();
      pick({ kind: 'sheet', id: sheet.id });
      app.ctxMenu.open(
        e.clientX,
        e.clientY,
        [
          { kind: 'header', label: `${sheet.number} ${sheet.name}`, sub: 'Ritningsblad' },
          { label: 'Bladets inställningar och vyer', run: () => pick({ kind: 'sheet', id: sheet.id }) },
          { label: 'Lägg på ritningshuvud (BH90)', run: () => placeTitleBlock(sheet.id) },
          { label: 'Skriv text på bladet', hint: 'T', run: () => host.startText() },
          { label: 'Plot/export…', run: () => app.root.querySelector<HTMLElement>('.nav-plot [data-action="plot"], .main-menu [data-action="plot"]')?.click() },
        ],
        sheet.number,
      );
    },
    { capture: true },
  );

  return {
    drawing,
    tool,
    textTool: textEdit.tool,
    editText: textEdit.edit,
    resetCrop,
    pick,
    picked,
    pickedThing,
    place,
    placeTitleBlock,
    newSheet,
    openView,
    startMove,
    cancelMove,
    removePicked,
    moving: () => !!moving,
    subscribe: (f: () => void) => listeners.push(f),
  };
}
