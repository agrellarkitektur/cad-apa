import { escapeHtml } from './labels';
import { applyUiColors, defaultUiSettings, QUICK_ACTIONS, QUICK_TYPES, saveUiSettings, SHORTCUTS, type QuickId, type UiSettings } from './uiSettings';

/**
 * Gränssnitt: rutnät, färger på markeringar och referenslinjer, vilka
 * snabbknappar som visas för varje sorts objekt, och kortkommandona.
 */
export class SettingsDialog {
  readonly el: HTMLElement;
  private settings: UiSettings;
  private onChange: (s: UiSettings) => void;

  constructor(settings: UiSettings, onChange: (s: UiSettings) => void) {
    this.settings = settings;
    this.onChange = onChange;
    this.el = document.createElement('div');
    this.el.className = 'dialog-backdrop';
    this.el.hidden = true;
    this.el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t === this.el || t.closest('[data-action="close-settings"]')) this.close();
      if (t.closest('[data-action="reset-settings"]')) {
        this.settings = defaultUiSettings();
        this.commit();
        this.render();
      }
    });
    this.el.addEventListener('change', (e) => this.change(e.target as HTMLInputElement));
    this.el.addEventListener('input', (e) => {
      const t = e.target as HTMLInputElement;
      if (t.type === 'color') this.change(t);
    });
  }

  get isOpen(): boolean {
    return !this.el.hidden;
  }

  open(): void {
    this.el.hidden = false;
    this.render();
  }

  close(): void {
    this.el.hidden = true;
  }

  /** När inställningen ändras någon annanstans, t.ex. rutnätet med G. */
  update(s: UiSettings): void {
    this.settings = s;
    if (this.isOpen) this.render();
  }

  private change(t: HTMLInputElement): void {
    const s = this.settings;
    switch (t.dataset.setting) {
      case 'grid':
        s.grid = t.checked;
        break;
      case 'pet':
        s.petPalette = t.checked;
        break;
      case 'autodims':
        s.autoDims = t.checked;
        break;
      case 'sel-theme':
        s.selColor = t.checked ? null : themeColor('--sel');
        break;
      case 'sel':
        s.selColor = t.value;
        break;
      case 'ref-theme':
        s.refColor = t.checked ? null : themeColor('--ref');
        break;
      case 'ref':
        s.refColor = t.value;
        break;
      case 'quick': {
        const type = t.dataset.type!;
        const id = t.dataset.id as QuickId;
        const list = new Set(s.quick[type] ?? []);
        if (t.checked) list.add(id);
        else list.delete(id);
        // Behåll katalogens ordning.
        s.quick[type] = QUICK_ACTIONS.map((a) => a.id).filter((a) => list.has(a));
        break;
      }
      default:
        return;
    }
    this.commit();
    if (t.dataset.setting?.endsWith('-theme')) this.render();
  }

  private commit(): void {
    saveUiSettings(this.settings);
    applyUiColors(this.settings);
    this.onChange(this.settings);
  }

  private render(): void {
    const s = this.settings;
    const color = (key: 'sel' | 'ref', label: string, value: string | null) => `
      <div class="set-color">
        <span>${label}</span>
        <label class="check"><input type="checkbox" data-setting="${key}-theme"${value ? '' : ' checked'}> Temats färg</label>
        <input type="color" data-setting="${key}" value="${value ?? themeColor(`--${key}`)}"${value ? '' : ' disabled'} aria-label="${label}">
      </div>`;

    const quickRows = QUICK_TYPES.map(({ type, label }) => {
      const chosen = new Set(s.quick[type] ?? []);
      const boxes = QUICK_ACTIONS.filter((a) => a.types === 'all' || a.types.includes(type))
        .map(
          (a) =>
            `<label class="check"><input type="checkbox" data-setting="quick" data-type="${type}" data-id="${a.id}"${chosen.has(a.id) ? ' checked' : ''}> ${escapeHtml(a.label)}</label>`,
        )
        .join('');
      return `<div class="quick-row"><b>${label}</b><div>${boxes}</div></div>`;
    }).join('');

    const keys = SHORTCUTS.map(([k, what]) => `<tr><td><kbd>${escapeHtml(k)}</kbd></td><td>${escapeHtml(what)}</td></tr>`).join('');

    this.el.innerHTML = `<div class="dialog settings" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <header><h2 id="settings-title">Gränssnitt</h2><div class="spacer"></div>
        <button class="icon-mini" data-action="close-settings" aria-label="Stäng">×</button></header>
      <div class="dialog-body">
        <section>
          <h3>Planen</h3>
          <label class="check"><input type="checkbox" data-setting="grid"${s.grid ? ' checked' : ''}> Visa rutnät <span class="muted">(G)</span></label>
          <label class="check"><input type="checkbox" data-setting="pet"${s.petPalette ? ' checked' : ''}> Snabbmeny vid markören när något markeras med musen</label>
          <label class="check"><input type="checkbox" data-setting="autodims"${s.autoDims ? ' checked' : ''}> Måttsätt nya väggar och öppningar automatiskt när man jämför med befintligt</label>
        </section>
        <section>
          <h3>Färger</h3>
          ${color('sel', 'Markering', s.selColor)}
          ${color('ref', 'Referenslinjer och grepp', s.refColor)}
        </section>
        <section>
          <h3>Snabbknappar</h3>
          <p class="note">Knapparna i snabbmenyn vid markören och överst i panelen. Avmarkera finns alltid.</p>
          ${quickRows}
        </section>
        <section>
          <h3>Kortkommandon</h3>
          <table class="keys">${keys}</table>
          <p class="note">Egna kortkommandon kommer senare. På Mac används Cmd i stället för Ctrl.</p>
        </section>
      </div>
      <footer><button class="btn" data-action="reset-settings">Återställ</button><div class="spacer"></div>
        <button class="btn btn-primary" data-action="close-settings">Klar</button></footer>
    </div>`;
  }
}

/** Temats färg för en variabel, som hex för färgväljaren. */
function themeColor(name: string): string {
  const style = document.documentElement.style;
  const own = style.getPropertyValue(name);
  if (own) style.removeProperty(name);
  const probe = document.createElement('span');
  probe.style.color = `var(${name})`;
  document.body.appendChild(probe);
  const rgb = getComputedStyle(probe).color;
  probe.remove();
  if (own) style.setProperty(name, own);
  const m = rgb.match(/\d+(\.\d+)?/g);
  if (!m || m.length < 3) return '#1f4fa3';
  return `#${m
    .slice(0, 3)
    .map((v) => Math.round(Number(v)).toString(16).padStart(2, '0'))
    .join('')}`;
}
