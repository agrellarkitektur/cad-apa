import { traceStoreyOptions } from './app/showMenu';
import { PRESETS } from '../core/graphics';
import { isMaster, type Id, type ProjectDoc, type TreeTab } from '../core/model';
import type { DocStore } from '../core/store';
import { DETAIL_LABELS, DETAIL_LEVELS } from '../core/states';
import { PAPER_SIZES, saveMaster, setDefaultMaster, stampUsers } from '../core/sheets';
import { deleteFolder, deleteWorksheet, descendantsOf, saveFolder, saveMarker, saveStorey, saveView, saveWorksheet, worksheetContents } from '../core/treeCommands';
import { askConfirm } from './ask';
import { markerName, type MarkerParams } from '../elements/markers';
import { resolveParams } from '../elements/registry';
import { icons } from './icons';
import { escapeHtml } from './labels';

/**
 * Inställningarna för det man valt i projektträdet (0.8): en vy, en fasad
 * eller sektion, en våning, ett arbetsblad, ett mallblad (0.8.8) eller en mapp. De visas i egenskapspanelen med en
 * Spara-knapp sist; inget ändras förrän man sparar.
 */
/** Det som är valt i projektträdet. Med `also` är flera blad markerade (0.8.10). */
export type TreeItem = { kind: 'view' | 'marker' | 'storey' | 'folder' | 'worksheet' | 'sheet' | 'viewport'; id: Id; also?: readonly Id[] };

const esc = escapeHtml;

/** Detaljnivåns val i vyns egenskaper (0.8.37). */
function levelSelect(name: string, cur: string): string {
  return `<select name="${name}">${DETAIL_LEVELS.map((d) => `<option value="${d}"${d === cur ? ' selected' : ''}>${DETAIL_LABELS[d]}</option>`).join('')}</select>`;
}

/** Om det valda fortfarande finns i projektet. */
export function treeItemExists(doc: ProjectDoc, item: TreeItem): boolean {
  switch (item.kind) {
    case 'view':
      return doc.views.some((v) => v.id === item.id);
    case 'marker':
      return !!doc.elements[item.id];
    case 'storey':
      return doc.storeys.some((s) => s.id === item.id);
    case 'folder':
      return doc.folders.some((f) => f.id === item.id);
    case 'worksheet':
      return doc.worksheets.some((w) => w.id === item.id);
    case 'sheet':
      return doc.sheets.some((s) => s.id === item.id);
    case 'viewport':
      return doc.sheets.some((s) => s.viewports.some((v) => v.id === item.id));
  }
}

/** Mapparna i en flik som en lista att välja i, med undermappar indragna. */
function folderOptions(doc: ProjectDoc, tab: TreeTab, current: Id | null, exclude: Id[] = []): string {
  const list = doc.folders.filter((f) => f.tab === tab && !exclude.includes(f.id));
  const out: string[] = [`<option value=""${current ? '' : ' selected'}>Ingen mapp</option>`];
  const walk = (parent: Id | null, depth: number) => {
    for (const f of list.filter((x) => x.parent === parent).sort((a, b) => a.name.localeCompare(b.name, 'sv', { numeric: true }))) {
      out.push(`<option value="${f.id}"${f.id === current ? ' selected' : ''}>${' '.repeat(depth)}${esc(f.name)}</option>`);
      walk(f.id, depth + 1);
    }
  };
  walk(null, 0);
  return out.join('');
}

const field = (label: string, input: string) => `<label class="field"><span>${label}</span>${input}</label>`;

