import { setGraphics } from '../core/commands';
import { normalizeStyle, PRESETS, type ActionKey, type Color, type FillDef, type StyleSheet } from '../core/graphics';
import type { DocStore } from '../core/store';
import { escapeHtml } from './labels';

const ROWS: { key: ActionKey; label: string; hint: string }[] = [
  { key: 'plain', label: 'Nybyggnad', hint: 'Utan jämförelse: nybyggnad, eller när jämförelsen är avslagen' },
  { key: 'existing', label: 'Befintligt', hint: 'Finns kvar oförändrat. Dörrar som finns i Befintligt öppnas så här i alla vyer' },
  { key: 'demolished', label: 'Rivs', hint: 'Finns i jämförelsen men inte i förslaget' },
  { key: 'new', label: 'Planerat', hint: 'Finns i förslaget men inte i jämförelsen. Övriga dörrar öppnas så här i alla vyer' },
];

/**
 * Stilmallen: hur väggar och linjer ritas för varje åtgärd. Ändringar syns
 * direkt och kan ångras. Stilmallen kan sparas som fil och öppnas i andra projekt.
 */
export class StyleDialog {
  readonly el: HTMLElement;
  private store: DocStore;
  private onSaveFile: (style: StyleSheet) => void;
  private onError: (msg: string) => void;

