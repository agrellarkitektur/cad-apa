import { activeMap, LAYER_MAP_LABEL } from '../../core/dxfLayers';
import { DXF_VERSIONS, DXF_VERSION_LABEL } from '../../formats/dxfWrite';
import { exportKeys, planExport, setKeys, treeOrder, withGuids, type ExportPlan } from '../../core/exportJobs';
import {
  FORMAT_LABEL,
  FORMATS_FOR,
  formatsFor,
  IMAGE_CURRENT,
  kindOf,
  MODEL_ALL,
  optionsOf,
  setByName,
  type ExportFormat,
  type ExportKind,
  type ExportOptions,
  type ExportSet,
} from '../../core/exportSettings';
import { newId } from '../../core/ids';
import type { Id, ProjectDoc, TreeTab } from '../../core/model';
import { today } from '../../core/sheets';
import type { PdfImage } from '../../formats/pdf';
import type { View3D } from '../../view3d/view3d';
import { askConfirm, askText } from '../ask';
import { icons } from '../icons';
import { escapeHtml } from '../labels';
import { describeSheet } from '../sheetForms';
import type { AppContext } from './context';
import { runExport } from './exportRun';
import { canPickFolder, folderFor, rememberedFolder, saveOne, saveZip, writeToFolder, type OutFile } from './exportTarget';
import { describeView } from './helpers';

/**
 * Exportdialogen (0.12, ersätter Plot/export från 0.8 del 3): ett ställe för
 * all export. Trädet till vänster med kryssrutor per mapp och rad och
 * formaten per rad; till höger uppsättningen, PDF:ens inställningar, bildens
 * storlek, vart filerna skrivs och en förhandslista med filnamnen. Kön visar
 * förloppet och går att avbryta.
 */

const esc = escapeHtml;

interface Row {
  key: string;
  name: string;
  sub: string;
}

/** Lagerkartans namn, som dialogen visar den. */
function layerMapName(doc: ProjectDoc): string {
  const d = doc.graphics.export?.dxf;
  const m = activeMap(d);
  return m === 'custom' ? (d?.custom?.name ?? LAYER_MAP_LABEL.custom) : LAYER_MAP_LABEL[m];
}

const KIND_GROUP: Record<ExportKind, string> = { sheet: 'Ritningar', view: 'Vyer', image: '3D-vyer', model: 'Modellen' };

const MIME: Record<ExportFormat, string> = { pdf: 'application/pdf', dxf: 'image/vnd.dxf', png: 'image/png', jpeg: 'image/jpeg', glb: 'model/gltf-binary' };