/** Formuläret, eller tomt om det valda inte finns. */
export function treeItemMarkup(doc: ProjectDoc, item: TreeItem): string {
  const folder = doc.tree[item.id] ?? null;
  const actions = (extra = '') => `<div class="tree-save">${extra}<button type="button" class="btn" data-tree="reset" disabled>Återställ</button><button type="submit" class="btn btn-primary" data-tree="save" disabled>Spara</button></div>`;
  if (item.kind === 'view') {
    const v = doc.views.find((x) => x.id === item.id);
    if (!v) return '';
    const sheet = v.worksheet ? doc.worksheets.find((w) => w.id === v.worksheet) : undefined;
    const shows = v.marker && doc.elements[v.marker] ? markerName(doc, doc.elements[v.marker]) : sheet ? sheet.name : (doc.storeys.find((s) => s.id === v.storey)?.name ?? '');
    const tags = [...new Set([...doc.viewTags, ...(v.tags ?? [])])];
    return `<form class="tree-form" data-tree-kind="view" data-tree-id="${v.id}">
      <header class="sel-head"><h2>${esc(v.name)}</h2><p>Vy · visar ${esc(shows)}</p></header>
      <section>
        <div class="fields">
          ${field('Namn', `<input name="name" value="${esc(v.name)}">`)}
          ${field('Mapp', `<select name="folder">${folderOptions(doc, 'vyer', folder)}</select>`)}
          ${field('Tillstånd', `<select name="state">${doc.states.map((s) => `<option value="${s.id}"${s.id === v.state ? ' selected' : ''}>${esc(s.name)}</option>`).join('')}</select>`)}
          ${field('Littera', levelSelect('labelDetail', v.labelDetail ?? v.detail))}
          ${field('2D-symboler', levelSelect('detail', v.detail))}
          ${field('3D och fasader', levelSelect('modelDetail', v.modelDetail ?? v.detail))}
          ${field('Stilmall', `<select name="style"><option value="">Projektets</option>${PRESETS.map((p) => `<option${p.name === v.style ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select>`)}
          ${field('Kalkera', `<select name="trace"><option value="">Ingen</option>${traceStoreyOptions(v.trace)}${doc.views.filter((x) => x.id !== v.id).map((x) => `<option value="${x.id}"${x.id === v.trace ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select>`)}
          ${field('Skala', `<span class="input-unit scale-unit"><i>1:</i><input name="scale" type="text" inputmode="numeric" value="${v.scale ?? ''}" placeholder="100"></span>`)}
        </div>
        <label class="check"><input type="checkbox" name="compare"${v.compare ? ' checked' : ''}> Jämför med befintligt</label>
        <label class="check"><input type="checkbox" name="hideDemolished"${v.hideDemolished ? ' checked' : ''}> Dölj det som rivs</label>
      </section>
      <section>
        <h3>Vy-taggar</h3>
        <div class="tag-chips">${tags.map((t) => `<label class="tag-check"><input type="checkbox" name="tag" value="${esc(t)}"${v.tags?.includes(t) ? ' checked' : ''}><span>${esc(t)}</span></label>`).join('')}</div>
        <div class="row"><input data-tree-newtag placeholder="Ny vy-tagg" aria-label="Ny vy-tagg"><button type="button" class="btn" data-tree="add-tag">Lägg till</button></div>
        <p class="note">2D-element, text och mått kan visas bara i vyer med vissa taggar (Visas i). Taggarna ersätter lager.</p>
      </section>
      ${actions()}
    </form>`;
  }
  if (item.kind === 'marker') {
    const el = doc.elements[item.id];
    if (!el) return '';
    const p = resolveParams<MarkerParams>(doc, el);
    const isSection = el.type === 'Section';
    return `<form class="tree-form" data-tree-kind="marker" data-tree-id="${el.id}">
      <header class="sel-head"><h2>${esc(markerName(doc, el))}</h2><p>${isSection ? 'Sektion' : 'Fasad'}</p></header>
      <section>
        <div class="fields">
          ${field('Namn', `<input name="name" value="${esc(el.name ?? '')}" placeholder="${esc(markerName(doc, { ...el, name: undefined }))}">`)}
          ${field('Mapp', `<select name="folder">${folderOptions(doc, 'modell', folder)}</select>`)}
          ${isSection ? field('Beteckning', `<input name="label" value="${esc(p.label ?? 'A')}">`) : ''}
          ${field('Djup', `<span class="input-unit"><input name="depth" type="text" inputmode="decimal" value="${p.depth ?? ''}" placeholder="Allt"><i>mm</i></span>`)}
        </div>
        <label class="check lock-check" title="En låst linje kan inte flyttas eller tas bort av misstag"><input type="checkbox" name="locked"${el.locked ? ' checked' : ''}><span class="lock-icon">${el.locked ? icons.lock : icons.unlock}</span> Lås</label>
      </section>
      ${actions()}
    </form>`;
  }
  if (item.kind === 'worksheet') {
    const w = doc.worksheets.find((x) => x.id === item.id);
    if (!w) return '';
    const n = worksheetContents(doc, w.id).length;
    if (w.stamp) {
      // En stämpel (0.8.12).
      const users = stampUsers(doc, w.id);
      return `<form class="tree-form" data-tree-kind="worksheet" data-tree-id="${w.id}">
      <header class="sel-head"><h2>${esc(w.name)}</h2><p>Stämpel · ${n} objekt</p></header>
      <section>
        <div class="fields">
          ${field('Namn', `<input name="name" value="${esc(w.name)}">`)}
          ${field('Mapp', `<select name="folder">${folderOptions(doc, 'ritningar', folder)}</select>`)}
        </div>
        <p class="note">Rita stämpeln med de vanliga verktygen i mm, kring nollpunkten (krysset): den hamnar där stämpeln läggs på bladet. Texter kan ha smarttext och fält, som fylls i från varje blad. En logga läggs in som underlag. Lägg på stämpeln i bladets egenskaper eller med högerklick på bladet.</p>
        <p class="note">${users.length ? `Ligger på ${users.length} blad: ${users.map((s) => esc(s.number)).join(', ')}. Ändras stämpeln ändras den på alla.` : 'Stämpeln ligger inte på något blad än.'}</p>
      </section>
      ${actions(`<button type="button" class="btn btn-danger" data-tree="delete-worksheet">Ta bort…</button>`)}
    </form>`;
    }
    if (w.paper) {
      // Ett mallblad (0.8.8).
      const users = doc.sheets.filter((s) => s.master === w.id);
      const other = users.filter((s) => s.size !== w.paper!.size || s.orientation !== w.paper!.orientation);
      const orient = { landscape: 'Liggande', portrait: 'Stående' } as const;
      return `<form class="tree-form" data-tree-kind="worksheet" data-tree-id="${w.id}">
      <header class="sel-head"><h2>${esc(w.name)}</h2><p>Mallblad · ${w.paper.size} ${orient[w.paper.orientation].toLowerCase()} · ${n} objekt</p></header>
      <section>
        <div class="fields">
          ${field('Namn', `<input name="name" value="${esc(w.name)}">`)}
          ${field('Format', `<select name="size">${PAPER_SIZES.map((p) => `<option${p === w.paper!.size ? ' selected' : ''}>${p}</option>`).join('')}</select>`)}
          ${field('Orientering', `<select name="orientation">${(['landscape', 'portrait'] as const).map((o) => `<option value="${o}"${o === w.paper!.orientation ? ' selected' : ''}>${orient[o]}</option>`).join('')}</select>`)}
          ${field('Mapp', `<select name="folder">${folderOptions(doc, 'ritningar', folder)}</select>`)}
        </div>
        <label class="check"><input type="checkbox" name="default"${doc.project.master === w.id ? ' checked' : ''}> Nya blad får det här mallbladet</label>
        <p class="note">Rita ramen, huvudet och annat som ska finnas på bladen med de vanliga verktygen, i mm på papperet. Texter kan ha smarttext, t.ex. {ritningsnummer} och {mapp}, och fält, t.ex. {datum} eller {Konstruktör}, som fylls i från varje blad. En logga läggs in som underlag.</p>
        <p class="note">${users.length ? `Används av ${users.length} ${users.length === 1 ? 'blad' : 'blad'}: ${users.map((s) => esc(s.number)).join(', ')}.` : 'Inget blad använder mallbladet än.'}${other.length ? ` ${other.map((s) => esc(s.number)).join(', ')} har ett annat format.` : ''}</p>
      </section>
      ${actions(`<button type="button" class="btn btn-danger" data-tree="delete-worksheet">Ta bort…</button>`)}
    </form>`;
    }
    return `<form class="tree-form" data-tree-kind="worksheet" data-tree-id="${w.id}">
      <header class="sel-head"><h2>${esc(w.name)}</h2><p>Arbetsblad · ${n} ${n === 1 ? 'objekt' : 'objekt'}</p></header>
      <section>
        <div class="fields">
          ${field('Namn', `<input name="name" value="${esc(w.name)}">`)}
          ${field('Mapp', `<select name="folder">${folderOptions(doc, 'modell', folder)}</select>`)}
        </div>
        <p class="note">En fri 2D-ritning som inte hör till någon våning: detaljer, skisser och underlag. 2D-former, text, mått och underlag går att rita här.</p>
      </section>
      ${actions(`<button type="button" class="btn btn-danger" data-tree="delete-worksheet">Ta bort…</button>`)}
    </form>`;
  }
  if (item.kind === 'storey') {
    const s = doc.storeys.find((x) => x.id === item.id);
    if (!s) return '';
    return `<form class="tree-form" data-tree-kind="storey" data-tree-id="${s.id}">
      <header class="sel-head"><h2>${esc(s.name)}</h2><p>Våning</p></header>
      <section>
        <div class="fields">
          ${field('Namn', `<input name="name" value="${esc(s.name)}">`)}
          ${field('Mapp', `<select name="folder">${folderOptions(doc, 'modell', folder)}</select>`)}
          ${field('Golvnivå', `<span class="input-unit"><input name="elevation" type="text" inputmode="decimal" value="${s.elevation}"><i>mm</i></span>`)}
          ${field('Våningshöjd', `<span class="input-unit"><input name="height" type="text" inputmode="decimal" value="${s.height}"><i>mm</i></span>`)}
        </div>
        <p class="note">Golvnivån räknas från plan 1:s nolla. Våningshöjden är golv till golv; ändras den flyttas våningarna ovanför lika mycket. Väggar utan egen höjd följer våningshöjden.</p>
        <div class="nav-actions">
          <button type="button" class="btn" data-action="new-storey-above">Ny våning ovanför</button>
          <button type="button" class="btn" data-action="new-storey-below">Ny våning under</button>
        </div>
      </section>
      ${actions(doc.storeys.length > 1 ? `<button type="button" class="btn btn-danger" data-action="delete-storey" data-id="${s.id}">Ta bort…</button>` : '')}
    </form>`;
  }
  const f = doc.folders.find((x) => x.id === item.id);
  if (!f) return '';
  const n = Object.values(doc.tree).filter((x) => x === f.id).length + doc.folders.filter((x) => x.parent === f.id).length;
  return `<form class="tree-form" data-tree-kind="folder" data-tree-id="${f.id}">
    <header class="sel-head"><h2>${esc(f.name)}</h2><p>Mapp · ${n} ${n === 1 ? 'sak' : 'saker'}</p></header>
    <section>
      <div class="fields">
        ${field('Namn', `<input name="name" value="${esc(f.name)}">`)}
        ${field('Ligger i', `<select name="folder">${folderOptions(doc, f.tab, f.parent, [f.id, ...descendantsOf(doc.folders, f.id)])}</select>`)}
      </div>
      <p class="note">Lägg något i mappen genom att välja den under Mapp i dess inställningar. Mapparna används också när man väljer vad som ska exporteras.</p>
    </section>
    ${actions(`<button type="button" class="btn btn-danger" data-tree="delete-folder">Ta bort mappen</button>`)}
  </form>`;
}

/**
 * Koppla formulärets knappar. `onSaved` anropas efter Spara, t.ex. så att en
 * öppen vy läses in igen. `rerender` ritar om formuläret (Återställ).
 */
export function bindTreeForm(root: HTMLElement, store: DocStore, onSaved: (item: TreeItem) => void, rerender: () => void, closeItem: () => void): void {
  const form = root.querySelector<HTMLFormElement>('.tree-form');
  if (!form) return;
  const kind = form.dataset.treeKind as TreeItem['kind'];
  const id = form.dataset.treeId!;
  const dirty = () => form.querySelectorAll<HTMLButtonElement>('[data-tree="save"], [data-tree="reset"]').forEach((b) => (b.disabled = false));
  form.addEventListener('input', dirty);
  form.addEventListener('change', dirty);
  // Enter i ett fält sparar inte av misstag; det gör bara knappen.
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') e.preventDefault();
  });
  form.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-tree]');
    if (!b) return;
    if (b.dataset.tree === 'reset') rerender();
    if (b.dataset.tree === 'add-tag') {
      const input = form.querySelector<HTMLInputElement>('[data-tree-newtag]')!;
      const t = input.value.trim();
      if (!t) return;
      const chips = form.querySelector('.tag-chips')!;
      const existing = [...chips.querySelectorAll<HTMLInputElement>('input[name="tag"]')].find((i) => i.value === t);
      if (existing) existing.checked = true;
      else chips.insertAdjacentHTML('beforeend', `<label class="tag-check"><input type="checkbox" name="tag" value="${esc(t)}" checked><span>${esc(t)}</span></label>`);
      input.value = '';
      dirty();
    }
    if (b.dataset.tree === 'delete-folder') {
      deleteFolder(store, id);
      closeItem();
    }
    if (b.dataset.tree === 'delete-worksheet') {
      const w = store.doc.worksheets.find((x) => x.id === id);
      const n = worksheetContents(store.doc, id).length;
      if (!w) return;
      const users = w.stamp ? stampUsers(store.doc, id).length : store.doc.sheets.filter((s) => s.master === id).length;
      const what = w.stamp ? 'stämpeln' : w.paper ? 'mallbladet' : 'arbetsbladet';
      const after = users ? (w.stamp ? ` Den tas bort från ${users} blad.` : ` ${users} blad blir utan mall.`) : '';
      void askConfirm(`Ta bort ${what}?`, `${w.name}${n ? ` och de ${n} objekten på ${w.stamp ? 'den' : 'det'}` : ''} tas bort.${after} Det går att ångra.`).then((ok) => {
        if (!ok) return;
        deleteWorksheet(store, id);
        closeItem();
      });
    }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = new FormData(form);
    const str = (k: string) => String(d.get(k) ?? '');
    const num = (k: string) => Number(str(k).replace(',', '.').replace(/\s/g, ''));
    const folder = str('folder') || null;
    if (kind === 'view') {
      const scale = Math.round(num('scale'));
      saveView(
        store,
        id,
        {
          ...(str('name').trim() ? { name: str('name').trim() } : {}),
          state: str('state'),
          detail: str('detail') as 'sketch' | 'normal' | 'detail',
          // Littera och 3D bara när de skiljer sig från 2D (0.8.37).
          labelDetail: str('labelDetail') !== str('detail') ? (str('labelDetail') as 'sketch' | 'normal' | 'detail') : undefined,
          modelDetail: str('modelDetail') !== str('detail') ? (str('modelDetail') as 'sketch' | 'normal' | 'detail') : undefined,
          style: str('style') || undefined,
          trace: str('trace') || null,
          compare: d.has('compare'),
          hideDemolished: d.has('hideDemolished'),
          tags: d.getAll('tag').map(String),
          scale: scale > 0 ? scale : undefined,
        },
        folder,
      );
    } else if (kind === 'marker') {
      const depth = num('depth');
      const params: Record<string, unknown> = { depth: str('depth').trim() === '' || !(depth > 0) ? null : Math.round(depth) };
      if (d.has('label')) params.label = str('label').trim() || 'A';
      saveMarker(store, id, { name: str('name'), params, locked: d.has('locked') }, folder);
    } else if (kind === 'storey') {
      const patch: { name?: string; elevation?: number; height?: number } = {};
      if (str('name').trim()) patch.name = str('name').trim();
      if (Number.isFinite(num('elevation'))) patch.elevation = Math.round(num('elevation'));
      if (num('height') > 0) patch.height = Math.round(num('height'));
      saveStorey(store, id, patch, folder);
    } else if (kind === 'folder') {
      saveFolder(store, id, { name: str('name'), parent: folder });
    } else if (kind === 'worksheet') {
      if (isMaster(store.doc.worksheets.find((w) => w.id === id))) {
        saveMaster(store, id, { name: str('name'), size: str('size') as never, orientation: str('orientation') as never }, folder);
        const isDefault = store.doc.project.master === id;
        if (d.has('default') !== isDefault) setDefaultMaster(store, d.has('default') ? id : null);
      } else saveWorksheet(store, id, { name: str('name') }, folder);
    }
    onSaved({ kind, id });
  });
}
