import { deleteElements } from '../../core/commands';
import type { Id, Sheet } from '../../core/model';
import { addScaleBar, addViewport, createMaster, createSheet, createStamp, FRAME_MARGIN, mastersOf, paperSize, placeStamp, setViewportCrop, stampsOf, today } from '../../core/sheets';
import { buildSheet, cachedViewPrims, contentBounds, VIEWPORT_PAD, viewSource, type PlacedView, type SheetDrawing } from '../../repr/sheet';
import { boundsOf, type Bounds, type Vec2 } from '../../repr/primitives';
import { pickAt } from '../../view2d/pick';
import type { ViewPointer } from '../../view2d/planView';
import { isNarrow } from '../sheet';
import { freeSpot } from './sheetGeometry';
import { SheetTool } from './sheetTool';
import type { SheetFormHost } from '../sheetForms';
import type { SmartMenuCustom } from '../smartMenu';
import { pxToMm } from '../tools/host';
import type { AppContext } from './context';
import { screenBox } from './selectionPlace';

/**
 * Ritningsbladen i appen (0.8 del 3): bladet som visas, verktyget som
 * markerar och flyttar på det, att lägga en vy på ett blad, nya blad och
 * mallblad (0.8.8) och formulären i egenskapspanelen.
 *
 * Sedan 0.8.9 är bladet en yta som ett mallblad: linjer, ytor, text och
 * bilder ritas på det med de vanliga verktygen (elementen har `space` satt
 * till bladets id). Vyerna på bladet markeras som de: deras id ligger i
 * `selection`, så att vyer och ritade objekt markeras, flyttas och tas bort
 * tillsammans (`moveElements` och `deleteElements` känner igen vyerna).
 *
 * På ett blad är koordinaterna mm på papperet och ritningsskalan 1:1, så
 * att texter och linjer får sin storlek på papper.
 */
