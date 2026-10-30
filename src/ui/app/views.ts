import { deleteElements, renameElement, updateParams } from '../../core/commands';
import { newId } from '../../core/ids';
import { onPaper, type Id, type ViewDef } from '../../core/model';
import { toggleUnderlay } from '../../core/viewUnderlays';
import { markerFrame, markerName } from '../../elements/markers';
import type { Vec2 } from '../../repr/primitives';
import { askConfirm, askText } from '../ask';
import { type MenuItem } from '../contextMenu';
import type { AppContext } from './context';
import { describeView } from './helpers';
import { categoriesOf, categoryOf, viewSettings, viewTypeAt, viewTypeOf, withShow, type ViewOverrides } from '../../core/viewCategories';

const sorted = (o: ViewOverrides | undefined) => Object.fromEntries(Object.entries(o ?? {}).sort(([a], [b]) => a.localeCompare(b)));
import { SHEET_TOOLS, SPACE_TOOLS } from './shell';

/** Ett ställe man varit på: en sparad vy, ett våningsplan i modellen, eller en fasad eller sektion. */
export type Place = { kind: 'view'; id: Id } | { kind: 'storey'; id: Id } | { kind: 'marker'; id: Id } | { kind: 'worksheet'; id: Id } | { kind: 'sheet'; id: Id };

