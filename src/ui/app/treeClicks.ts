import type { Id } from '../../core/model';
import type { NavTab } from '../navigator';
import { isNarrow } from '../sheet';
import type { TreeItem } from '../treeItemPanel';
import type { AppContext } from './context';
import type { installSheets } from './sheets';
import type { installShowMenu } from './showMenu';

/**
 * Klick i projektträdet (ur actions.ts i 0.8.23): flikarna, våningar, vyer,
 * fasader och sektioner, arbetsblad, blad, underlag och mappar. Det valda
 * visas och dess inställningar kommer i egenskapspanelen.
 */
export function installTreeClicks(app: AppContext, parts: { sheets: ReturnType<typeof installSheets>; showMenu: ReturnType<typeof installShowMenu> }) {
  const { ui } = app;
  const { sheets, showMenu } = parts;

  /** Visa inställningarna för det man valt i trädet i egenskapspanelen. */
  function pickTreeItem(item: TreeItem): void {
    app.selection.clear();
    app.panel.showTreeItem(item);
    if (ui.navOpen) app.navigator.render();
  }

  /**
   * Bladen som är markerade i trädet efter ett Ctrl-klick (lägg till eller
   * ta bort) eller Shift-klick (alla blad mellan det första markerade och
   * det klickade, i nummerordning). Det första är bladet som visas, om det
   * är med.
   */
  function pickSheets(id: Id, range: boolean): { kind: 'sheet'; id: Id; also: Id[] } | null {
    const t = app.panel.treeItem;
    const now = t?.kind === 'sheet' ? [t.id, ...(t.also ?? [])] : ui.layout ? [ui.layout] : [];
    let ids: Id[];
    if (range && now.length) {
      const order = [...app.store.doc.sheets].sort((a, b) => a.number.localeCompare(b.number, 'sv', { numeric: true })).map((s) => s.id);
      const [i, j] = [order.indexOf(now[0]), order.indexOf(id)].sort((a, b) => a - b);
      ids = i < 0 ? [id] : [now[0], ...order.slice(i, j + 1).filter((x) => x !== now[0])];
    } else ids = now.includes(id) ? now.filter((x) => x !== id) : [...now, id];
    if (!ids.length) return null;
    if (ui.layout && ids.includes(ui.layout)) ids = [ui.layout, ...ids.filter((x) => x !== ui.layout)];
    return { kind: 'sheet', id: ids[0], also: ids.slice(1) };
  }

  // Dubbelklick i projektträdet när bara 3D visas (0.8.4): klicket går till
  // våningen eller vyn, dubbelklicket visar den i 2D. Trädet ritas om vid
  // klicket, så webbläsaren ser inget dubbelklick; det räknas här. Fasader,
  // sektioner, arbetsblad och blad går över till 2D redan vid klick.
  let lastPick = { key: '', t: 0 };
  function treeDoubleClick(key: string): void {
    const now = performance.now();
    const double = lastPick.key === key && now - lastPick.t < 450;
    lastPick = double ? { key: '', t: 0 } : { key, t: now };
    if (double && ui.mode === '3d') void app.setMode('2d');
  }

  /** Ett klick i trädet; svarar true om det hanterades. */
  function click(target: Element, e: MouseEvent): boolean {
    const { store, navigator } = app;
    const navTab = target.closest<HTMLElement>('[data-nav-tab]');
    if (navTab) {
      navigator.showTab(navTab.dataset.navTab as NavTab);
      if (!ui.navOpen) app.setNav(true);
      return true;
    }
    // En flik i en hopfälld egenskapspanel fäller ut den.
    if (target.closest('.panel [data-tab]') && !ui.panelOpen && !isNarrow()) {
      app.setPanel(true, 'full');
      return true;
    }
    const markerPick = target.closest<HTMLElement>('[data-marker-pick]');
    if (markerPick) {
      if (isNarrow()) app.setNav(false);
      app.goTo({ kind: 'marker', id: markerPick.dataset.markerPick! });
      pickTreeItem({ kind: 'marker', id: markerPick.dataset.markerPick! });
      return true;
    }
    const ulGroup = target.closest<HTMLElement>('[data-ul-group]');
    if (ulGroup) {
      navigator.toggleUnderlayGroup(ulGroup.dataset.ulGroup!);
      return true;
    }
    const folderToggle = target.closest<HTMLElement>('[data-folder-toggle]');
    if (folderToggle) {
      navigator.toggleFolder(folderToggle.dataset.folderToggle!);
      return true;
    }
    const folderPick = target.closest<HTMLElement>('[data-folder-pick]');
    if (folderPick) {
      pickTreeItem({ kind: 'folder', id: folderPick.dataset.folderPick! });
      // På telefonen täcker trädet allt: stäng det och visa mappens inställningar.
      if (isNarrow()) {
        app.setNav(false);
        app.setPanel(true, 'full');
      } else if (!ui.panelOpen) app.setPanel(true);
      return true;
    }
    const underlayPick = target.closest<HTMLElement>('[data-underlay-pick]');
    if (underlayPick) {
      treeDoubleClick(`underlay:${underlayPick.dataset.underlayPick}`);
      if (isNarrow()) app.setNav(false);
      app.showUnderlay(underlayPick.dataset.underlayPick!);
      return true;
    }
    const underlayMore = target.closest<HTMLElement>('[data-underlay-menu]');
    if (underlayMore) {
      const r = underlayMore.getBoundingClientRect();
      app.openUnderlayMenu(underlayMore.dataset.underlayMenu!, r.left, r.bottom + 4);
      return true;
    }
    const sheetPick = target.closest<HTMLElement>('[data-sheet-pick]');
    if (sheetPick) {
      const me = e;
      // Ctrl- eller Shift-klick (0.8.10): flera blad, för att fylla i fälten tillsammans.
      if ((me.ctrlKey || me.metaKey || me.shiftKey) && !isNarrow()) {
        sheets.pick(pickSheets(sheetPick.dataset.sheetPick!, me.shiftKey));
        return true;
      }
      // Ett ritningsblad (0.8 del 3): visa det och dess inställningar.
      if (isNarrow()) app.setNav(false);
      app.goTo({ kind: 'sheet', id: sheetPick.dataset.sheetPick! });
      sheets.pick({ kind: 'sheet', id: sheetPick.dataset.sheetPick! });
      return true;
    }
    const worksheetPick = target.closest<HTMLElement>('[data-worksheet-pick]');
    if (worksheetPick) {
      if (isNarrow()) app.setNav(false);
      app.goTo({ kind: 'worksheet', id: worksheetPick.dataset.worksheetPick! });
      pickTreeItem({ kind: 'worksheet', id: worksheetPick.dataset.worksheetPick! });
      return true;
    }
    const markerMore = target.closest<HTMLElement>('[data-marker-menu]');
    if (markerMore) {
      const r = markerMore.getBoundingClientRect();
      app.openMarkerMenu(markerMore.dataset.markerMenu!, r.left, r.bottom + 4);
      return true;
    }
    const storeyMore = target.closest<HTMLElement>('[data-storey-menu]');
    if (storeyMore) {
      const r = storeyMore.getBoundingClientRect();
      app.storeys.openMenu(storeyMore.dataset.storeyMenu!, r.left, r.bottom + 4);
      return true;
    }
    const storeyPick = target.closest<HTMLElement>('[data-storey-pick]');
    if (storeyPick) {
      treeDoubleClick(`storey:${storeyPick.dataset.storeyPick}`);
      if (isNarrow()) app.setNav(false);
      app.goTo({ kind: 'storey', id: storeyPick.dataset.storeyPick! });
      pickTreeItem({ kind: 'storey', id: storeyPick.dataset.storeyPick! });
      return true;
    }
    const viewPick = target.closest<HTMLElement>('[data-view-apply]');
    if (viewPick) {
      treeDoubleClick(`view:${viewPick.dataset.viewApply}`);
      const v = store.doc.views.find((x) => x.id === viewPick.dataset.viewApply);
      showMenu.closeShowMenu();
      if (isNarrow()) app.setNav(false);
      if (v) {
        app.applyView(v);
        pickTreeItem({ kind: 'view', id: v.id });
      }
      return true;
    }
    const viewMore = target.closest<HTMLElement>('[data-view-menu]');
    if (viewMore) {
      const r = viewMore.getBoundingClientRect();
      app.openViewMenu(viewMore.dataset.viewMenu!, r.left, r.bottom + 4);
      return true;
    }
    return false;
  }

  return { click, pickTreeItem };
}