export function installSheets(app: AppContext) {
  let last: { doc: unknown; sheet: Sheet; autoDims: boolean; day: string; drawing: SheetDrawing } | null = null;

  /** Bladet som visas, ritat. Sparas tills projektet eller bladet ändras. */
  function drawing(): SheetDrawing | null {
    const sheet = app.ui.layout ? app.store.doc.sheets.find((s) => s.id === app.ui.layout) : undefined;
    if (!sheet) return null;
    const doc = app.store.doc;
    const autoDims = app.uiSettings.autoDims;
    const day = today();
    if (last && last.doc === doc && last.sheet === sheet && last.autoDims === autoDims && last.day === day) return last.drawing;
    const d = buildSheet(doc, sheet, { autoDims, today: day });
    last = { doc, sheet, autoDims, day, drawing: d };
    return d;
  }

  const viewOf = (id: Id): PlacedView | undefined => drawing()?.views.find((v) => v.id === id);

  /** Den vy på bladet som är markerad ensam, annars null. */
  function pickedViewport(): Id | null {
    if (!app.ui.layout || app.selection.size !== 1) return null;
    const id = app.selection.list()[0];
    return viewOf(id) ? id : null;
  }

  /** Visa bladet i egenskapspanelen, eller markera en vy på det. */
  function pick(item: { kind: 'sheet' | 'viewport'; id: Id; also?: readonly Id[] } | null): void {
    if (item?.kind === 'viewport') {
      app.panel.showTreeItem(null);
      app.selection.set([item.id]);
    } else {
      app.selection.clear();
      app.panel.showTreeItem(item);
    }
    if (item && !isNarrow() && !app.ui.panelOpen) app.setPanel(true);
    if (app.ui.navOpen) app.navigator.render();
    if (app.smartMenu.custom && item?.kind !== 'viewport') app.smartMenu.hide();
    app.view.requestRender();
  }

  // Inget markerat på ett blad: panelen visar bladet. En ensam markerad vy visar vyns formulär.
  app.selection.subscribe(() => {
    if (!app.ui.layout) return;
    if (app.selection.size === 0 && app.panel.treeItem?.id !== app.ui.layout) app.panel.showTreeItem({ kind: 'sheet', id: app.ui.layout });
  });
  app.panel.selectionItem = () => {
    const id = pickedViewport();
    return id ? { kind: 'viewport', id } : null;
  };

  /** Det översta på bladet under en punkt: det ritade ligger över vyerna. */
  function hitAt(p: ViewPointer): Id | null {
    const d = drawing();
    if (!d) return null;
    return pickAt(d.pickables, p.model, pxToMm(app.host, p.pointerType === 'touch' ? 14 : 6), 1);
  }

  /** Ytorna på bladet som en flyttad vy fäster mot: de andra vyerna och det ritade. */
  function framesBut(id: Id): Bounds[] {
    const d = drawing();
    if (!d) return [];
    const sel = new Set(app.selection.list());
    const out: Bounds[] = d.views.filter((v) => v.id !== id).map((v) => v.frame);
    for (const pk of d.pickables) {
      if (pk.id === id || sel.has(pk.id) || viewOf(pk.id)) continue;
      const b = boundsOf(pk.prims);
      if (b) out.push(b);
    }
    return out;
  }

  /** Återställ vyns ram till innehållet. */
  function resetCrop(vpId: Id): void {
    if (app.ui.layout) setViewportCrop(app.store, app.ui.layout, vpId, null);
    app.smartMenu.refresh(true);
  }

  /**
   * Smartmenyn för en ensam markerad vy på bladet. Flytta går genom
   * Modifiera som för andra objekt.
   */
  function menuFor(vpId: Id): SmartMenuCustom | null {
    const sheet = app.store.doc.sheets.find((s) => s.id === app.ui.layout);
    const vp = sheet?.viewports.find((v) => v.id === vpId);
    if (!sheet || !vp) return null;
    const alive = () => pickedViewport() === vpId;
    const anchor = () => {
      const f = viewOf(vpId)?.frame;
      return f ? screenBox(app.view, app.pane2d, { ...f, minY: f.minY - 8 }) : null;
    };
    return {
      title: vp.title || viewSource(app.store.doc, vp.view)?.name || 'Vy',
      sub: `1:${vp.scale} på ${sheet.number}`,
      buttons: [
        { id: 'move', label: 'Flytta', icon: 'move', pressed: app.modifier.active === 'move' },
        { id: 'open', label: 'Öppna vyn', icon: 'navigator' },
        // Kort i menyn; formuläret säger "Återställ ramen till innehållet" (0.8.9).
        ...(vp.crop ? [{ id: 'reset-crop', label: 'Återställ ram', icon: 'fit' as const }] : []),
        { id: 'props', label: 'Egenskaper', icon: 'properties' },
        { id: 'remove', label: 'Ta bort', icon: 'trash', danger: true },
      ],
      anchor,
      alive,
      run: (id) => menuAction(vpId, id),
    };
  }

  function menuAction(vpId: Id, id: string): void {
    switch (id) {
      case 'move':
        app.modifier.chooseRail('move');
        break;
      case 'props':
        if (!app.ui.panelOpen) app.setPanel(true);
        break;
      case 'reset-crop':
        resetCrop(vpId);
        break;
      case 'open': {
        const vp = app.store.doc.sheets.find((s) => s.id === app.ui.layout)?.viewports.find((v) => v.id === vpId);
        if (vp) openView(vp.view);
        break;
      }
      case 'remove':
        app.smartMenu.hide();
        app.selection.clear();
        deleteElements(app.store, [vpId]);
        break;
    }
  }

  // Smartmenyn för en ensam vy kommer härifrån; för det ritade och för flera markerade som vanligt.
  app.smartMenu.customFor = () => {
    const id = pickedViewport();
    return id && !app.modifier.busy ? menuFor(id) : null;
  };

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

  const tool = new SheetTool(app, { drawing, viewOf, pickedViewport, hitAt, targets: framesBut, openView });

  /**
   * Var en ny vy får plats på bladet: uppifrån till vänster, utan att lägga
   * sig på de andra vyerna eller det som är ritat. Svarar med mitten; vyns
   * rubrik under den tar 12 mm.
   */
  function spotFor(sheet: Sheet, size: [number, number]): Vec2 {
    const [W, H] = paperSize(sheet);
    const area: Bounds = { minX: FRAME_MARGIN.left + 6, minY: FRAME_MARGIN.bottom + 6, maxX: W - FRAME_MARGIN.right - 6, maxY: H - FRAME_MARGIN.top - 6 };
    const taken: Bounds[] = (drawing()?.views ?? []).map((v) => ({ ...v.frame, minY: v.frame.minY - 12 }));
    for (const pk of drawing()?.pickables ?? []) {
      const b = viewOf(pk.id) ? null : boundsOf(pk.prims);
      if (b) taken.push(b);
    }
    const c = freeSpot(area, taken, [size[0], size[1] + 12]);
    return c ? [c[0], c[1] + 6] : [(area.minX + area.maxX) / 2, (area.minY + area.maxY) / 2];
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
    const c = spotFor(sheet, size);
    const mid: Vec2 = b ? [(b.minX + b.maxX) / 2 / scale, (b.minY + b.maxY) / 2 / scale] : [0, 0];
    const id = addViewport(app.store, sheetId, { view, scale, at: [Math.round(c[0] - mid[0]), Math.round(c[1] - mid[1])] });
    const [W, H] = paperSize(sheet);
    if (size[0] > W - 40 || size[1] > H - 30) app.hint(`Vyn är större än bladet i 1:${scale}. Välj en mindre skala eller ett större format.`, 5000);
    if (id) pick({ kind: 'viewport', id });
  }

  /** Ett nytt blad med projektets förvalda mallblad (0.8.8). */
  function newSheet(): void {
    const id = createSheet(app.store, { name: 'Nytt blad' });
    app.goTo({ kind: 'sheet', id });
    pick({ kind: 'sheet', id });
    if (isNarrow()) {
      app.setNav(false);
      app.setPanel(true, 'full');
    }
    requestAnimationFrame(() => app.panel.el.querySelector<HTMLInputElement>('.sheet-form input[name="name"]')?.select());
    const master = app.store.doc.sheets.find((s) => s.id === id)?.master;
    app.hint(master ? 'Ett nytt blad med projektets mallblad. Lägg vyer på det i egenskaperna.' : 'Ett blankt blad. Välj mallblad och lägg vyer på det i egenskaperna.', 4000);
  }

  /** Ett nytt mallblad (0.8.8), A3 liggande, öppnat för att rita på. */
  function newMaster(): void {
    const n = mastersOf(app.store.doc).length + 1;
    const id = createMaster(app.store, { name: `Mallblad ${n}` });
    app.goTo({ kind: 'worksheet', id });
    pick(null);
    app.panel.showTreeItem({ kind: 'worksheet', id });
    if (!isNarrow() && !app.ui.panelOpen) app.setPanel(true);
    if (app.ui.navOpen) app.navigator.render();
    app.hint('Ett tomt mallblad. Rita ram, huvud och texter med smarttext i mm på papperet; blad som använder mallen visar dem.', 5000);
  }

  /** En ny stämpel (0.8.12), öppnad för att rita på. */
  function newStamp(): void {
    const n = stampsOf(app.store.doc).length + 1;
    const id = createStamp(app.store, `Stämpel ${n}`);
    app.goTo({ kind: 'worksheet', id });
    pick(null);
    app.panel.showTreeItem({ kind: 'worksheet', id });
    if (!isNarrow() && !app.ui.panelOpen) app.setPanel(true);
    if (app.ui.navOpen) app.navigator.render();
    app.hint('En tom stämpel. Rita den i mm kring nollpunkten (krysset); den läggs på bladen med nollpunkten där du vill ha den.', 5000);
  }

  /** Lägg en skalstock på bladet och markera den (0.8.12). */
  function addScaleBarTo(sheetId: Id, at?: Vec2): void {
    const id = addScaleBar(app.store, sheetId, at ? [Math.round(at[0]), Math.round(at[1])] : undefined);
    if (!id) return;
    if (app.ui.layout === sheetId) app.selection.set([id]);
    app.hint('Skalstocken följer bladets första vy. Välj en annan vy eller en egen skala i egenskaperna, och dra den dit den ska.', 5000);
  }

  /** Lägg en stämpel på bladet och markera den (0.8.12). Utan läge hamnar den nere till vänster innanför ramen. */
  function placeStampOn(sheetId: Id, stamp: Id, at?: Vec2): void {
    const id = placeStamp(app.store, sheetId, stamp, at ? [at[0], at[1]] : [FRAME_MARGIN.left + 15, FRAME_MARGIN.bottom + 15]);
    if (!id) return;
    if (app.ui.layout === sheetId) app.selection.set([id]);
    app.hint('Dra stämpeln dit den ska. Ändras stämpeln ändras den på alla blad.', 4000);
  }

  const host: SheetFormHost = {
    addScaleBar: (sheetId) => addScaleBarTo(sheetId),
    placeStamp: (sheetId, stamp) => placeStampOn(sheetId, stamp),
    newStamp,
    pick,
    place,
    openView,
    openMaster: (id) => app.goTo({ kind: 'worksheet', id }),
    startText: () => {
      app.setTool('text');
      requestAnimationFrame(() => app.toolOptions.querySelector<HTMLInputElement>('#text-value')?.select());
    },
    startDraw: () => app.setTool('draw2d'),
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

  // Högerklick på ett blad: smartmenyn för en vy, den vanliga menyn för det ritade, annars bladets meny.
  app.pane2d.addEventListener(
    'contextmenu',
    (e) => {
      const sheet = app.ui.layout ? app.store.doc.sheets.find((s) => s.id === app.ui.layout) : undefined;
      if (!sheet) return;
      const r = app.view.svg.getBoundingClientRect();
      const screen: Vec2 = [e.clientX - r.left, e.clientY - r.top];
      const hit = hitAt({ model: app.view.camera.toModel(screen), screen, pointerType: 'mouse', shift: false, mod: false, alt: false } as ViewPointer);
      if (hit && !viewOf(hit)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (hit) {
        app.selection.set([hit]);
        const m = menuFor(hit);
        if (m) app.smartMenu.showCustom(m, e.clientX, e.clientY);
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
          ...(sheet.master ? [{ label: 'Öppna mallbladet', run: () => app.goTo({ kind: 'worksheet', id: sheet.master! }) }] : []),
          { label: 'Skriv text på bladet', hint: 'T', run: () => host.startText() },
          { label: 'Rita linjer och ytor på bladet', run: () => host.startDraw() },
          { label: 'Lägg på skalstock här', run: () => addScaleBarTo(sheet.id, app.view.camera.toModel(screen)) },
          ...stampsOf(app.store.doc).map((w) => ({ label: `Lägg på stämpeln ${w.name} här`, run: () => placeStampOn(sheet.id, w.id, app.view.camera.toModel(screen)) })),
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
    resetCrop,
    pick,
    pickedViewport,
    place,
    newSheet,
    newMaster,
    newStamp,
    openView,
  };
}
