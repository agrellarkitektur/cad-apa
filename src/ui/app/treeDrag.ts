import type { Id } from '../../core/model';
import { moveIntoFolder } from '../../core/treeCommands';
import type { AppContext } from './context';

/** Knapparna i trädets rader och vilket id de bär. */
const ROW_KEYS = ['folderPick', 'viewApply', 'markerPick', 'storeyPick', 'worksheetPick', 'sheetPick', 'underlayPick'] as const;
const MIME = 'application/x-bacchus-tree';

function rowId(row: HTMLElement): Id | null {
  const b = row.querySelector<HTMLElement>(':scope > .view-apply');
  if (!b) return null;
  for (const k of ROW_KEYS) if (b.dataset[k]) return b.dataset[k]!;
  return null;
}

/**
 * Dra och släpp i projektträdet (0.8.18): vyer, ritningar, våningar,
 * fasader, sektioner, arbetsblad, underlag och mappar dras till en mapp i
 * samma flik. Släpps det på en rad i en mapp hamnar det i den mappen, och
 * släpps det utanför alla mappar läggs det utanför. Är flera blad eller
 * underlag markerade och man drar ett av dem följer de andra med.
 */
export function installTreeDrag(app: AppContext): void {
  const nav = app.navigator;
  let dragging: Id[] | null = null;
  let over: HTMLElement | null = null;

  const clearOver = () => {
    over?.classList.remove('drop-target');
    over = null;
    nav.el.querySelector('.nav-body')?.classList.remove('drop-out');
  };

  nav.onRender = (body) => {
    body.querySelectorAll<HTMLElement>('.view-row').forEach((row) => {
      if (rowId(row)) row.draggable = true;
    });
  };

  const now = nav.el.querySelector<HTMLElement>('.nav-body');
  if (now) nav.onRender(now);

  /** Mappen ett släpp hamnar i: mappen raden ligger i, eller null utanför alla. */
  const folderAt = (t: EventTarget | null): { folder: Id | null; el: HTMLElement } | null => {
    const el = t instanceof HTMLElement ? t : null;
    const body = nav.el.querySelector<HTMLElement>('.nav-body');
    if (!el || !body || !body.contains(el)) return null;
    const folder = el.closest<HTMLElement>('.folder:not(.ul-group)');
    if (!folder) return { folder: null, el: body };
    const head = folder.querySelector<HTMLElement>(':scope > .folder-row');
    const id = head?.querySelector<HTMLElement>('[data-folder-pick]')?.dataset.folderPick;
    return id && head ? { folder: id, el: head } : null;
  };

  nav.el.addEventListener('dragstart', (e) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>('.view-row');
    const id = row ? rowId(row) : null;
    if (!row || !id || !e.dataTransfer) return;
    // Flera markerade blad (eller underlag) följer med det man drar.
    const many = [...nav.el.querySelectorAll<HTMLElement>('.view-row.picked, .view-row.active')].map(rowId).filter((x): x is Id => !!x);
    dragging = many.length > 1 && many.includes(id) && nav.tab !== 'vyer' && nav.tab !== 'modell' ? many : [id];
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData(MIME, dragging.join(','));
    e.dataTransfer.setData('text/plain', row.querySelector('.view-apply')?.textContent?.trim() ?? '');
    row.classList.add('dragging');
  });

  nav.el.addEventListener('dragover', (e) => {
    if (!dragging) return;
    const at = folderAt(e.target);
    if (!at || (at.folder && dragging.includes(at.folder))) {
      clearOver();
      return;
    }
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    if (over !== at.el) {
      clearOver();
      over = at.el;
      at.el.classList.add(at.folder ? 'drop-target' : 'drop-out');
    }
  });

  nav.el.addEventListener('dragleave', (e) => {
    if (!nav.el.contains(e.relatedTarget as Node | null)) clearOver();
  });

  nav.el.addEventListener('drop', (e) => {
    const items = dragging;
    const at = folderAt(e.target);
    clearOver();
    if (!items || !at) return;
    e.preventDefault();
    const n = moveIntoFolder(app.store, items, at.folder);
    if (!n) return;
    const name = at.folder ? app.store.doc.folders.find((f) => f.id === at.folder)?.name : null;
    app.hint(name ? `Flyttade ${n === 1 ? 'en' : n} till ${name}.` : `Flyttade ${n === 1 ? 'en' : n} ut ur mappen.`);
    nav.render();
  });

  nav.el.addEventListener('dragend', () => {
    dragging = null;
    clearOver();
    nav.el.querySelectorAll('.dragging').forEach((r) => r.classList.remove('dragging'));
  });
}
