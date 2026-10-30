import type { Id, ProjectDoc, TreeTab } from '../../core/model';
import { today } from '../../core/sheets';
import { browserDeflate, imageKey, writePdf, type PdfImage, type PdfPage } from '../../formats/pdf';
import { uniqueNames, writeZip, type ZipEntry } from '../../formats/zip';
import { buildSheet, buildViewPage } from '../../repr/sheet';
import { saveBlobFile } from '../../storage/projectFile';
import { icons } from '../icons';
import { escapeHtml } from '../labels';
import { describeSheet } from '../sheetForms';
import type { AppContext } from './context';
import { describeView } from './helpers';

/**
 * Plot/export (0.8 del 3): ett ställe för all export. Blad och vyer väljs
 * med kryssrutor grupperade efter mapparna i projektträdet, och blir PDF:er
 * i vektorform i en zipfil. Exporten visar hur långt den kommit och går att
 * avbryta.
 */

const esc = escapeHtml;

/** Ett blad eller en vy att exportera, med nyckeln `sheet:<id>` eller `view:<id>`. */
interface PlotItem {
  key: string;
  name: string;
  sub: string;
}

/** Fliken med mappar och det som ligger i dem, som kryssrutor. */
function treeMarkup(doc: ProjectDoc, tab: TreeTab, items: (PlotItem & { id: Id })[], checked: ReadonlySet<string>): string {
  const folders = doc.folders.filter((f) => f.tab === tab);
  const valid = new Set(folders.map((f) => f.id));
  const row = (it: PlotItem) =>
    `<label class="check plot-item"><input type="checkbox" data-plot-item="${esc(it.key)}"${checked.has(it.key) ? ' checked' : ''}><span>${esc(it.name)}<small>${esc(it.sub)}</small></span></label>`;
  const branch = (parent: Id | null): string => {
    const sub = folders
      .filter((f) => f.parent === parent)
      .sort((a, b) => a.name.localeCompare(b.name, 'sv', { numeric: true }))
      .map((f) => {
        const inner = branch(f.id);
        if (!inner) return '';
        return `<div class="plot-folder"><label class="check plot-folder-head"><input type="checkbox" data-plot-folder>${icons.folder}<span>${esc(f.name)}</span></label><div class="plot-children">${inner}</div></div>`;
      })
      .join('');
    const own = items.filter((it) => (parent ? doc.tree[it.id] === parent : !(doc.tree[it.id] && valid.has(doc.tree[it.id])))).map(row).join('');
    return sub + own;
  };
  return branch(null);
}

