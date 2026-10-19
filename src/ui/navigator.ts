import type { Folder, Id, ProjectDoc, TreeTab, ViewDef } from '../core/model';
import { markerName } from '../elements/markers';
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
  viewModified(v: ViewDef): boolean;
  /** Vyn som kalkeras under ritningen, om någon. */
  trace(): Id | null;
  describeView(v: ViewDef): string;
  /** Det i trädet vars inställningar visas i egenskapspanelen (0.8). */
  treeItem(): Id | null;
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
    return `${this.folders('underlag', new Map())}<section>
      <h2>Underlag</h2>
      <p class="note">Här hamnar det man ritar över: DXF- och PDF-filer, bilder och kartor. Underlagen placeras i skala och kan visas i vyer och på ritningar.</p>
      <p class="note soon">Kommer i nästa del av 0.8.</p>
      <div class="nav-actions">${this.newFolderButton('underlag')}</div>
    </section>`;
  }

  private modell(): string {
    const doc = this.host.doc();
    const marker = this.host.marker();
    const current = marker ? null : this.host.storey();
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
      <p class="note">Fria 2D-ritningar som inte hör till en våning, till exempel detaljer, i samma projekt som modellen.</p>
      <p class="note soon">Kommer i nästa del av 0.8.</p>
      <div class="nav-actions">${this.newFolderButton('modell')}</div>
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
      <p class="note soon">Export av modellen (IFC) från en vy kommer i 0.15.</p>
    </section>`;
  }

  private ritningar(): string {
    return `${this.folders('ritningar', new Map())}<section>
      <h2>Ritningar</h2>
      <p class="note">Ritningsblad med ritningshuvud och vyer placerade i skala. De skrivs ut och exporteras med Plot/export.</p>
      <p class="note soon">Kommer i sista delen av 0.8.</p>
      <div class="nav-actions">${this.newFolderButton('ritningar')}</div>
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