  constructor(store: DocStore, onSaveFile: (style: StyleSheet) => void, onError: (msg: string) => void) {
    this.store = store;
    this.onSaveFile = onSaveFile;
    this.onError = onError;
    this.el = document.createElement('div');
    this.el.className = 'dialog-backdrop';
    this.el.hidden = true;
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.close();
      this.onClick(e);
    });
    this.el.addEventListener('change', (e) => this.onChange(e));
    store.subscribe(() => {
      if (!this.el.hidden) this.render();
    });
  }

  open(): void {
    this.el.hidden = false;
    this.render();
  }

  close(): void {
    this.el.hidden = true;
  }

  get isOpen(): boolean {
    return !this.el.hidden;
  }

  private render(): void {
    const style = this.store.doc.graphics;
    const presetOptions = PRESETS.map((p, i) => `<option value="${i}"${p.name === style.name ? ' selected' : ''}>${escapeHtml(p.name)}</option>`).join('');
    const custom = PRESETS.some((p) => p.name === style.name) ? '' : `<option selected disabled>${escapeHtml(style.name)}</option>`;
    const rows = ROWS.map(({ key, label, hint }) => {
      const a = style.actions[key];
      const fill = a.cutFill;
      const fillColor = fill.kind === 'none' ? 'ink' : fill.color;
      const outline = a.cutOutline ? (a.cutOutline.dash?.length ? 'dashed' : 'solid') : 'none';
      return `<div class="style-row">
        <div class="style-name"><b>${label}</b><span>${hint}</span></div>
        <label><span>Fyllning</span><select data-key="${key}" data-field="fill">
          <option value="none"${fill.kind === 'none' ? ' selected' : ''}>Ingen</option>
          <option value="solid"${fill.kind === 'solid' ? ' selected' : ''}>Solid</option>
          <option value="hatch"${fill.kind === 'hatch' ? ' selected' : ''}>Skraffering</option>
        </select></label>
        <label><span>${fill.kind === 'hatch' ? 'Linjefärg' : 'Färg'}</span><input type="color" data-key="${key}" data-field="color" value="${toHex(fillColor)}"${fill.kind === 'none' ? ' disabled' : ''}></label>
        <label><span>Opacitet</span><span class="input-unit"><input type="text" data-expr data-unit="" data-step="10" inputmode="decimal" autocomplete="off" data-key="${key}" data-field="opacity" value="${Math.round((fill.kind === 'none' ? 1 : fill.opacity ?? 1) * 100)}"${fill.kind === 'none' ? ' disabled' : ''}><i>%</i></span></label>
        <label><span>Bakgrund</span><span class="bg-pick"><input type="checkbox" data-key="${key}" data-field="bgOn"${fill.kind === 'hatch' && fill.background ? ' checked' : ''}${fill.kind === 'hatch' ? '' : ' disabled'} aria-label="Bakgrund"><input type="color" data-key="${key}" data-field="bg" value="${toHex(fill.kind === 'hatch' && fill.background ? fill.background : 'paper')}"${fill.kind === 'hatch' && fill.background ? '' : ' disabled'}><input type="text" data-expr data-unit="" data-step="10" inputmode="decimal" autocomplete="off" data-key="${key}" data-field="bgOpacity" value="${Math.round((fill.kind === 'hatch' ? fill.backgroundOpacity ?? 1 : 1) * 100)}"${fill.kind === 'hatch' && fill.background ? '' : ' disabled'} aria-label="Bakgrundens opacitet" title="Bakgrundens opacitet, %"></span></label>
        <label><span>Kontur</span><select data-key="${key}" data-field="outline">
          <option value="solid"${outline === 'solid' ? ' selected' : ''}>Heldragen</option>
          <option value="dashed"${outline === 'dashed' ? ' selected' : ''}>Streckad</option>
          <option value="none"${outline === 'none' ? ' selected' : ''}>Ingen</option>
        </select></label>
        <label><span>Konturfärg</span><input type="color" data-key="${key}" data-field="lineColor" value="${toHex(a.cutOutline?.color ?? a.lines.color)}"></label>
        ${key === 'existing' || key === 'new' ? `<label><span>Dörrar öppna</span><span class="input-unit"><input type="text" data-expr data-unit="deg" data-step="15" inputmode="decimal" autocomplete="off" data-key="${key}" data-field="door" value="${a.doorAngle}"><i>°</i></span></label>` : '<span class="style-door-na" aria-hidden="true"></span>'}
      </div>`;
    }).join('');

    this.el.innerHTML = `<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="style-title">
      <header><h2 id="style-title">Stilmall</h2><button class="icon-btn" data-action="close" aria-label="Stäng">×</button></header>
      <div class="dialog-body">
        <label class="field inline"><span>Utgå från</span><select id="style-preset">${custom}${presetOptions}</select></label>
        <p class="note">Svart visas ljust på mörk skärm och vitt följer bakgrunden. På papper blir de svart och vitt.</p>
        ${rows}
        ${this.labelSection(style)}
      </div>
      <footer>
        <button class="btn" data-action="open-style">Öppna stilmall…</button>
        <button class="btn" data-action="save-style">Spara stilmall som fil…</button>
        <button class="btn btn-primary" data-action="close">Klar</button>
      </footer>
    </div>`;
  }

  private labelSection(style: StyleSheet): string {
    const l = style.labels;
    const h = (k: keyof StyleSheet['labels']['heights'], label: string) =>
      `<label><span>${label}</span><span class="input-unit"><input type="text" data-expr data-step="0.05" inputmode="decimal" autocomplete="off" data-lab="h:${k}" value="${Number(l.heights[k]).toFixed(2)}"><i>mm</i></span></label>`;
    const names: Record<string, string> = { Wall: 'Väggar', Door: 'Dörrar', Window: 'Fönster' };
    const tpl = (Object.keys(l.templates) as (keyof StyleSheet['labels']['templates'])[])
      .map(
        (k) => `<div class="tpl-row"><b>${names[k]}</b>
          <label><span>Normal</span><textarea rows="2" data-lab="t:${k}:normal">${escapeHtml(l.templates[k].normal)}</textarea></label>
          <label><span>Detalj</span><textarea rows="3" data-lab="t:${k}:detail">${escapeHtml(l.templates[k].detail)}</textarea></label></div>`,
      )
      .join('');
    return `<section class="style-labels">
      <h3>Texter och littera</h3>
      <div class="style-row labels-row">
        <label><span>Justering</span><select data-lab="align"><option value="left"${l.align === 'left' ? ' selected' : ''}>Vänster</option><option value="center"${l.align === 'center' ? ' selected' : ''}>Centrerat</option></select></label>
        ${h('roomName', 'Rumsnamn')}${h('roomInfo', 'Rumsnr, area')}${h('littera', 'Littera')}${h('dimension', 'Mått')}
      </div>
      <p class="note">Litteramallar: en rad per textrad. Fält: <code>{typ}</code> (D1), <code>{storlek}</code> (D10×21), <code>{nummer}</code> (D1203), <code>{hål}</code> (1010×2110), <code>{karm}</code> (990×2090) och egna egenskaper med sitt namn, t.ex. <code>{brandklass}</code>. Tomma rader hoppas över. I Skiss visas ingen littera.</p>
      ${tpl}
    </section>`;
  }

  private onClick(e: Event): void {
    const action = (e.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;
    if (action === 'close') this.close();
    if (action === 'save-style') this.onSaveFile(this.store.doc.graphics);
    if (action === 'open-style') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file) return;
        try {
          setGraphics(this.store, normalizeStyle(JSON.parse(await file.text())));
        } catch (err) {
          this.onError(err instanceof SyntaxError ? 'Filen gick inte att läsa som stilmall.' : (err as Error).message);
        }
      });
      input.click();
    }
  }

  private onChange(e: Event): void {
    const input = e.target as HTMLInputElement | HTMLSelectElement;
    if (input.id === 'style-preset') {
      setGraphics(this.store, structuredClone(PRESETS[Number(input.value)]));
      return;
    }
    if (input.dataset.lab) {
      const style: StyleSheet = structuredClone(this.store.doc.graphics);
      const [kind, a, b] = input.dataset.lab.split(':');
      if (kind === 'align') style.labels.align = input.value === 'center' ? 'center' : 'left';
      if (kind === 'h' && Number(input.value) > 0) style.labels.heights[a as keyof StyleSheet['labels']['heights']] = Number(input.value);
      if (kind === 't') style.labels.templates[a as keyof StyleSheet['labels']['templates']][b as 'normal' | 'detail'] = input.value;
      style.name = 'Egen stilmall';
      setGraphics(this.store, style, 'Ändra texter');
      return;
    }
    const key = input.dataset.key as ActionKey | undefined;
    if (!key) return;
    const style: StyleSheet = structuredClone(this.store.doc.graphics);
    const a = style.actions[key];
    switch (input.dataset.field) {
      case 'fill': {
        const color: Color = a.cutFill.kind === 'none' ? 'ink' : a.cutFill.color;
        a.cutFill = makeFill(input.value as FillDef['kind'], color);
        break;
      }
      case 'color':
        if (a.cutFill.kind !== 'none') a.cutFill = { ...a.cutFill, color: fromHex(input.value) };
        break;
      case 'opacity':
        if (a.cutFill.kind !== 'none') a.cutFill = { ...a.cutFill, opacity: clamp01(Number(input.value) / 100) };
        break;
      case 'bgOn':
        if (a.cutFill.kind === 'hatch') a.cutFill = { ...a.cutFill, background: (input as HTMLInputElement).checked ? 'paper' : null };
        break;
      case 'bg':
        if (a.cutFill.kind === 'hatch') a.cutFill = { ...a.cutFill, background: fromHex(input.value) };
        break;
      case 'bgOpacity':
        if (a.cutFill.kind === 'hatch') a.cutFill = { ...a.cutFill, backgroundOpacity: clamp01(Number(input.value) / 100) };
        break;
      case 'outline': {
        const base = a.cutOutline ?? { weight: 0.35, color: a.lines.color };
        if (input.value === 'none') a.cutOutline = null;
        else a.cutOutline = { ...base, dash: input.value === 'dashed' ? [2, 1] : undefined };
        a.lines = { ...a.lines, dash: input.value === 'dashed' ? [2, 1] : undefined };
        break;
      }
      case 'lineColor': {
        const c = fromHex(input.value);
        if (a.cutOutline) a.cutOutline = { ...a.cutOutline, color: c };
        a.lines = { ...a.lines, color: c };
        break;
      }
      case 'door':
        a.doorAngle = Math.max(0, Math.min(90, Number(input.value) || 0));
        break;
    }
    style.name = 'Egen stilmall';
    setGraphics(this.store, style, 'Ändra stilmall');
  }
}

function clamp01(v: number): number {
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1;
}

function makeFill(kind: FillDef['kind'], color: Color): FillDef {
  if (kind === 'none') return { kind: 'none' };
  if (kind === 'solid') return { kind: 'solid', color };
  return { kind: 'hatch', color, angle: 45, spacing: 0.6, weight: 0.18 };
}

/** Svart och vitt sparas som "ink" och "paper" så att de följer skärmens tema. */
function fromHex(hex: string): Color {
  const h = hex.toLowerCase();
  if (h === '#000000') return 'ink';
  if (h === '#ffffff') return 'paper';
  return h as Color;
}

function toHex(c: string): string {
  if (c === 'ink' || c === 'muted' || c === 'accent') return '#000000';
  if (c === 'paper') return '#ffffff';
  return c;
}
