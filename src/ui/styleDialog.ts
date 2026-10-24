import { setGraphics } from '../core/commands';
import { normalizeStyle, PRESETS, type StyleSheet } from '../core/graphics';
import type { DocStore } from '../core/store';
import { escapeHtml } from './labels';
import { actionRows, applyActionField } from './style/actions';
import { applyLabelField, labelSection } from './style/labels';
import { applyPenField, penSection, resetPen } from './style/pens';

/**
 * Stilmallen: hur väggar och linjer ritas för varje åtgärd. Ändringar syns
 * direkt och kan ångras. Stilmallen kan sparas som fil och öppnas i andra projekt.
 *
 * Delarna ligger i `src/ui/style/` (0.8.27), en fil per del med dess HTML och
 * det dess fält ändrar: åtgärderna, texterna och litteran, och pennorna.
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
    this.el.innerHTML = `<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="style-title">
      <header><h2 id="style-title">Stilmall</h2><button class="icon-btn" data-action="close" aria-label="Stäng">×</button></header>
      <div class="dialog-body">
        <label class="field inline"><span>Utgå från</span><select id="style-preset">${custom}${presetOptions}</select></label>
        <p class="note">Svart visas ljust på mörk skärm och vitt följer bakgrunden. På papper blir de svart och vitt.</p>
        ${actionRows(style)}
        ${labelSection(style)}
        ${penSection(style)}
      </div>
      <footer>
        <button class="btn" data-action="open-style">Öppna stilmall…</button>
        <button class="btn" data-action="save-style">Spara stilmall som fil…</button>
        <button class="btn btn-primary" data-action="close">Klar</button>
      </footer>
    </div>`;
  }

  private onClick(e: Event): void {
    const action = (e.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;
    if (action === 'close') this.close();
    if (action === 'pen-reset') {
      const key = (e.target as HTMLElement).closest<HTMLElement>('[data-pen-key]')?.dataset.penKey;
      const style: StyleSheet = structuredClone(this.store.doc.graphics);
      if (key && resetPen(style, key)) {
        style.name = 'Egen stilmall';
        setGraphics(this.store, style, 'Ändra pennor');
      }
    }
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
    const style: StyleSheet = structuredClone(this.store.doc.graphics);
    // Varje del av stilmallen svarar för sina egna fält.
    const label = applyPenField(style, input) ?? applyLabelField(style, input) ?? applyActionField(style, input);
    if (!label) return;
    style.name = 'Egen stilmall';
    setGraphics(this.store, style, label);
  }
}