/** Vyhistorik, Gå till (vy, våningsplan, fasad eller sektion), sparade vyer med deras inställningar, och menyerna för vyer och markörer. */
export function installViews(app: AppContext) {
  /** Senaste först. Det första är där man är nu. */
  const viewHistory: Place[] = [{ kind: 'storey', id: app.ui.storey }];
  const samePlace = (a: Place, b: Place) => a.kind === b.kind && a.id === b.id;

  function visit(p: Place): void {
    const i = viewHistory.findIndex((q) => samePlace(q, p));
    if (i >= 0) viewHistory.splice(i, 1);
    viewHistory.unshift(p);
    viewHistory.length = Math.min(viewHistory.length, 6);
  }

  function placeLabel(p: Place): { name: string; sub: string } | null {
    if (p.kind === 'view') {
      const v = app.store.doc.views.find((x) => x.id === p.id);
      return v ? { name: v.name, sub: `Vy · ${describeView(app.store.doc, v)}` } : null;
    }
    if (p.kind === 'marker') {
      const el = app.store.doc.elements[p.id];
      return el ? { name: markerName(app.store.doc, el), sub: el.type === 'Section' ? 'Sektion' : 'Fasad' } : null;
    }
    if (p.kind === 'worksheet') {
      const w = app.store.doc.worksheets.find((x) => x.id === p.id);
      return w ? { name: w.name, sub: w.stamp ? 'Stämpel' : w.paper ? 'Mallblad' : 'Arbetsblad' } : null;
    }
    if (p.kind === 'sheet') {
      const s = app.store.doc.sheets.find((x) => x.id === p.id);
      return s ? { name: `${s.number} ${s.name}`, sub: 'Ritningsblad' } : null;
    }
    const s = app.store.doc.storeys.find((x) => x.id === p.id);
    return s ? { name: s.name, sub: 'Modell' } : null;
  }

  /**
   * Vyns inställningar som de är just nu (0.10.32): kategorin där man är och
   * det i Visa-menyn som avviker från den. Den öppna vyns avvikelser i stilen
   * är kvar.
   */
  function currentViewDef(id: Id, name: string): ViewDef {
    const cat = app.place.currentCategory();
    const overrides = withShow(cat, app.place.openView()?.overrides, app.place.currentShow());
    return {
      id,
      name,
      storey: app.ui.storey,
      state: app.ui.state,
      category: cat.id,
      ...(overrides ? { overrides } : {}),
      ...(app.ui.marker ? { marker: app.ui.marker } : {}),
      ...(app.ui.worksheet ? { worksheet: app.ui.worksheet } : {}),
      ...(app.ui.scale !== 100 ? { scale: app.ui.scale } : {}),
    };
  }

  function viewModified(v: ViewDef): boolean {
    const c = currentViewDef(v.id, v.name);
    const doc = app.store.doc;
    return (
      c.storey !== v.storey ||
      c.state !== v.state ||
      categoryOf(doc.graphics, viewTypeOf(doc, c), c.category) !== categoryOf(doc.graphics, viewTypeOf(doc, v), v.category) ||
      JSON.stringify(sorted(c.overrides)) !== JSON.stringify(sorted(v.overrides)) ||
      (c.marker ?? null) !== (v.marker ?? null) ||
      (c.worksheet ?? null) !== (v.worksheet ?? null) ||
      (c.scale ?? 100) !== (v.scale ?? 100)
    );
  }

  function applyView(v: ViewDef): void {
    const doc = app.store.doc;
    const { cat, show, type } = viewSettings(doc, v);
    app.ui.activeView = v.id;
    app.ui.storey = v.storey;
    app.ui.state = v.state;
    app.ui.category = cat.id;
    app.ui.viewType = type;
    app.place.applyShow(show);
    app.ui.marker = v.marker && doc.elements[v.marker] ? v.marker : null;
    app.ui.worksheet = v.worksheet && doc.worksheets.some((w) => w.id === v.worksheet) ? v.worksheet : null;
    app.ui.layout = null;
    app.ui.scale = v.scale ?? 100;
    visit({ kind: 'view', id: v.id });
    syncDetailSwitch();
    app.renderAll();
  }

  function renderViewButton(): void {
    const v = app.ui.activeView ? app.store.doc.views.find((x) => x.id === app.ui.activeView) : undefined;
    const modified = !!v && viewModified(v);
    const storeyName = app.store.doc.storeys.find((s) => s.id === app.ui.storey)?.name ?? '';
    const markerEl = app.ui.marker ? app.store.doc.elements[app.ui.marker] : undefined;
    const sheet = app.ui.worksheet ? app.store.doc.worksheets.find((w) => w.id === app.ui.worksheet) : undefined;
    const layout = app.ui.layout ? app.store.doc.sheets.find((s) => s.id === app.ui.layout) : undefined;
    app.out('view-name').textContent = v ? `${v.name}${modified ? ' *' : ''}` : markerEl ? markerName(app.store.doc, markerEl) : sheet ? sheet.name : layout ? `${layout.number} ${layout.name}` : `${storeyName} · modell`;
    // Ändringar i vyinställningarna är tillfälliga tills de sparas i vyn.
    const save = app.$<HTMLButtonElement>('.vb-save');
    // Ett mallblad (0.8.8) blir ingen vy: det ritas på bladen som använder det.
    save.hidden = (!!v && !modified) || !!layout || onPaper(sheet);
    save.textContent = v ? 'Spara i vyn' : 'Spara som vy…';
    app.$<HTMLElement>('.viewbar').classList.toggle('modified', modified);
  }

  const NAMES = { sketch: 'skiss', normal: 'normal', detail: 'detalj' } as const;

  /** Detaljnivåns knappar (i vyraden och i Visa-menyn) visar vyns detaljnivå. */
  function syncDetailSwitch(): void {
    // Vyradens knappar gäller alla tre delarna (0.8.37); med olika nivåer är ingen nedtryckt.
    const { detail, labelDetail, modelDetail } = app.ui;
    const same = detail === labelDetail && detail === modelDetail;
    const of = (part: string | undefined) => (part === 'label' ? labelDetail : part === 'model' ? modelDetail : part === 'plan' ? detail : same ? detail : null);
    document.querySelectorAll<HTMLElement>('.detail-switch [data-detail]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.detail === of(b.dataset.detailPart))));
    document.querySelectorAll<HTMLElement>('.detail-switch:not(.detail-part-switch)').forEach((s) => {
      s.classList.toggle('mixed', !same);
      s.title = same ? '' : `Olika nivåer: littera ${NAMES[labelDetail]}, 2D ${NAMES[detail]}, 3D ${NAMES[modelDetail]}. Ändra var för sig under Visa.`;
    });
  }

  function goTo(p: Place): void {
    if (p.kind === 'view') {
      const v = app.store.doc.views.find((x) => x.id === p.id);
      if (v) applyView(v);
    } else if (p.kind === 'marker') {
      const el = app.store.doc.elements[p.id];
      if (!el) return;
      const was = app.ui.marker;
      app.ui.marker = p.id;
      app.ui.worksheet = null;
      app.ui.layout = null;
      app.ui.storey = el.storey;
      app.ui.activeView = null;
      if (app.ui.tool !== 'select' && app.ui.tool !== 'pan' && !SHEET_TOOLS.includes(app.ui.tool)) app.setTool('select');
      app.measureBox.close();
      app.smartMenu.hide();
      app.modifier.cancel();
      app.selection.clear();
      visit(p);
      if (app.ui.mode === '3d') void app.setMode('2d');
      app.renderAll();
      if (was !== p.id) app.view.zoomToFit();
    } else if (p.kind === 'worksheet') {
      // Ett arbetsblad (0.8 del 2): en egen yta som inte hör till någon våning.
      if (!app.store.doc.worksheets.some((w) => w.id === p.id)) return;
      const was = app.ui.worksheet;
      app.ui.worksheet = p.id;
      app.ui.marker = null;
      app.ui.layout = null;
      app.ui.activeView = null;
      if (app.ui.tool !== 'select' && app.ui.tool !== 'pan' && !SPACE_TOOLS.includes(app.ui.tool)) app.setTool('select');
      app.measureBox.close();
      app.smartMenu.hide();
      app.modifier.cancel();
      app.selection.clear();
      visit(p);
      if (app.ui.mode === '3d') void app.setMode('2d');
      app.renderAll();
      if (was !== p.id) app.view.zoomToFit();
    } else if (p.kind === 'sheet') {
      // Ett ritningsblad (0.8 del 3): papperet med vyerna i sin skala.
      if (!app.store.doc.sheets.some((s) => s.id === p.id)) return;
      const was = app.ui.layout;
      app.ui.layout = p.id;
      app.ui.marker = null;
      app.ui.worksheet = null;
      app.ui.activeView = null;
      if (app.ui.tool !== 'select' && app.ui.tool !== 'pan' && !SHEET_TOOLS.includes(app.ui.tool)) app.setTool('select');
      app.measureBox.close();
      app.smartMenu.hide();
      app.modifier.cancel();
      app.selection.clear();
      visit(p);
      if (app.ui.mode !== '2d') void app.setMode('2d');
      app.renderAll();
      if (was !== p.id) app.view.zoomToFit();
    } else if (app.store.doc.storeys.some((s) => s.id === p.id)) {
      const was = app.ui.marker ?? app.ui.worksheet ?? app.ui.layout;
      app.ui.storey = p.id;
      app.ui.marker = null;
      app.ui.worksheet = null;
      app.ui.layout = null;
      app.ui.activeView = null;
      visit(p);
      app.renderAll();
      if (was) {
        app.selection.clear();
        app.view.zoomToFit();
      }
    }
  }

  /** Högerklick eller ⋯ på en fasad eller sektion. */
  function openMarkerMenu(id: Id, x: number, y: number): void {
    const el = app.store.doc.elements[id];
    if (!el) return;
    const p = el.params as { auto?: boolean; side?: number };
    const name = markerName(app.store.doc, el);
    app.ctxMenu.open(
      x,
      y,
      [
        { kind: 'header', label: name, sub: el.type === 'Section' ? 'Sektion' : 'Fasad' },
        { label: 'Visa', disabled: app.ui.marker === id, run: () => goTo({ kind: 'marker', id }) },
        {
          label: 'Visa linjen i planen',
          run: () => {
            goTo({ kind: 'storey', id: el.storey });
            app.selection.set([id]);
          },
        },
        { label: 'Byt namn…', run: () => void renameMarker(id) },
        {
          label: 'Placeras automatiskt',
          checked: !!p.auto,
          sub: el.type === 'Section' ? 'Genom mitten av huset' : 'Utanför huset, följer det',
          run: () => setMarkerAuto(id, !p.auto),
        },
        { label: 'Vänd blickriktningen', disabled: !!p.auto, run: () => updateParams(app.store, [id], { side: -(p.side ?? 1) }, 'Vänd blickriktningen') },
        { kind: 'sep' },
        ...newViewItems({ marker: id }),
        { kind: 'sep' },
        { label: 'Ta bort…', danger: true, disabled: !!el.locked, sub: el.locked ? 'Låst' : undefined, run: () => void deleteMarker(id) },
      ],
      name,
    );
  }

  async function renameMarker(id: Id): Promise<void> {
    const el = app.store.doc.elements[id];
    if (!el) return;
    const name = await askText('Byt namn', markerName(app.store.doc, el));
    if (name === null) return;
    renameElement(app.store, id, name);
  }

  /** Slå på eller av automatisk placering. Av: linjen stannar där den är nu. */
  function setMarkerAuto(id: Id, auto: boolean): void {
    const el = app.store.doc.elements[id];
    if (!el) return;
    if (auto) {
      updateParams(app.store, [id], { auto: true }, 'Placera automatiskt');
      return;
    }
    const f = markerFrame(app.store.doc, el);
    const r2 = (q: Vec2): [number, number] => [Math.round(q[0]), Math.round(q[1])];
    updateParams(app.store, [id], { auto: false, start: r2(f.start), end: r2(f.end), side: 1 }, 'Placera själv');
  }

  async function deleteMarker(id: Id): Promise<void> {
    const el = app.store.doc.elements[id];
    if (!el) return;
    const name = markerName(app.store.doc, el);
    if (!(await askConfirm(`Ta bort ${name}?`, 'Linjen tas bort ur planen och vyn ur projektträdet. Det går att ångra.'))) return;
    if (app.ui.marker === id) goTo({ kind: 'storey', id: el.storey });
    deleteElements(app.store, [id]);
  }

  /** De senaste vyerna, vid vyknappen. */
  function openHistoryMenu(x: number, y: number): void {
    const items: MenuItem[] = [{ kind: 'header', label: 'Senaste vyerna' }];
    viewHistory
      .map((p) => ({ p, l: placeLabel(p) }))
      .filter((r) => r.l)
      .slice(0, 5)
      .forEach(({ p, l }, i) =>
        items.push({ label: l!.name, sub: l!.sub, hint: i === 0 ? 'nu' : i === 1 ? 'klick' : undefined, disabled: i === 0, run: () => goTo(p) }),
      );
    items.push({ kind: 'sep' }, { label: 'Alla vyer i projektträdet', run: () => (app.navigator.showTab('vyer'), app.setNav(true)) });
    if (!app.ui.activeView) items.push({ label: 'Spara det som visas som vy…', run: () => void saveViewAsNew() });
    app.ctxMenu.open(x, y, items, 'Senaste vyerna');
  }

  /** Högerklick eller ⋯ på en vy i projektträdet. */
  function openViewMenu(id: Id, x: number, y: number): void {
    const v = app.store.doc.views.find((q) => q.id === id);
    if (!v) return;
    const traced = app.ui.underlays.some((u) => u.source === id);
    app.ctxMenu.open(
      x,
      y,
      [
        { kind: 'header', label: v.name, sub: describeView(app.store.doc, v) },
        { label: 'Visa vyn', run: () => applyView(v), disabled: app.ui.activeView === id && !viewModified(v) },
        { label: traced ? 'Sluta kalkera vyn' : 'Kalkera den här vyn', sub: 'Som underlag där du är', checked: traced, disabled: app.ui.activeView === id || !!app.ui.layout, run: () => toggleUnderlaySource(id) },
        ...(app.ui.activeView === id ? [{ label: 'Spara nuvarande inställningar i vyn', disabled: !viewModified(v), run: () => void updateActiveView() }] : []),
        { label: 'Stil för vyn…', sub: 'Avvikelserna från kategorin', run: () => app.styleDialog.open({ view: id }) },
        { label: 'Byt namn…', run: () => void renameView(id) },
        { label: 'Duplicera', run: () => duplicateView(id) },
        { kind: 'sep' },
        { label: 'Ta bort…', danger: true, run: () => void deleteView(id) },
      ],
      v.name,
    );
  }

  async function saveViewAsNew(): Promise<void> {
    app.closeShowMenu();
    const st = app.store.doc.states.find((x) => x.id === app.ui.state)?.name ?? '';
    // Namnet på det som visas: fasaden eller sektionen om en är öppen, annars våningen.
    const m = app.ui.marker ? app.store.doc.elements[app.ui.marker] : undefined;
    const ws = app.ui.worksheet ? app.store.doc.worksheets.find((x) => x.id === app.ui.worksheet) : undefined;
    const shown = m ? markerName(app.store.doc, m) : ws ? ws.name : (app.store.doc.storeys.find((x) => x.id === app.ui.storey)?.name ?? '');
    const name = await askText('Spara som vy', st ? `${shown} – ${st}` : shown);
    if (!name) return;
    const v = currentViewDef(newId('vy'), name);
    app.store.transact(`Ny vy: ${name}`, (tx) => tx.setViews([...tx.doc.views, v]));
    app.ui.activeView = v.id;
    visit({ kind: 'view', id: v.id });
    app.renderAll();
  }

  async function updateActiveView(): Promise<void> {
    app.closeShowMenu();
    const v = app.store.doc.views.find((x) => x.id === app.ui.activeView);
    if (v) app.store.transact(`Spara vyn ${v.name}`, (tx) => tx.setViews(tx.doc.views.map((x) => (x.id === v.id ? currentViewDef(v.id, v.name) : x))));
  }

  async function renameView(id: Id): Promise<void> {
    const v = app.store.doc.views.find((x) => x.id === id);
    if (!v) return;
    const name = await askText('Byt namn på vyn', v.name);
    if (name && name !== v.name) app.store.transact(`Byt namn på vyn till ${name}`, (tx) => tx.setViews(tx.doc.views.map((x) => (x.id === id ? { ...x, name } : x))));
  }

  function duplicateView(id: Id): void {
    const v = app.store.doc.views.find((x) => x.id === id);
    if (!v) return;
    const copy = { ...structuredClone(v), id: newId('vy'), name: `${v.name} (kopia)` };
    app.store.transact(`Duplicera vyn ${v.name}`, (tx) => tx.setViews([...tx.doc.views, copy]));
  }

  async function deleteView(id: Id): Promise<void> {
    const v = app.store.doc.views.find((x) => x.id === id);
    if (!v || !(await askConfirm('Ta bort vyn?', `${v.name} tas bort. Det går att ångra.`))) return;
    if (app.ui.activeView === id) app.ui.activeView = null;
    app.ui.underlays = app.ui.underlays.filter((u) => u.source !== id);
    app.store.transact(`Ta bort vyn ${v.name}`, (tx) => tx.setViews(tx.doc.views.filter((x) => x.id !== id)));
  }

  /**
   * Ny vy av en våning eller en fasad/sektion, från högerklick i
   * projektträdet (0.10.30): det som visas nu (tillstånd, detaljnivå, Visa)
   * för det stället, eller (0.10.33) en av vytypens kategorier som den är,
   * med ett namn man skriver. Vyn öppnas.
   */
  async function newViewOf(place: { storey: Id } | { marker: Id }, category?: string): Promise<void> {
    const doc = app.store.doc;
    const m = 'marker' in place ? doc.elements[place.marker] : undefined;
    const storey = m ? m.storey : 'storey' in place ? place.storey : app.ui.storey;
    const type = viewTypeAt(doc, storey, m?.id);
    const where = m ? markerName(doc, m) : (doc.storeys.find((s) => s.id === storey)?.name ?? '');
    const cat = category !== undefined ? categoryOf(doc.graphics, type, category) : undefined;
    const st = doc.states.find((x) => x.id === app.ui.state)?.name ?? '';
    const suffix = cat ? cat.name : st;
    const name = (await askText('Ny vy', suffix ? `${where} – ${suffix}` : where))?.trim();
    if (!name) return;
    const base = currentViewDef(newId('vy'), name);
    // Samma vytyp som där man är: kategorin och avvikelserna följer med; annars vytypens första kategori (0.10.32). En vald kategori som den är (0.10.33).
    const same = !cat && type === app.place.viewType();
    const { marker: _m, worksheet: _w, category: here, overrides, ...rest } = base;
    const v: ViewDef = {
      ...rest,
      storey,
      ...(cat ? { category: cat.id, scale: cat.scale } : same ? { category: here, ...(overrides ? { overrides } : {}) } : { scale: categoryOf(doc.graphics, type).scale }),
      ...(m ? { marker: m.id } : {}),
    };
    if (cat && v.scale === 100) delete v.scale;
    app.store.transact(`Ny vy: ${name}`, (tx) => tx.setViews([...tx.doc.views, v]));
    applyView(app.store.doc.views.find((x) => x.id === v.id)!);
  }

  /** Menyns rader för en ny vy (0.10.33): det som visas nu, och vytypens kategorier. */
  function newViewItems(place: { storey: Id } | { marker: Id }): MenuItem[] {
    const doc = app.store.doc;
    const m = 'marker' in place ? doc.elements[place.marker] : undefined;
    const type = viewTypeAt(doc, m ? m.storey : 'storey' in place ? place.storey : app.ui.storey, m?.id);
    return [
      { kind: 'header', label: 'Ny vy' },
      { label: 'Med det som visas nu…', run: () => void newViewOf(place) },
      ...categoriesOf(doc.graphics, type).map((c): MenuItem => ({ label: `${c.name}…`, sub: `1:${c.scale}`, run: () => void newViewOf(place, c.id) })),
    ];
  }

  /**
   * Kalkera (0.10.35): en genväg som lägger källan som underlag där man är,
   * eller tar bort den. Utseendet ställs in under Visa.
   */
  function toggleUnderlaySource(source: string): void {
    const on = !app.ui.underlays.some((u) => u.source === source);
    app.ui.underlays = toggleUnderlay(app.ui.underlays, source);
    app.renderAll();
    if (on) app.hint('Ligger som underlag i vyn. Under Visa ställs det in, och Spara i vyn tar med det till bladet.', 5000);
  }
  // *Gå dit* i stilbokens lista över vyerna med en kategori (0.10.33).
  app.styleDialog.goToView = (id) => {
    const v = app.store.doc.views.find((x) => x.id === id);
    if (v) applyView(v);
  };
  // *Gå dit* i stilbokens lista över materialens ställen (0.10.36): objektets våning eller Platsen, markerat och i bild.
  app.styleDialog.goToObject = (id) => {
    const el = app.store.doc.elements[id];
    if (!el) return;
    if (app.ui.mode === '3d') void app.setMode('2d');
    goTo({ kind: 'storey', id: el.storey });
    app.selection.set([id]);
    app.renderAll();
    requestAnimationFrame(() => app.zoomToSelection());
  };
  return { applyView, currentViewDef, goTo, newViewItems, newViewOf, openHistoryMenu, openMarkerMenu, openViewMenu, renderViewButton, saveViewAsNew, syncDetailSwitch, toggleUnderlaySource, updateActiveView, viewHistory, viewModified, visit };
}
