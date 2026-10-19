import type { Folder, Id, ProjectDoc, TreeTab, ViewDef } from '../core/model';
import { markerName } from '../elements/markers';
import { UNDERLAY_KIND_LABEL, type UnderlayParams } from '../elements/underlay';
import { icons } from './icons';

export type NavTab = TreeTab;

const TABS: [NavTab, string][] = [
  ['underlag', 'Underlag'],
  ['modell', 'Modell'],
  ['vyer', 'Vyer'],
  ['ritningar', 'Ritningar'],
];

export interface NavigatorHost {
  doc(): ProjectDoc;
  storey(): Id;
  activeView(): Id | null;
  /** Fasaden eller sektionen som visas, om någon. */
  marker(): Id | null;
  /** Arbetsbladet som visas, om något (0.8 del 2). */
  worksheet(): Id | null;
  /** Det som är markerat i ritningen. */
  selected(): ReadonlySet<Id>;
  viewModified(v: ViewDef): boolean;
  /** Vyn som kalkeras under ritningen, om någon. */
  trace(): Id | null;
  describeView(v: ViewDef): string;
  /** Det i trädet vars inställningar visas i egenskapspanelen (0.8). */
  treeItem(): Id | null;
  /** Ritningsbladet som visas, om något (0.8 del 3). */
  layout(): Id | null;
}

/**
 * Projektets innehåll ordnat i flikar. Underlag är det man länkar in, Modell är våningar (och senare
 * sektioner, fasader och arbetsblad), Vyer är sparade visningar av modellen
 * och Ritningar är bladen som plottas.
 *
 * Projektträdet. På datorn ligger det bredvid egenskaperna, var och en med
 * sin knapp (☰ och P), ett dragstreck för bredden och ett stående band när
 * det är minimerat. På telefonen fyller det skärmen.
 */
export class Navigator {
  readonly el: HTMLElement;
  private body: HTMLElement;
  private host: NavigatorHost;
  tab: NavTab = 'vyer';
  /** Hopfällda mappar. */
  private collapsed = new Set<Id>();

  constructor(host: NavigatorHost) {
    this.host = host;
    this.el = document.createElement('aside');
    this.el.className = 'navigator';
    this.el.setAttribute('aria-label', 'Projektträd');
    this.el.innerHTML = `
      <div class="pane-title"><h2>Projektträd</h2>
        <button class="icon-mini pane-min" data-action="min-nav" aria-label="Minimera projektträdet" title="Minimera">${icons.minimize}</button>
        <button class="icon-mini pane-x" data-action="close-nav" aria-label="Stäng projektträdet" title="Stäng (N)">${icons.close}</button>
      </div>
      <div class="nav-plot"><button class="btn btn-ghost" data-action="plot" title="Exportera blad och vyer som PDF">${icons.plot}<span>Plot/export…</span></button></div>
      <div class="panel-head nav-head">
        <div class="tabs nav-tabs" role="tablist">
          ${TABS.map(([id, label]) => `<button role="tab" data-nav-tab="${id}" aria-selected="${id === this.tab}">${label}</button>`).join('')}
        </div>
        <button class="icon-btn nav-close" data-action="close-nav" aria-label="Stäng projektträdet">${icons.close}</button>
      </div>
      <div class="panel-body nav-body"></div>`;
    this.body = this.el.querySelector('.nav-body')!;
  }

