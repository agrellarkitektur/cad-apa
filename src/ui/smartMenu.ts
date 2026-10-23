import { icons, type IconName } from './icons';
import { escapeHtml } from './labels';
import type { Modifier } from './modify/controller';
import { OPS, railOf, type OpId } from './modify/ops';
import type { PropertiesPanel } from './propertiesPanel';

/** En rektangel i ritytan (px från dess övre vänstra hörn). */
export interface ScreenBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Smartmenyn för något annat än markerade objekt (0.8.6): ett ritningshuvud
 * eller en vy på ett blad. Rubriken, knapparna och vad de gör kommer
 * utifrån; menyn läggs bredvid `anchor` som för det markerade.
 */
export interface SmartMenuCustom {
  title: string;
  sub: string;
  buttons: { id: string; label: string; icon: IconName; danger?: boolean; pressed?: boolean }[];
  anchor: () => ScreenBox | null;
  run: (id: string) => void;
  /** Om det menyn gäller finns kvar; annars stängs menyn vid nästa omritning. */
  alive: () => boolean;
}

/**
 * Smartmenyn (0.8.5): menyn som visas intill det markerade. Den förenar
 * snabbmenyn vid markören och Modifiera-paletten:
 *
 * - överst Modifiera-valen för det markerade, eller för änden, hörnet eller
 *   kanten man klickat på i det,
 * - under dem raden med valets namn, värdefält och tips,
 * - sedan snabbknapparna (Center, Vänd väggen, Riv …), och *Mer* fäller ut
 *   alla inställningar nedåt.
 *
 * Greppet till vänster flyttar menyn; dubbelklick på greppet låter den följa
 * markeringen igen. Menyn läggs bredvid det markerade, på den sida där det
 * finns plats, inte över det.
 */
export class SmartMenu {
  readonly el: HTMLElement;
  private container: HTMLElement;
  private panel: PropertiesPanel;
  private modifier: Modifier;
  private anchor: () => ScreenBox | null;
  /** Modifiera-valen behöver planen; när bara 3D visas syns snabbknapparna. */
  planShown: () => boolean = () => true;
  /** Var man klickade (i fönstret), när det markerade inte syns i planen (3D). */
  private at: { x: number; y: number } | null = null;
  /** Var menyn lagts när den flyttats (i ritytan), annars null. */
  private pinned: { x: number; y: number } | null = null;
  private drag: { id: number; dx: number; dy: number } | null = null;
  expanded = false;
  /** Det menyn visas för när det inte är markerade objekt (0.8.6). */
  custom: SmartMenuCustom | null = null;
  /** En egen meny för det markerade, t.ex. en ensam vy på ett blad (0.8.9); annars null. */
  customFor: () => SmartMenuCustom | null = () => null;

