import type { Id, ProjectDoc, ViewDef } from '../core/model';
import { markerName } from '../elements/markers';
import { icons } from './icons';

export type NavTab = 'underlag' | 'modell' | 'vyer' | 'ritningar';

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
}

/**
 * Navigatorn: projektets innehåll ordnat i flikar, ungefär som ArchiCADs
 * organisatör. Underlag är det man länkar in, Modell är våningar (och senare
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

  private underlag(): string {
    return `<section>
      <h2>Underlag</h2>
      <p class="note">Här hamnar det man ritar över: DXF- och PDF-filer, bilder och kartor. Underlagen placeras i skala och kan visas i vyer och på ritningar.</p>
      <p class="note soon">Kommer i 0.8, tillsammans med ritningar och utskrift.</p>
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
    const rows = (type: string, empty: string) => {
      const list = markers(type);
      if (!list.length) return `<p class="note">${empty}</p>`;
      return `<div class="nav-list">${list
        .map(({ e, name }) => {
          const auto = (e.params as { auto?: boolean }).auto ? 'placeras automatiskt' : '';
          return `<div class="view-row${e.id === marker ? ' active' : ''}"><button class="view-apply" data-marker-pick="${e.id}" title="Högerklicka (håll in på telefonen) för fler val">${esc(name)}<small>${auto}</small></button><button class="icon-mini view-more" data-marker-menu="${e.id}" aria-label="Fler val för ${esc(name)}" title="Fler val">${icons.more}</button></div>`;
        })
        .join('')}</div>`;
    };
    return `<section>
      <h2>Våningar</h2>
      <div class="nav-list">${storeys
        .map(
          (s) =>
            `<div class="view-row${s.id === current ? ' active' : ''}"><button class="view-apply" data-storey-pick="${s.id}">${esc(s.name)}<small>${fmtLevel(s.elevation)}</small></button></div>`,
        )
        .join('')}</div>
    </section>
    <section>
      <h2>Fasader</h2>
      ${rows('Elevation', 'Inga fasader. Rita en med verktyget Fasad.')}
    </section>
    <section>
      <h2>Sektioner</h2>
      ${rows('Section', 'Inga sektioner. Rita en med verktyget Sektion.')}
      <p class="note">Fasader och sektioner räknas fram ur modellen och visar det tillstånd och den jämförelse som är vald.</p>
    </section>
    <section>
      <h2>Arbetsblad</h2>
      <p class="note">Fria 2D-ritningar som inte hör till en våning, till exempel detaljer, i samma projekt som modellen.</p>
      <p class="note soon">Kommer i 0.8.</p>
    </section>`;
  }

  private vyer(): string {
    const doc = this.host.doc();
    const activeId = this.host.activeView();
    const active = activeId ? doc.views.find((v) => v.id === activeId) : undefined;
    const storeyName = (id: Id) => doc.storeys.find((s) => s.id === id)?.name ?? '';
    const rows = doc.views.length
      ? doc.views
          .map((v) => {
            const mod = v.id === activeId && this.host.viewModified(v) ? ' *' : '';
            const info = [doc.storeys.length > 1 ? storeyName(v.storey) : '', this.host.describeView(v)].filter(Boolean).join(' · ');
            const traced = this.host.trace() === v.id ? '<span class="trace-tag">kalkeras</span> ' : '';
            return `<div class="view-row${v.id === activeId ? ' active' : ''}"><button class="view-apply" data-view-apply="${v.id}" title="Högerklicka (håll in på telefonen) för fler val">${esc(v.name)}${mod}<small>${traced}${esc(info)}</small></button><button class="icon-mini view-more" data-view-menu="${v.id}" aria-label="Fler val för ${esc(v.name)}" title="Fler val">${icons.more}</button></div>`;
          })
          .join('')
      : '<p class="note">Inga sparade vyer än.</p>';
    return `<section>
      <div class="nav-list">${rows}</div>
      <div class="nav-actions">
        ${active && this.host.viewModified(active) ? `<button class="btn" data-action="view-update">Spara ändringarna i ${esc(active.name)}</button>` : ''}
        <button class="btn" data-action="view-save-new">Spara som ny vy…</button>
      </div>
      <p class="note">En vy sparar tillstånd, jämförelse, detaljnivå, vad som visas, stilmall och kalkering. Högerklicka på en vy för att byta namn, kalkera den eller ta bort den.</p>
      <p class="note soon">Export av modellen (IFC) från en vy kommer i 0.14.</p>
    </section>`;
  }

  private ritningar(): string {
    return `<section>
      <h2>Ritningar</h2>
      <p class="note">Ritningsblad med ritningshuvud och vyer placerade i skala. Härifrån skrivs bladen ut som PDF, ett eller flera på en gång.</p>
      <p class="note soon">Kommer i 0.8.</p>
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