  showTab(tab: NavTab): void {
    this.tab = tab;
    this.el.querySelectorAll<HTMLElement>('[data-nav-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.navTab === tab)));
    this.render();
  }

  render(): void {
    const scroll = this.body.scrollTop;
    this.body.innerHTML = this[this.tab]();
    this.body.scrollTop = scroll;
  }

  toggleFolder(id: Id): void {
    if (this.collapsed.has(id)) this.collapsed.delete(id);
    else this.collapsed.add(id);
    this.render();
  }

  /**
   * Mapparna i fliken (0.8), med det som ligger i dem. `rows` ger raden för
   * ett id som hör till fliken; det som inte ligger i någon mapp visas av
   * fliken själv.
   */
  private folders(tab: NavTab, rows: Map<Id, string>): string {
    const doc = this.host.doc();
    const list = doc.folders.filter((f) => f.tab === tab);
    if (!list.length) return '';
    const selected = this.host.treeItem();
    const inFolder = (f: Folder) => [...rows.entries()].filter(([id]) => doc.tree[id] === f.id);
    const count = (f: Folder): number => inFolder(f).length + list.filter((c) => c.parent === f.id).reduce((n, c) => n + count(c), 0);
    const branch = (parent: Id | null, depth: number): string =>
      list
        .filter((f) => f.parent === parent)
        .sort((a, b) => a.name.localeCompare(b.name, 'sv', { numeric: true }))
        .map((f) => {
          const open = !this.collapsed.has(f.id);
          const body = open ? `${branch(f.id, depth + 1)}${inFolder(f).map(([, html]) => html).join('')}` : '';
          return `<div class="folder${open ? ' open' : ''}" style="--depth:${depth}">
            <div class="view-row folder-row${f.id === selected ? ' picked' : ''}">
              <button class="icon-mini folder-toggle" data-folder-toggle="${f.id}" aria-expanded="${open}" aria-label="${open ? 'Fäll ihop' : 'Fäll ut'} ${esc(f.name)}">${icons.chevron}</button>
              <button class="view-apply folder-name" data-folder-pick="${f.id}" title="Mappens inställningar">${icons.folder}<span>${esc(f.name)}</span><small>${count(f)}</small></button>
            </div>
            ${open ? `<div class="folder-body">${body || '<p class="note folder-empty">Tom mapp. Välj mappen i det som ska ligga här.</p>'}</div>` : ''}
          </div>`;
        })
        .join('');
    return `<div class="nav-list folders">${branch(null, 0)}</div>`;
  }

  /** Raderna som inte ligger i någon mapp, i den ordning de kom. */
  private unfiled(rows: Map<Id, string>, ids: Id[]): string {
    const doc = this.host.doc();
    const valid = new Set(doc.folders.map((f) => f.id));
    return ids.filter((id) => !(doc.tree[id] && valid.has(doc.tree[id]))).map((id) => rows.get(id) ?? '').join('');
  }

  private newFolderButton(tab: NavTab): string {
    return `<button class="btn btn-ghost new-folder" data-action="new-folder" data-tab="${tab}">${icons.folderPlus}<span>Ny mapp</span></button>`;
  }

  private underlag(): string {
    const doc = this.host.doc();
    const selected = this.host.selected();
    const where = (space: Id | undefined, storey: Id): string => {
      if (space && doc.elements[space]) return markerName(doc, doc.elements[space]);
      const w = space ? doc.worksheets.find((x) => x.id === space) : undefined;
      if (w) return w.name;
      return doc.storeys.find((s) => s.id === storey)?.name ?? '';
    };
    const list = Object.values(doc.elements)
      .filter((e) => e.type === 'Underlay')
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'sv', { numeric: true }));
    const rows = new Map<Id, string>();
    for (const e of list) {
      const p = e.params as unknown as UnderlayParams;
      const file = doc.assets[p.asset];
      rows.set(
        e.id,
        `<div class="view-row${selected.has(e.id) ? ' active' : ''}"><button class="view-apply" data-underlay-pick="${e.id}" title="Visa underlaget och dess inställningar. Högerklicka (håll in på telefonen) för fler val">${esc(e.name ?? file?.name ?? 'Underlag')}${e.locked ? `<span class="row-lock" title="Låst">${icons.lock}</span>` : ''}<small>${UNDERLAY_KIND_LABEL[p.kind]} · ${esc(where(e.space, e.storey))}${file ? '' : ' · filen saknas'}</small></button><button class="icon-mini view-more" data-underlay-menu="${e.id}" aria-label="Fler val för ${esc(e.name ?? 'underlaget')}" title="Fler val">${icons.more}</button></div>`,
      );
    }
    const unfiled = this.unfiled(rows, list.map((e) => e.id));
    return `${this.folders('underlag', rows)}<section>
      ${list.length ? (unfiled ? `<div class="nav-list">${unfiled}</div>` : '') : '<p class="note">Inga underlag än. Lägg in en PDF, en bild eller en DXF att rita över, eller dra filen till ritytan.</p>'}
      <div class="nav-actions">
        <button class="btn" data-action="add-underlay">${icons.plus}<span>Lägg in underlag…</span></button>
        ${this.newFolderButton('underlag')}
      </div>
      <p class="note">Underlaget hamnar där du är: på våningen, på arbetsbladet eller i fasaden eller sektionen som är öppen. Kalibrera skalan och rikta det i egenskaperna; lås det när det ligger rätt.</p>
    </section>`;
  }

  private modell(): string {
    const doc = this.host.doc();
    const marker = this.host.marker();
    const current = marker || this.host.worksheet() ? null : this.host.storey();
    const storeys = [...doc.storeys].sort((a, b) => b.elevation - a.elevation);
    const markers = (type: string) =>
      Object.values(doc.elements)
        .filter((e) => e.type === type)
        .map((e) => ({ e, name: markerName(doc, e) }))
        .sort((a, b) => a.name.localeCompare(b.name, 'sv', { numeric: true }));
    const picked = this.host.treeItem();
    const markerRow = (id: Id, name: string, locked: boolean) =>
      `<div class="view-row${id === marker ? ' active' : ''}${id === picked ? ' picked' : ''}"><button class="view-apply" data-marker-pick="${id}" title="Öppna, och visa inställningarna i egenskaperna. Högerklicka (håll in på telefonen) för fler val">${esc(name)}${locked ? `<span class="row-lock" title="Låst">${icons.lock}</span>` : ''}</button><button class="icon-mini view-more" data-marker-menu="${id}" aria-label="Fler val för ${esc(name)}" title="Fler val">${icons.more}</button></div>`;
    const rowsById = new Map<Id, string>();
    for (const s of storeys)
      rowsById.set(s.id, `<div class="view-row${s.id === current ? ' active' : ''}${s.id === picked ? ' picked' : ''}"><button class="view-apply" data-storey-pick="${s.id}">${esc(s.name)}<small>${fmtLevel(s.elevation)}</small></button></div>`);
    const elevations = markers('Elevation');
    const sections = markers('Section');
    for (const { e, name } of [...elevations, ...sections]) rowsById.set(e.id, markerRow(e.id, name, !!e.locked));
    // Arbetsblad (0.8 del 2).
    const sheet = this.host.worksheet();
    for (const w of doc.worksheets)
      rowsById.set(
        w.id,
        `<div class="view-row${w.id === sheet ? ' active' : ''}${w.id === picked ? ' picked' : ''}"><button class="view-apply" data-worksheet-pick="${w.id}" title="Öppna, och visa inställningarna i egenskaperna">${esc(w.name)}</button></div>`,
      );
    const list = (ids: Id[], empty: string) => {
      const html = this.unfiled(rowsById, ids);
      return html ? `<div class="nav-list">${html}</div>` : ids.length ? '' : `<p class="note">${empty}</p>`;
    };
    return `${this.folders('modell', rowsById)}<section>
      <h2>Våningar</h2>
      ${list(storeys.map((s) => s.id), '')}
    </section>
    <section>
      <h2>Fasader</h2>
      ${list(elevations.map((x) => x.e.id), 'Inga fasader. Rita en med verktyget Fasad.')}
    </section>
    <section>
      <h2>Sektioner</h2>
      ${list(sections.map((x) => x.e.id), 'Inga sektioner. Rita en med verktyget Sektion.')}
      <p class="note">Fasader och sektioner räknas fram ur modellen och visar det tillstånd och den jämförelse som är vald.</p>
    </section>
    <section>
      <h2>Arbetsblad</h2>
      ${list(doc.worksheets.map((w) => w.id), 'Fria 2D-ritningar som inte hör till en våning, till exempel detaljer och skisser.')}
      <div class="nav-actions">
        <button class="btn" data-action="new-worksheet">${icons.plus}<span>Nytt arbetsblad</span></button>
        ${this.newFolderButton('modell')}
      </div>
    </section>`;
  }

  private vyer(): string {
    const doc = this.host.doc();
    const activeId = this.host.activeView();
    const active = activeId ? doc.views.find((v) => v.id === activeId) : undefined;
    const storeyName = (id: Id) => doc.storeys.find((s) => s.id === id)?.name ?? '';
    const picked = this.host.treeItem();
    const rowsById = new Map<Id, string>();
    for (const v of doc.views) {
      const mod = v.id === activeId && this.host.viewModified(v) ? ' *' : '';
      const info = [doc.storeys.length > 1 ? storeyName(v.storey) : '', this.host.describeView(v)].filter(Boolean).join(' · ');
      const traced = this.host.trace() === v.id ? '<span class="trace-tag">kalkeras</span> ' : '';
      const tags = v.tags?.length ? ` · ${v.tags.map(esc).join(', ')}` : '';
      rowsById.set(
        v.id,
        `<div class="view-row${v.id === activeId ? ' active' : ''}${v.id === picked ? ' picked' : ''}"><button class="view-apply" data-view-apply="${v.id}" title="Öppna, och visa inställningarna i egenskaperna. Högerklicka (håll in på telefonen) för fler val">${esc(v.name)}${mod}<small>${traced}${esc(info)}${tags}</small></button><button class="icon-mini view-more" data-view-menu="${v.id}" aria-label="Fler val för ${esc(v.name)}" title="Fler val">${icons.more}</button></div>`,
      );
    }
    const unfiled = this.unfiled(rowsById, doc.views.map((v) => v.id));
    const rows = doc.views.length ? unfiled : '<p class="note">Inga sparade vyer än.</p>';
    return `${this.folders('vyer', rowsById)}<section>
      <div class="nav-list">${rows}</div>
      <div class="nav-actions">
        ${active && this.host.viewModified(active) ? `<button class="btn" data-action="view-update">Spara ändringarna i ${esc(active.name)}</button>` : ''}
        <button class="btn" data-action="view-save-new">Spara som ny vy…</button>
        ${this.newFolderButton('vyer')}
      </div>
      <p class="note">En vy sparar tillstånd, jämförelse, detaljnivå, vad som visas, stilmall, kalkering och vy-taggar. Klicka på en vy för att öppna den och se dess inställningar i egenskaperna.</p>
      <p class="note soon">Export av modellen (IFC) från en vy kommer i 0.12.</p>
    </section>`;
  }

  private ritningar(): string {
    const doc = this.host.doc();
    const current = this.host.layout();
    const picked = this.host.treeItem();
    const sheets = [...doc.sheets].sort((a, b) => a.number.localeCompare(b.number, 'sv', { numeric: true }));
    const rows = new Map<Id, string>();
    for (const s of sheets) {
      const n = s.viewports.length;
      rows.set(
        s.id,
        `<div class="view-row${s.id === current ? ' active' : ''}${s.id === picked ? ' picked' : ''}"><button class="view-apply" data-sheet-pick="${s.id}" title="Visa bladet och dess inställningar">${icons.sheet}<span class="sheet-row-name"><b>${esc(s.number)}</b> ${esc(s.name)}</span><small>${s.size} · ${n} ${n === 1 ? 'vy' : 'vyer'}</small></button></div>`,
      );
    }
    const unfiled = this.unfiled(rows, sheets.map((s) => s.id));
    return `${this.folders('ritningar', rows)}<section>
      ${sheets.length ? (unfiled ? `<div class="nav-list">${unfiled}</div>` : '') : '<p class="note">Inga ritningsblad än.</p>'}
      <div class="nav-actions">
        <button class="btn" data-action="new-sheet">${icons.plus}<span>Nytt ritningsblad</span></button>
        ${this.newFolderButton('ritningar')}
      </div>
      <p class="note">Ett blad har ritningshuvud och vyer i sin skala. Klicka på en vy på bladet för att ändra skala och rubrik, och dra den för att flytta den. Plot/export gör PDF:er av bladen.</p>
    </section>`;
  }
}

function fmtLevel(mm: number): string {
  const m = mm / 1000;
  return `+${m.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.replace('+-', '−');
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}