  constructor(container: HTMLElement, panel: PropertiesPanel, modifier: Modifier, anchor: () => ScreenBox | null) {
    this.container = container;
    this.panel = panel;
    this.modifier = modifier;
    this.anchor = anchor;
    this.el = document.createElement('div');
    this.el.className = 'smart-menu';
    this.el.hidden = true;
    this.el.setAttribute('role', 'toolbar');
    this.el.setAttribute('aria-label', 'Smartmeny');
    // Klick i menyn ska inte nå planen under den.
    this.el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      const grip = (e.target as HTMLElement).closest('.sm-grip');
      if (grip && e.button === 0) {
        e.preventDefault();
        const r = this.el.getBoundingClientRect();
        this.drag = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top };
        (grip as HTMLElement).setPointerCapture(e.pointerId);
        this.el.classList.add('dragging');
      }
    });
    this.el.addEventListener('pointermove', (e) => {
      if (!this.drag || e.pointerId !== this.drag.id) return;
      const c = this.container.getBoundingClientRect();
      this.pinned = { x: e.clientX - c.left - this.drag.dx, y: e.clientY - c.top - this.drag.dy };
      this.place();
    });
    const end = (e: PointerEvent) => {
      if (!this.drag || e.pointerId !== this.drag.id) return;
      this.drag = null;
      this.el.classList.remove('dragging');
    };
    this.el.addEventListener('pointerup', end);
    this.el.addEventListener('pointercancel', end);
    this.el.addEventListener('dblclick', (e) => {
      if ((e.target as HTMLElement).closest('.sm-grip')) {
        this.pinned = null;
        this.refresh();
      }
    });
    this.el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const own = t.closest<HTMLElement>('[data-sm-custom]')?.dataset.smCustom;
      if (own && this.custom) {
        this.custom.run(own);
        return;
      }
      const op = t.closest<HTMLElement>('[data-op]')?.dataset.op as OpId | undefined;
      if (op) {
        if (this.modifier.active === op) this.modifier.cancel();
        else this.modifier.choose(op);
        return;
      }
      const a = t.closest<HTMLElement>('[data-action]')?.dataset.action;
      if (a === 'smart-more' || a === 'smart-less') {
        this.expanded = a === 'smart-more';
        this.refresh();
        return;
      }
      this.panel.handleClick(e);
    });
    this.el.addEventListener('change', (e) => {
      if (!(e.target as HTMLElement).matches('[data-modify-value]')) this.panel.handleChange(e);
    });
    modifier.bindValue(this.el);
    modifier.subscribe(() => {
      if (!this.visible) return;
      this.refresh(true);
      if (this.modifier.active) this.modifier.focusValue(this.el);
    });
    container.appendChild(this.el);
  }

  get visible(): boolean {
    return !this.el.hidden;
  }

  /** Visa för det markerade. `clientX/Y` är klicket, om det markerade inte syns i planen. */
  show(clientX: number, clientY: number, expanded = false): void {
    const own = this.customFor();
    if (own) {
      this.showCustom(own, clientX, clientY);
      return;
    }
    this.custom = null;
    this.at = { x: clientX, y: clientY };
    if (expanded) this.expanded = true;
    this.el.hidden = false;
    this.refresh(true);
  }

  /** Visa för något annat än markerade objekt, t.ex. ett ritningshuvud. */
  showCustom(c: SmartMenuCustom, clientX: number, clientY: number): void {
    this.custom = c;
    this.at = { x: clientX, y: clientY };
    this.expanded = false;
    this.el.hidden = false;
    this.refresh(true);
  }

  hide(): void {
    this.custom = null;
    this.at = null;
    this.expanded = false;
    this.el.hidden = true;
  }

  /**
   * Rita om innehållet, t.ex. när markeringen eller modellen ändrats. Ett
   * fält som någon skriver i rörs inte, utom när Modifiera-läget ändrats
   * (`force`).
   */
  refresh(force = false): void {
    if (this.el.hidden) return;
    if (this.custom) {
      // En egen meny för det markerade byggs om, så att knapparna följer läget (0.8.9).
      this.custom = this.customFor() ?? this.custom;
      this.renderCustom(this.custom);
      return;
    }
    const quick = this.panel.quickMarkup(this.expanded ? 'less' : true, false);
    if (!quick) {
      const own = this.customFor();
      if (own) {
        this.custom = own;
        this.renderCustom(own);
      } else this.hide();
      return;
    }
    const focused = document.activeElement as HTMLElement | null;
    if (!force && focused && this.el.contains(focused) && focused.matches('input, select, textarea')) return;
    const m = this.modifier;
    const where = m.where();
    // Änden, hörnet eller kanten man klickat på; med flera markerade också vilket objekt.
    const title = this.panel.quickTitle(where?.where ? (m.ctx?.ids.length === 1 ? where.where : `${where.where} · ${where.what}`) : undefined);
    const grip = `<button type="button" class="sm-grip" aria-label="Flytta smartmenyn" title="Dra för att flytta${this.pinned ? ', dubbelklicka för att följa markeringen igen' : ''}">${icons.grip}</button>`;
    const btn = (op: OpId) =>
      `<button type="button" class="qb-btn sm-op" data-op="${op}" aria-pressed="${m.active === op}" title="${escapeHtml(`${OPS[op].label}${railOf(op) ? ` (Shift+${railOf(op)!.key})` : ''}. ${OPS[op].hint}`)}" aria-label="${escapeHtml(OPS[op].label)}">${icons[OPS[op].icon]}<span>${OPS[op].short}</span></button>`;
    const groups = this.planShown() ? m.groups() : [];
    const ops = groups.length ? `<div class="sm-ops qb-actions">${groups.map((g) => g.map(btn).join('')).join('<span class="sm-sep"></span>')}</div>` : '';
    const body = this.expanded ? this.panel.selectionMarkup() : null;
    const scroll = this.el.querySelector('.sm-body')?.scrollTop ?? 0;
    this.el.classList.toggle('expanded', this.expanded);
    this.el.classList.toggle('pinned', !!this.pinned);
    this.el.innerHTML =
      `<div class="sm-head">${grip}${title}</div>` +
      ops +
      m.detailMarkup() +
      `<div class="sm-quick quick-bar">${quick}</div>` +
      (body ? `<div class="sm-body compact">${body}<div class="sm-foot"><button type="button" class="btn" data-action="open-panel">Visa i egenskapspanelen</button></div></div>` : '');
    const b = this.el.querySelector('.sm-body');
    if (b) b.scrollTop = scroll;
    this.place();
  }

  private renderCustom(c: SmartMenuCustom): void {
    if (!c.alive()) {
      this.hide();
      return;
    }
    const grip = `<button type="button" class="sm-grip" aria-label="Flytta smartmenyn" title="Dra för att flytta">${icons.grip}</button>`;
    const btns = c.buttons
      .map(
        (b) =>
          `<button type="button" class="qb-btn${b.danger ? ' danger' : ''}" data-sm-custom="${escapeHtml(b.id)}"${b.pressed !== undefined ? ` aria-pressed="${b.pressed}"` : ''} title="${escapeHtml(b.label)}">${icons[b.icon]}<span>${escapeHtml(b.label)}</span></button>`,
      )
      .join('');
    this.el.classList.remove('expanded');
    this.el.classList.toggle('pinned', !!this.pinned);
    this.el.innerHTML =
      `<div class="sm-head">${grip}<div class="qb-title"><b>${escapeHtml(c.title)}</b><small>${escapeHtml(c.sub)}</small></div></div>` +
      `<div class="sm-quick quick-bar"><div class="qb-actions">${btns}</div></div>`;
    this.place();
  }

  /** Lägg menyn igen, t.ex. efter panorering. */
  reposition(): void {
    if (!this.el.hidden) this.place();
  }

  /** Bredvid det markerade, där menyn lagts, eller intill klicket; alltid inom ritytan. */
  private place(): void {
    const r = this.container.getBoundingClientRect();
    const w = this.el.offsetWidth;
    const h = this.el.offsetHeight;
    const gap = 14;
    const m = 8;
    const clampX = (x: number) => Math.max(m, Math.min(x, r.width - w - m));
    const clampY = (y: number) => Math.max(m, Math.min(y, r.height - h - m));
    let pos: { x: number; y: number } | null = null;
    if (this.pinned) pos = this.pinned;
    else {
      const b = this.custom ? this.custom.anchor() : this.anchor();
      if (b && b.right > 0 && b.bottom > 0 && b.left < r.width && b.top < r.height) {
        // Höger, vänster, under, över: den första sidan där menyn får plats.
        // Får den inte plats någonstans, den sida där den täcker minst av det markerade.
        const sides = [
          { x: b.right + gap, y: b.top },
          { x: b.left - gap - w, y: b.top },
          { x: b.left, y: b.bottom + gap },
          { x: b.left, y: b.top - gap - h },
        ].map((q) => ({ x: clampX(q.x), y: clampY(q.y) }));
        const cover = (q: { x: number; y: number }) =>
          Math.max(0, Math.min(q.x + w, b.right) - Math.max(q.x, b.left)) * Math.max(0, Math.min(q.y + h, b.bottom) - Math.max(q.y, b.top));
        pos = sides.find((q) => cover(q) === 0) ?? sides.reduce((best, q) => (cover(q) < cover(best) ? q : best));
      }
      if (!pos && this.at) {
        // Det markerade syns inte, eller fyller ritytan: intill klicket.
        let x = this.at.x - r.left + 18;
        let y = this.at.y - r.top + 18;
        if (x + w > r.width - m) x = this.at.x - r.left - w - 18;
        if (y + h > r.height - m) y = this.at.y - r.top - h - 18;
        pos = { x, y };
      }
    }
    if (!pos) return;
    this.el.style.left = `${Math.round(clampX(pos.x))}px`;
    this.el.style.top = `${Math.round(clampY(pos.y))}px`;
  }
}