function kb(n: number): string {
  return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} kB` : `${(n / 1024 / 1024).toLocaleString('sv-SE', { maximumFractionDigits: 1 })} MB`;
}

export function installExportDialog(app: AppContext, deps: { image: (src: { asset: string; page?: number }, gray: boolean) => Promise<PdfImage | null>; view3d: () => Promise<View3D | null> }) {
  const el = document.createElement('div');
  el.className = 'dialog-backdrop plot-backdrop';
  el.hidden = true;
  app.root.appendChild(el);

  let checked = new Set<string>();
  let formats: Record<string, ExportFormat[]> = {};
  let options: ExportOptions = {};
  let setId: Id | null = null;
  let query = '';
  let job: { cancel: boolean } | null = null;
  /** Storleken på filerna från förra körningen, efter sökväg. */
  let sizes = new Map<string, number>();
  let folderName = '';

  const projectKey = (doc: ProjectDoc) => [doc.project.name, doc.project.fields.uppdragsnummer].filter(Boolean).join(' · ');

  function rows(doc: ProjectDoc): Record<ExportKind, (Row & { id: Id })[]> {
    return {
      sheet: doc.sheets.map((s) => ({ id: s.id, key: `sheet:${s.id}`, name: `${s.number} ${s.name}`.trim(), sub: describeSheet(s) })),
      view: doc.views.map((v) => ({ id: v.id, key: `view:${v.id}`, name: v.name, sub: describeView(doc, v) })),
      image: [{ id: 'current', key: IMAGE_CURRENT, name: 'Nuvarande 3D-vy', sub: 'som 3D-vyn står nu; de sparade 3D-vyerna kommer i 0.12.5' }],
      model: [{ id: 'all', key: MODEL_ALL, name: 'Modellen', sub: 'med material, för Blender och andra renderare (IFC kommer i 0.12.3)' }],
    };
  }

  const title = (doc: ProjectDoc) => {
    const r = rows(doc);
    const all = [...r.sheet, ...r.view, ...r.image, ...r.model];
    return (key: string) => all.find((x) => x.key === key)?.name ?? key;
  };

  function plan(doc: ProjectDoc): ExportPlan {
    const keys = exportKeys(doc).filter((k) => checked.has(k));
    return planExport(doc, keys, formats, optionsOf(options), today(), doc.graphics.export, title(doc));
  }

  // -------------------------------------------------------------------------
  // Utseendet

  function formatChips(key: string): string {
    const ok = FORMATS_FOR[kindOf(key)];
    const on = formatsFor(key, formats);
    if (ok.length === 1) return `<span class="ex-fmt is-on" title="Formatet">${FORMAT_LABEL[ok[0]]}</span>`;
    return ok.map((f) => `<button type="button" class="ex-fmt${on.includes(f) ? ' is-on' : ''}" data-ex-fmt="${esc(key)}" data-f="${f}" aria-pressed="${on.includes(f)}">${FORMAT_LABEL[f]}</button>`).join('');
  }

  function rowMarkup(r: Row): string {
    const hit = !query || `${r.name} ${r.sub}`.toLowerCase().includes(query);
    return `<div class="ex-row"${hit ? '' : ' hidden'}><label class="check plot-item"><input type="checkbox" data-ex-item="${esc(r.key)}"${checked.has(r.key) ? ' checked' : ''}><span>${esc(r.name)}<small>${esc(r.sub)}</small></span></label><span class="ex-fmts">${formatChips(r.key)}</span></div>`;
  }

  function treeMarkup(doc: ProjectDoc, tab: TreeTab, list: (Row & { id: Id })[]): string {
    const folders = doc.folders.filter((f) => f.tab === tab);
    const valid = new Set(folders.map((f) => f.id));
    const order = treeOrder(doc, tab, list.map((r) => r.id));
    const byId = new Map(list.map((r) => [r.id, r]));
    const branch = (parent: Id | null): string => {
      const sub = folders
        .filter((f) => f.parent === parent)
        .sort((a, b) => a.name.localeCompare(b.name, 'sv', { numeric: true }))
        .map((f) => {
          const inner = branch(f.id);
          return inner ? `<div class="plot-folder"><label class="check plot-folder-head"><input type="checkbox" data-ex-folder>${icons.folder}<span>${esc(f.name)}</span></label><div class="plot-children">${inner}</div></div>` : '';
        })
        .join('');
      const own = order
        .filter((id) => (parent ? doc.tree[id] === parent : !(doc.tree[id] && valid.has(doc.tree[id]))))
        .map((id) => rowMarkup(byId.get(id)!))
        .join('');
      return sub + own;
    };
    return branch(null);
  }

  function groupMarkup(doc: ProjectDoc, kind: ExportKind, list: (Row & { id: Id })[], empty: string): string {
    const inner = kind === 'sheet' ? treeMarkup(doc, 'ritningar', list) : kind === 'view' ? treeMarkup(doc, 'vyer', list) : list.map(rowMarkup).join('');
    return `<section class="plot-group"><label class="check plot-group-head"><input type="checkbox" data-ex-folder><b>${KIND_GROUP[kind]}</b></label>${list.length ? `<div class="plot-children">${inner}</div>` : `<p class="note">${empty}</p>`}</section>`;
  }

  function render(): void {
    const doc = app.store.doc;
    const r = rows(doc);
    const o = optionsOf(options);
    const sets = doc.exportSets ?? [];
    const folderOk = canPickFolder();
    el.innerHTML = `<form class="dialog plot-dialog ex-dialog" role="dialog" aria-modal="true" aria-labelledby="ex-title">
      <header><h2 id="ex-title">Exportera</h2><button type="button" class="icon-btn" data-ex="close" aria-label="Stäng">×</button></header>
      <div class="ex-sets">
        <label class="field"><span>Uppsättning</span><select data-ex="set"><option value="">Inget sparat urval</option>${sets.map((s) => `<option value="${esc(s.id)}"${s.id === setId ? ' selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
        <button type="button" class="btn" data-ex="set-save"${setId ? '' : ' hidden'} title="Spara urvalet och inställningarna i uppsättningen">Spara</button>
        <button type="button" class="btn" data-ex="set-new">Spara som…</button>
        <button type="button" class="btn btn-ghost" data-ex="set-delete"${setId ? '' : ' hidden'}>Ta bort</button>
      </div>
      <div class="dialog-body ex-body">
        <div class="ex-tree">
          <input type="search" class="ex-search" data-ex="search" placeholder="Sök blad och vyer" value="${esc(query)}" autocomplete="off">
          ${groupMarkup(doc, 'sheet', r.sheet, 'Inga ritningsblad än. Skapa ett under Ritningar i projektträdet.')}
          ${groupMarkup(doc, 'view', r.view, 'Inga sparade vyer.')}
          ${groupMarkup(doc, 'image', r.image, '')}
          ${groupMarkup(doc, 'model', r.model, '')}
        </div>
        <div class="ex-side">
          <section class="ex-opts">
            <h3>PDF</h3>
            <label class="check"><input type="radio" name="ex-combined" data-ex-opt="combined" value="0"${o.combined ? '' : ' checked'}> En fil per blad</label>
            <label class="check"><input type="radio" name="ex-combined" data-ex-opt="combined" value="1"${o.combined ? ' checked' : ''}> En samlad fil med bokmärken</label>
            <label class="field"><span>Lager</span><select data-ex-opt="layers"><option value="none"${o.layers === 'none' ? ' selected' : ''}>Inga</option><option value="views"${o.layers === 'views' ? ' selected' : ''}>Ett per vy på bladet</option><option value="groups"${o.layers === 'groups' ? ' selected' : ''}>Per vy och objektgrupp</option></select></label>
            <label class="check"><input type="checkbox" data-ex-opt="workStamp"${o.workStamp ? ' checked' : ''}> Stämpel <i>ARBETSMATERIAL</i> med datum</label>
          </section>
          <section class="ex-opts">
            <h3>DXF</h3>
            <label class="field"><span>Version</span><select data-ex-opt="dxfVersion">${DXF_VERSIONS.map((v) => `<option value="${v}"${o.dxfVersion === v ? ' selected' : ''}>${DXF_VERSION_LABEL[v]}${v === 'R2000' ? ' (öppnas överallt)' : ''}</option>`).join('')}</select></label>
            <p class="note">Lager: <i>${esc(layerMapName(doc))}</i>, under stilboken › Allmänt › <i>Export</i>.</p>
          </section>
          <section class="ex-opts">
            <h3>Bilder ur 3D</h3>
            <div class="ex-size"><label class="field"><span>Bredd</span><input inputmode="numeric" data-ex-opt="imageW" value="${o.imageSize[0]}"></label><span>×</span><label class="field"><span>Höjd</span><input inputmode="numeric" data-ex-opt="imageH" value="${o.imageSize[1]}"></label><span class="note">bildpunkter</span></div>
          </section>
          <section class="ex-opts">
            <h3>Vart</h3>
            ${folderOk ? `<label class="check"><input type="radio" name="ex-target" data-ex-opt="target" value="folder"${o.target === 'folder' ? ' checked' : ''}> Mapp på datorn <span class="note" data-ex-folder-name>${esc(folderName || 'väljs när du exporterar')}</span></label>
            <button type="button" class="btn btn-ghost ex-pick" data-ex="pick">Välj en annan mapp…</button>` : ''}
            <label class="check"><input type="radio" name="ex-target" data-ex-opt="target" value="zip"${o.target === 'zip' || !folderOk ? ' checked' : ''}> Zipfil</label>
            <label class="check"><input type="checkbox" data-ex-opt="subfolders"${o.subfolders ? ' checked' : ''}> Undermappar per format (PDF, DXF, Bilder, glTF)</label>
          </section>
          <section class="ex-opts ex-preview"><h3>Filerna</h3><div data-ex="preview"></div>
          <p class="note">Filnamnen ur mallarna under stilboken › Allmänt › <i>Export</i>.</p></section>
        </div>
      </div>
      <div class="plot-progress" hidden><div class="plot-bar"><span></span></div><p data-ex-status></p></div>
      <footer><span class="plot-count note"></span><button type="button" class="btn" data-ex="close">Stäng</button><button type="submit" class="btn btn-primary" data-ex="run">${icons.plot}<span>Exportera</span></button></footer>
    </form>`;
    sync();
  }

  /** Mapparnas kryssrutor, räknaren och förhandslistan. */
  function sync(): void {
    for (const box of [...el.querySelectorAll<HTMLInputElement>('[data-ex-folder]')].reverse()) {
      const c = box.closest('.plot-folder, .plot-group')!;
      const all = [...c.querySelectorAll<HTMLInputElement>('[data-ex-item]')];
      const on = all.filter((i) => i.checked).length;
      box.checked = all.length > 0 && on === all.length;
      box.indeterminate = on > 0 && on < all.length;
      box.disabled = all.length === 0 || !!job;
    }
    const doc = app.store.doc;
    const p = plan(doc);
    const count = el.querySelector('.plot-count')!;
    count.textContent = p.jobs.length ? `${p.jobs.length} ${p.jobs.length === 1 ? 'fil' : 'filer'}` : 'Inget valt';
    el.querySelector<HTMLButtonElement>('[data-ex="run"]')!.disabled = !p.jobs.length || !!job;
    const prev = el.querySelector<HTMLElement>('[data-ex="preview"]')!;
    prev.innerHTML = p.jobs.length
      ? `<ul class="ex-files">${p.jobs
          .map((j) => {
            const dup = p.duplicates.has(j.path.toLowerCase());
            const size = sizes.get(j.path);
            return `<li class="${dup ? 'is-dup' : ''}" title="${dup ? 'Samma namn som en annan fil; den får (2) efter namnet' : ''}"><span>${esc(j.path)}</span>${dup ? '<b>dubblett</b>' : ''}${size !== undefined ? `<small>${kb(size)}</small>` : ''}</li>`;
          })
          .join('')}</ul>`
      : '<p class="note">Kryssa blad, vyer, 3D-vyn eller modellen.</p>';
  }

  // -------------------------------------------------------------------------
  // Uppsättningarna

  /** Urvalet som en uppsättning: sorter där allt är kryssat sparas som *alla*, så att nya blad kommer med. */
  function current(name: string, id: Id): ExportSet {
    const doc = app.store.doc;
    const keys = exportKeys(doc);
    const all: ExportKind[] = (['sheet', 'view'] as const).filter((k) => {
      const of = keys.filter((x) => kindOf(x) === k);
      return of.length > 0 && of.every((x) => checked.has(x));
    });
    const items = keys.filter((k) => checked.has(k) && !all.includes(kindOf(k)));
    const f = Object.fromEntries(Object.entries(formats).filter(([k, v]) => checked.has(k) && v.join() !== FORMATS_FOR[kindOf(k)][0]));
    return { id, name, items, ...(all.length ? { all } : {}), ...(Object.keys(f).length ? { formats: f } : {}), ...(Object.keys(options).length ? { options: { ...options } } : {}) };
  }

  function useSet(s: ExportSet | null): void {
    setId = s?.id ?? null;
    if (s) {
      checked = new Set(setKeys(app.store.doc, s));
      formats = structuredClone(s.formats ?? {});
      options = { ...(s.options ?? {}) };
    }
  }

  function storeSets(label: string, sets: ExportSet[]): void {
    app.store.transact(label, (tx) => tx.setField('exportSets', sets.length ? sets : undefined));
  }

  async function saveAs(): Promise<void> {
    const name = (await askText('Spara uppsättningen som', '', 'Spara'))?.trim();
    if (!name) return;
    const sets = [...(app.store.doc.exportSets ?? [])];
    const same = sets.findIndex((s) => s.name.toLowerCase() === name.toLowerCase());
    const id = same >= 0 ? sets[same].id : newId('exp');
    const s = current(name, id);
    if (same >= 0) sets[same] = s;
    else sets.push(s);
    storeSets(`Exportuppsättning: ${name}`, sets);
    setId = id;
    render();
  }

  function save(): void {
    const sets = [...(app.store.doc.exportSets ?? [])];
    const i = sets.findIndex((s) => s.id === setId);
    if (i < 0) return;
    sets[i] = current(sets[i].name, sets[i].id);
    storeSets(`Exportuppsättning: ${sets[i].name}`, sets);
    app.hint(`Uppsättningen ${sets[i].name} är sparad.`, 2000);
  }

  async function remove(): Promise<void> {
    const s = app.store.doc.exportSets?.find((x) => x.id === setId);
    if (!s || !(await askConfirm('Ta bort uppsättningen', `Ta bort ${s.name}? Filerna som exporterats påverkas inte.`))) return;
    storeSets(`Ta bort exportuppsättningen ${s.name}`, (app.store.doc.exportSets ?? []).filter((x) => x.id !== s.id));
    setId = null;
    render();
  }

  // -------------------------------------------------------------------------
  // Händelser

  el.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.matches('[data-ex-item]')) {
      if (t.checked) checked.add(t.dataset.exItem!);
      else checked.delete(t.dataset.exItem!);
    } else if (t.matches('[data-ex-folder]')) {
      const c = t.closest('.plot-folder, .plot-group')!;
      for (const i of c.querySelectorAll<HTMLInputElement>('[data-ex-item]')) {
        if ((i.closest('.ex-row') as HTMLElement | null)?.hidden) continue;
        i.checked = t.checked;
        if (t.checked) checked.add(i.dataset.exItem!);
        else checked.delete(i.dataset.exItem!);
      }
    } else if (t.matches('[data-ex="set"]')) {
      useSet(app.store.doc.exportSets?.find((s) => s.id === (t as unknown as HTMLSelectElement).value) ?? null);
      render();
      return;
    } else if (t.matches('[data-ex-opt]')) {
      const k = t.dataset.exOpt!;
      const o = optionsOf(options);
      if (k === 'combined') options.combined = t.value === '1';
      else if (k === 'layers') options.layers = (t as unknown as HTMLSelectElement).value as ExportOptions['layers'];
      else if (k === 'workStamp' || k === 'subfolders') options[k] = t.checked;
      else if (k === 'target') options.target = t.value as 'folder' | 'zip';
      else if (k === 'dxfVersion') options.dxfVersion = (t as unknown as HTMLSelectElement).value === 'R2018' ? 'R2018' : 'R2000';
      else if (k === 'imageW' || k === 'imageH') {
        const v = Math.round(Number(t.value.replace(/\s/g, '')));
        const ok = Number.isFinite(v) && v >= 64 && v <= 8192;
        if (ok) options.imageSize = k === 'imageW' ? [v, o.imageSize[1]] : [o.imageSize[0], v];
        else t.value = String(k === 'imageW' ? o.imageSize[0] : o.imageSize[1]);
      }
    }
    sync();
  });
  el.addEventListener('input', (e) => {
    const t = e.target as HTMLInputElement;
    if (!t.matches('[data-ex="search"]')) return;
    query = t.value.trim().toLowerCase();
    for (const row of el.querySelectorAll<HTMLElement>('.ex-row')) row.hidden = !!query && !row.textContent!.toLowerCase().includes(query);
  });
  el.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t === el || t.closest('[data-ex="close"]')) return close();
    const fmt = t.closest<HTMLElement>('[data-ex-fmt]');
    if (fmt) {
      const key = fmt.dataset.exFmt!;
      const f = fmt.dataset.f as ExportFormat;
      const on = new Set(formatsFor(key, formats));
      if (on.has(f) && on.size > 1) on.delete(f);
      else on.add(f);
      formats[key] = FORMATS_FOR[kindOf(key)].filter((x) => on.has(x));
      checked.add(key);
      render();
      return;
    }
    const a = t.closest<HTMLElement>('[data-ex]')?.dataset.ex;
    if (a === 'set-new') void saveAs();
    else if (a === 'set-save') save();
    else if (a === 'set-delete') void remove();
    else if (a === 'pick')
      void folderFor(projectKey(app.store.doc), true).then((d) => {
        if (!d) return;
        folderName = d.name;
        options.target = 'folder';
        render();
      });
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
    e.stopPropagation();
  });
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

  function open(set?: ExportSet): void {
    const doc = app.store.doc;
    sizes = new Map();
    if (set) useSet(set);
    else if (setId && doc.exportSets?.some((s) => s.id === setId)) useSet(doc.exportSets.find((s) => s.id === setId)!);
    else {
      setId = null;
      // Från början: bladet som visas, eller alla blad, eller vyn som visas.
      checked = new Set(app.ui.layout ? [`sheet:${app.ui.layout}`] : doc.sheets.map((s) => `sheet:${s.id}`));
      if (!doc.sheets.length && app.ui.activeView) checked.add(`view:${app.ui.activeView}`);
    }
    render();
    el.hidden = false;
    void rememberedFolder(projectKey(doc)).then((d) => {
      folderName = d?.name ?? '';
      const n = el.querySelector('[data-ex-folder-name]');
      if (n) n.textContent = folderName || 'väljs när du exporterar';
    });
    el.querySelector<HTMLButtonElement>('[data-ex="run"]')?.focus();
  }

  /** Kör en uppsättning med namn (kommandoraden: `EXPORT Bygglov`). Falskt om den inte finns. */
  function runSet(name: string): boolean {
    const s = setByName(app.store.doc.exportSets, name);
    if (!s) return false;
    open(s);
    void run();
    return true;
  }

  function close(): void {
    if (job) {
      job.cancel = true;
      return;
    }
    el.hidden = true;
  }

  async function run(): Promise<void> {
    if (job) return;
    const o = optionsOf(options);
    const before = plan(app.store.doc);
    if (!before.jobs.length) return;
    const me = { cancel: false };
    job = me;
    const progress = el.querySelector<HTMLElement>('.plot-progress')!;
    const bar = el.querySelector<HTMLElement>('.plot-bar span')!;
    const status = el.querySelector<HTMLElement>('[data-ex-status]')!;
    const closeBtn = el.querySelector<HTMLButtonElement>('footer [data-ex="close"]')!;
    const finish = (text: string) => {
      job = null;
      status.textContent = text;
      closeBtn.textContent = 'Stäng';
      el.querySelectorAll<HTMLInputElement>('input, select, .ex-fmt').forEach((i) => ((i as HTMLInputElement).disabled = false));
      sync();
    };
    progress.hidden = false;
    closeBtn.textContent = 'Avbryt';
    status.textContent = 'Förbereder …';
    // Mappen väljs först, medan klicket fortfarande gäller som lov.
    const doc0 = app.store.doc;
    const toFolder = o.target === 'folder' && canPickFolder() && import.meta.env.MODE !== 'artifact';
    let dir: FileSystemDirectoryHandle | null = null;
    if (toFolder) {
      dir = await folderFor(projectKey(doc0), false);
      if (!dir) return finish('Ingen mapp valdes. Inget sparades.');
      folderName = dir.name;
      const n = el.querySelector('[data-ex-folder-name]');
      if (n) n.textContent = folderName;
    }
    el.querySelectorAll<HTMLInputElement>('input, select, .ex-fmt').forEach((i) => ((i as HTMLInputElement).disabled = true));
    // Objektens GUID (0.12) sätts första gången de exporteras och följer sedan med.
    const guids = withGuids(app.store.doc);
    if (guids) app.store.setGuids(guids);
    const doc = app.store.doc;
    const day = today();
    const p = planExport(doc, exportKeys(doc).filter((k) => checked.has(k)), formats, o, day, doc.graphics.export, title(doc));
    try {
      const r = await runExport(
        p.jobs,
        o,
        { doc, today: day, autoDims: app.uiSettings.autoDims, image: deps.image, view3d: deps.view3d },
        (i, n, t) => {
          bar.style.width = `${Math.round((i / Math.max(1, n)) * 100)}%`;
          if (t) status.textContent = `${i + 1} av ${n}: ${t}`;
        },
        () => me.cancel,
      );
      if (r.cancelled) return finish('Avbrutet. Inget sparades.');
      if (!r.files.length) return finish(r.skipped.length ? `Det fanns inget att exportera (${r.skipped.join('; ')}).` : 'Det fanns inget att exportera.');
      sizes = new Map(r.files.map((f) => [f.job ?? f.path, f.data.length]));
      const extra = r.skipped.length ? ` Hoppade över: ${r.skipped.join('; ')}.` : '';
      const total = kb(r.files.reduce((s, f) => s + f.data.length, 0));
      const what = `${r.files.length} ${r.files.length === 1 ? 'fil' : 'filer'} (${total})`;
      if (import.meta.env.MODE === 'artifact') return finish('Förhandsvisningen kan inte spara filer. Det fungerar i versionen på webbhotellet.');
      if (dir) {
        status.textContent = 'Skriver filerna …';
        await writeToFolder(dir, r.files);
        return finish(`Klart: ${what} i mappen ${dir.name}.${extra}`);
      }
      const saved = r.files.length === 1 && !o.subfolders ? await saveOne(r.files[0], MIME[p.jobs[0].format]) : await saveZip(r.files as OutFile[], `${doc.project.name} export ${day}.zip`, day);
      finish(saved === 'cancelled' ? 'Inget sparades.' : `Klart: ${what}${r.files.length > 1 || o.subfolders ? ' i zipfilen' : ''}.${extra}`);
    } catch (err) {
      console.error('Export', err);
      finish(`Exporten misslyckades: ${(err as Error).message}`);
    }
  }

  return {
    open: () => open(),
    runSet,
    close,
    get running() {
      return !!job;
    },
  };
}

export type ExportDialog = ReturnType<typeof installExportDialog>;