export function installPlot(app: AppContext, exportImage: (src: { asset: string; page?: number }, gray: boolean) => Promise<PdfImage | null>) {
  const el = document.createElement('div');
  el.className = 'dialog-backdrop plot-backdrop';
  el.hidden = true;
  app.root.appendChild(el);
  /** Det som är ikryssat; bladen från början, vyerna när man väljer dem. */
  let checked = new Set<string>();
  let job: { cancel: boolean } | null = null;

  function items(doc: ProjectDoc) {
    const sheets = doc.sheets.map((s) => ({ id: s.id, key: `sheet:${s.id}`, name: `${s.number} ${s.name}`, sub: describeSheet(s) }));
    const views = doc.views.map((v) => ({ id: v.id, key: `view:${v.id}`, name: v.name, sub: describeView(app.store.doc, v) }));
    return { sheets, views };
  }

  function render(): void {
    const doc = app.store.doc;
    const { sheets, views } = items(doc);
    const group = (title: string, tab: TreeTab, list: (PlotItem & { id: Id })[], empty: string) =>
      `<section class="plot-group"><label class="check plot-group-head"><input type="checkbox" data-plot-folder><b>${title}</b></label>${list.length ? `<div class="plot-children">${treeMarkup(doc, tab, list, checked)}</div>` : `<p class="note">${empty}</p>`}</section>`;
    el.innerHTML = `<form class="dialog plot-dialog" role="dialog" aria-modal="true" aria-labelledby="plot-title">
      <header><h2 id="plot-title">Plot/export</h2><button type="button" class="icon-btn" data-plot="close" aria-label="Stäng">×</button></header>
      <div class="dialog-body">
        ${group('Ritningsblad', 'ritningar', sheets, 'Inga ritningsblad än. Skapa ett under Ritningar i projektträdet.')}
        ${group('Vyer', 'vyer', views, 'Inga sparade vyer.')}
        <p class="note">Varje blad och vy blir en PDF i vektorform, i sin skala och med filnamn efter ritningsnumret. Allt kommer i en zipfil. DXF av vyer och blad kommer i 0.12.</p>
        <div class="plot-progress" hidden><div class="plot-bar"><span></span></div><p data-plot-status></p></div>
      </div>
      <footer><span class="plot-count note"></span><button type="button" class="btn" data-plot="close">Stäng</button><button type="submit" class="btn btn-primary" data-plot="run">${icons.plot}<span>Exportera</span></button></footer>
    </form>`;
    syncFolders();
  }

  /** Mapparnas kryssrutor: ikryssade när allt i dem är det, streckade när en del är det. */
  function syncFolders(): void {
    const boxes = [...el.querySelectorAll<HTMLInputElement>('[data-plot-folder]')].reverse();
    for (const box of boxes) {
      const container = box.closest('.plot-folder, .plot-group')!;
      const all = [...container.querySelectorAll<HTMLInputElement>('[data-plot-item]')];
      const on = all.filter((i) => i.checked).length;
      box.checked = all.length > 0 && on === all.length;
      box.indeterminate = on > 0 && on < all.length;
      box.disabled = all.length === 0;
    }
    const doc = app.store.doc;
    const n = [...checked].filter((k) => k.startsWith('sheet:') && doc.sheets.some((s) => `sheet:${s.id}` === k)).length;
    const m = [...checked].filter((k) => k.startsWith('view:') && doc.views.some((v) => `view:${v.id}` === k)).length;
    el.querySelector('.plot-count')!.textContent = n + m ? [n ? `${n} ${n === 1 ? 'blad' : 'blad'}` : '', m ? `${m} ${m === 1 ? 'vy' : 'vyer'}` : ''].filter(Boolean).join(' och ') : 'Inget valt';
    el.querySelector<HTMLButtonElement>('[data-plot="run"]')!.disabled = !(n + m) || !!job;
  }

  el.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.matches('[data-plot-item]')) {
      if (t.checked) checked.add(t.dataset.plotItem!);
      else checked.delete(t.dataset.plotItem!);
    } else if (t.matches('[data-plot-folder]')) {
      const container = t.closest('.plot-folder, .plot-group')!;
      for (const i of container.querySelectorAll<HTMLInputElement>('[data-plot-item]')) {
        i.checked = t.checked;
        if (t.checked) checked.add(i.dataset.plotItem!);
        else checked.delete(i.dataset.plotItem!);
      }
    }
    syncFolders();
  });
  el.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t === el || t.closest('[data-plot="close"]')) close();
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
    e.stopPropagation();
  });
  // Escape stänger även när fokus inte ligger i dialogen.
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Escape' || el.hidden || el.contains(e.target as Node)) return;
      e.stopPropagation();
      close();
    },
    { capture: true },
  );
  el.addEventListener('submit', (e) => {
    e.preventDefault();
    void run();
  });

  function open(): void {
    const doc = app.store.doc;
    // Från början: alla blad, eller bladet som visas.
    checked = new Set(app.ui.layout ? [`sheet:${app.ui.layout}`] : doc.sheets.map((s) => `sheet:${s.id}`));
    if (!doc.sheets.length && app.ui.activeView) checked.add(`view:${app.ui.activeView}`);
    render();
    el.hidden = false;
    el.querySelector<HTMLButtonElement>('[data-plot="run"]')?.focus();
  }

  function close(): void {
    if (job) {
      job.cancel = true;
      return;
    }
    el.hidden = true;
  }

  /** Bilderna på sidan som JPEG, hämtade en gång per fil, sida och gråskala. */
  async function imagesFor(page: PdfPage, cache: Map<string, PdfImage>): Promise<void> {
    for (const p of page.prims) {
      if (p.kind !== 'image') continue;
      const key = imageKey(p.source, p.gray);
      if (cache.has(key)) continue;
      const img = await exportImage(p.source, !!p.gray);
      if (img) cache.set(key, img);
    }
  }

  async function run(): Promise<void> {
    if (job) return;
    const doc = app.store.doc;
    const { sheets, views } = items(doc);
    const todo = [...sheets, ...views].filter((it) => checked.has(it.key));
    if (!todo.length) return;
    const me = { cancel: false };
    job = me;
    const progress = el.querySelector<HTMLElement>('.plot-progress')!;
    const bar = el.querySelector<HTMLElement>('.plot-bar span')!;
    const status = el.querySelector<HTMLElement>('[data-plot-status]')!;
    const runBtn = el.querySelector<HTMLButtonElement>('[data-plot="run"]')!;
    const closeBtn = el.querySelector<HTMLButtonElement>('footer [data-plot="close"]')!;
    progress.hidden = false;
    runBtn.disabled = true;
    closeBtn.textContent = 'Avbryt';
    el.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((i) => (i.disabled = true));
    const entries: ZipEntry[] = [];
    const names: string[] = [];
    const images = new Map<string, PdfImage>();
    const deflate = browserDeflate();
    const autoDims = app.uiSettings.autoDims;
    const date = today();
    const finish = (text: string) => {
      job = null;
      status.textContent = text;
      closeBtn.textContent = 'Stäng';
      el.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((i) => (i.disabled = false));
      syncFolders();
    };
    try {
      for (let i = 0; i < todo.length; i++) {
        const it = todo[i];
        status.textContent = `${i + 1} av ${todo.length}: ${it.name}`;
        bar.style.width = `${Math.round((i / todo.length) * 100)}%`;
        // Låt sidan rita om och Avbryt hinna fram mellan varje fil.
        await new Promise((r) => setTimeout(r, 0));
        if (me.cancel) {
          finish('Avbrutet. Inget sparades.');
          return;
        }
        const [kind, id] = [it.key.slice(0, it.key.indexOf(':')), it.key.slice(it.key.indexOf(':') + 1)];
        let page: PdfPage | null = null;
        let file = it.name;
        if (kind === 'sheet') {
          const s = doc.sheets.find((x) => x.id === id);
          if (!s) continue;
          const d = buildSheet(doc, s, { autoDims, today: date });
          page = { size: d.size, prims: d.prims };
          file = s.number;
        } else {
          const v = buildViewPage(doc, id, { autoDims });
          if (!v) continue;
          page = v;
          file = v.name;
        }
        await imagesFor(page, images);
        if (me.cancel) {
          finish('Avbrutet. Inget sparades.');
          return;
        }
        entries.push({ name: '', data: await writePdf([page], { title: it.name, images, deflate }) });
        names.push(`${file}.pdf`);
      }
      bar.style.width = '100%';
      if (!entries.length) {
        finish('Det fanns inget att exportera.');
        return;
      }
      const unique = uniqueNames(names);
      entries.forEach((e, i) => (e.name = unique[i]));
      const zip = writeZip(entries);
      status.textContent = 'Sparar zipfilen …';
      if (import.meta.env.MODE === 'artifact') {
        finish('Förhandsvisningen kan inte spara filer. Det fungerar i versionen på webbhotellet.');
        return;
      }
      const r = await saveBlobFile(new Blob([zip as Uint8Array<ArrayBuffer>], { type: 'application/zip' }), `${doc.project.name} plot ${date}.zip`, 'Zipfil', { 'application/zip': ['.zip'] });
      finish(r === 'cancelled' ? 'Zipfilen sparades inte.' : `Klart: ${entries.length} ${entries.length === 1 ? 'PDF' : 'PDF:er'} i zipfilen.`);
    } catch (err) {
      console.error('Plot/export', err);
      finish(`Exporten misslyckades: ${(err as Error).message}`);
    }
  }

  return { open, close, get running() {
    return !!job;
  } };
}
