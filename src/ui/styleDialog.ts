import { setGraphics } from '../core/commands';
import { normalizeStyle, PRESETS, withProjectParts, type StyleSheet } from '../core/graphics';
import type { DocStore } from '../core/store';
import { escapeHtml } from './labels';
import { actionRows, applyActionField } from './style/actions';
import { applyLabelField, labelSection } from './style/labels';
import { addLineType, applyLineTypeField, lineTypeSection, removeLineType } from './style/lineTypes';
import { addFamily, addFillType, applyFillTypeField, fillTypeSection, importPat, removeFamily, removeFillType } from './style/fillTypes';
import { FILL_TYPES } from '../core/fillTypes';
import { formatPat } from '../core/patFile';
import { saveBlobFile } from '../storage/projectFile';
import { applyPenField, penSection, resetPen } from './style/pens';
import { resolveParams } from '../elements/registry';
import { materialFieldChange, materialSection } from './style/materials';
import { addMaterial, deleteMaterial, materialUses, moveMaterial, updateMaterial } from '../core/materials';

/**
 * Stilmallen: hur väggar och linjer ritas för varje åtgärd. Ändringar syns
 * direkt och kan ångras. Stilmallen kan sparas som fil och öppnas i andra projekt.
 *
 * Delarna ligger i `src/ui/style/` (0.8.27), en fil per del med dess HTML och
 * det dess fält ändrar: åtgärderna, texterna och litteran, pennorna och
 * (0.8.30) linjetyperna och (0.8.36) fyllningstyperna.
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

  /**
   * Dialogen i tre kolumner, en per sorts inställning (granskningen efter
   * 0.10.18): åtgärderna och texterna, pennorna, och materialen
   * (0.10.28.1), linjetyperna och fyllningstyperna. På en bred skärm har varje kolumn sin egen
   * rullning; på en smal ligger de under varandra. Rullningen och fältet
   * med fokus är kvar när dialogen ritas om efter en ändring (förut
   * hoppade den till början).
   */
  private render(): void {
    const style = this.store.doc.graphics;
    // Snabbguiden (0.8.37) är kvar utfälld när dialogen ritas om efter en ändring.
    const guideOpen = this.el.querySelector<HTMLDetailsElement>('.filltype-guide')?.open ?? false;
    const scrolled = [...this.el.querySelectorAll<HTMLElement>('.dialog-body, .style-col')].map((e) => e.scrollTop);
    const focus = focusSelector(document.activeElement, this.el);
    const presetOptions = PRESETS.map((p, i) => `<option value="${i}"${p.name === style.name ? ' selected' : ''}>${escapeHtml(p.name)}</option>`).join('');
    const custom = PRESETS.some((p) => p.name === style.name) ? '' : `<option selected disabled>${escapeHtml(style.name)}</option>`;
    this.el.innerHTML = `<div class="dialog style-dialog" role="dialog" aria-modal="true" aria-labelledby="style-title">
      <header><h2 id="style-title">Stilmall</h2><button class="icon-btn" data-action="close" aria-label="Stäng">×</button></header>
      <div class="dialog-body style-body">
        <div class="style-top">
          <label class="field inline"><span>Utgå från</span><select id="style-preset">${custom}${presetOptions}</select></label>
          <p class="note">Svart visas ljust på mörk skärm och vitt följer bakgrunden. På papper blir de svart och vitt.</p>
        </div>
        <div class="style-cols">
          <div class="style-col" role="group" aria-label="Åtgärder och texter">
            <section class="style-labels style-actions">
              <h3>Åtgärder</h3>
              <p class="note">Hur väggarnas snitt och linjerna ritas för det som finns kvar, rivs och planeras.</p>
              ${actionRows(style)}
            </section>
            ${labelSection(style)}
          </div>
          <div class="style-col" role="group" aria-label="Pennor">${penSection(style)}</div>
          <div class="style-col" role="group" aria-label="Material, linjetyper och fyllningstyper">
            ${materialSection(style, this.materialUses())}
            ${lineTypeSection(style, this.lineTypeUses())}
            ${fillTypeSection(style, this.fillTypeUses())}
          </div>
        </div>
      </div>
      <footer>
        <button class="btn" data-action="open-style">Öppna stilmall…</button>
        <button class="btn" data-action="save-style">Spara stilmall som fil…</button>
        <button class="btn btn-primary" data-action="close">Klar</button>
      </footer>
    </div>`;
    if (guideOpen) this.el.querySelector<HTMLDetailsElement>('.filltype-guide')!.open = true;
    this.el.querySelectorAll<HTMLElement>('.dialog-body, .style-col').forEach((e, i) => (e.scrollTop = scrolled[i] ?? 0));
    if (focus) this.el.querySelector<HTMLElement>(focus)?.focus({ preventScroll: true });
  }

  /** Hur många former och pennor som har varje linjetyp (0.8.30). */
  private lineTypeUses(): Map<string, number> {
    const doc = this.store.doc;
    const uses = new Map<string, number>();
    const add = (k: unknown) => typeof k === 'string' && uses.set(k, (uses.get(k) ?? 0) + 1);
    for (const el of Object.values(doc.elements)) if (el.type === 'Shape2D') add(resolveParams<{ linetype?: string }>(doc, el).linetype);
    for (const pen of Object.values(doc.graphics.pens ?? {})) add(pen.linetype);
    return uses;
  }

  /** Hur många objekt och slänter som har varje material (0.10.28.1). */
  private materialUses(): Map<string, number> {
    const doc = this.store.doc;
    return new Map((doc.graphics.materials ?? []).map((m) => [m.id, materialUses(doc, m.id)]));
  }

  /** Hur många former, rum och snittfyllningar som har varje fyllningstyp (0.8.36). */
  private fillTypeUses(): Map<string, number> {
    const doc = this.store.doc;
    const uses = new Map<string, number>();
    const add = (k: unknown) => typeof k === 'string' && uses.set(k, (uses.get(k) ?? 0) + 1);
    for (const el of Object.values(doc.elements)) {
      if (el.type !== 'Shape2D' && el.type !== 'Space') continue;
      const p = resolveParams<{ fill?: string; fillType?: string }>(doc, el);
      if (p.fill === 'type') add(p.fillType);
    }
    for (const a of Object.values(doc.graphics.actions)) if (a.cutFill.kind === 'type') add(a.cutFill.type);
    return uses;
  }

  private onClick(e: Event): void {
    const action = (e.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;
    if (action === 'close') this.close();
    // Materialen (0.10.28.1).
    if (action?.startsWith('material-')) {
      const id = (e.target as HTMLElement).closest<HTMLElement>('[data-material-id]')?.dataset.materialId ?? '';
      if (action === 'material-add') {
        const nid = addMaterial(this.store);
        this.el.querySelector<HTMLInputElement>(`[data-material="${CSS.escape(nid)}:name"]`)?.select();
      } else if (action === 'material-up' || action === 'material-down') moveMaterial(this.store, id, action === 'material-up' ? -1 : 1);
      else if (action === 'material-remove') deleteMaterial(this.store, id);
      return;
    }
    if (action === 'linetype-add' || action === 'linetype-remove') {
      const style: StyleSheet = structuredClone(this.store.doc.graphics);
      const id = (e.target as HTMLElement).closest<HTMLElement>('[data-linetype-id]')?.dataset.linetypeId;
      if (action === 'linetype-add') addLineType(style);
      else if (!id || !removeLineType(style, id)) return;
      style.name = 'Egen stilmall';
      setGraphics(this.store, style, action === 'linetype-add' ? 'Ny linjetyp' : 'Ta bort linjetyp');
    }
    // Fyllningstyperna (0.8.36).
    if (action?.startsWith('filltype-') && action !== 'filltype-import' && action !== 'filltype-export') {
      const at = (e.target as HTMLElement).closest<HTMLElement>('[data-filltype-id]');
      const id = at?.dataset.filltypeId ?? '';
      const style: StyleSheet = structuredClone(this.store.doc.graphics);
      const label =
        action === 'filltype-add'
          ? (addFillType(style), 'Ny fyllningstyp')
          : action === 'filltype-copy' && FILL_TYPES[id]
            ? (addFillType(style, { ...FILL_TYPES[id], name: `${FILL_TYPES[id].name} (kopia)` }), 'Kopiera fyllningstyp')
          : action === 'filltype-remove' && removeFillType(style, id)
            ? 'Ta bort fyllningstyp'
            : action === 'filltype-family-add' && addFamily(style, id)
              ? 'Ny linjefamilj'
              : action === 'filltype-family-remove' && removeFamily(style, id, Number(at?.dataset.family))
                ? 'Ta bort linjefamilj'
                : null;
      if (!label) return;
      style.name = 'Egen stilmall';
      setGraphics(this.store, style, label);
    }
    if (action === 'filltype-import') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.pat,text/plain';
      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file) return;
        const style: StyleSheet = structuredClone(this.store.doc.graphics);
        const { added, replaced } = importPat(style, await file.text());
        if (!added && !replaced) {
          this.onError('Filen har inga fyllningstyper som går att läsa.');
          return;
        }
        style.name = 'Egen stilmall';
        setGraphics(this.store, style, added + replaced === 1 ? 'Läs in fyllningstyp' : 'Läs in fyllningstyper');
      });
      input.click();
    }
    if (action === 'filltype-export') {
      const types = this.store.doc.graphics.fillTypes ?? [];
      if (!types.length) return;
      void saveBlobFile(new Blob([formatPat(types)], { type: 'text/plain' }), 'fyllningar.pat', 'Fyllningstyper', { 'text/plain': ['.pat'] });
    }
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
          // Projektets egna linjetyper som filen saknar är kvar (0.8.30), så att formerna ritas som förut.
          const read = normalizeStyle(JSON.parse(await file.text()));
          const keep = (this.store.doc.graphics.lineTypes ?? []).filter((t) => !read.lineTypes?.some((r) => r.id === t.id));
          if (keep.length) read.lineTypes = [...(read.lineTypes ?? []), ...keep];
          // Och fyllningstyperna (0.8.36).
          const keepFills = (this.store.doc.graphics.fillTypes ?? []).filter((t) => !read.fillTypes?.some((r) => r.id === t.id));
          if (keepFills.length) read.fillTypes = [...(read.fillTypes ?? []), ...keepFills];
          setGraphics(this.store, read);
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
      // Projektets egna linjetyper är kvar (0.8.30): formerna och pennorna använder dem.
      // Materialen (0.10.28) likaså, med texterna som förut ersattes.
      const g = this.store.doc.graphics;
      setGraphics(this.store, structuredClone({ ...withProjectParts(PRESETS[Number(input.value)], g), labels: PRESETS[Number(input.value)].labels }));
      return;
    }
    // Ett material (0.10.28.1) ändras med objekten som har det.
    const mat = materialFieldChange(this.store.doc.graphics, input);
    if (mat) {
      updateMaterial(this.store, mat.id, mat.label, mat.fn);
      return;
    }
    if (input.dataset.material) return;
    const style: StyleSheet = structuredClone(this.store.doc.graphics);
    // Varje del av stilmallen svarar för sina egna fält.
    const label = applyPenField(style, input) ?? applyLineTypeField(style, input) ?? applyFillTypeField(style, input) ?? applyLabelField(style, input) ?? applyActionField(style, input);
    // Ett mönster som inte gick att läsa: visa det gamla igen.
    if (label === '') this.render();
    if (!label) return;
    style.name = 'Egen stilmall';
    setGraphics(this.store, style, label);
  }
}

/** Fältets data-attribut och värde, så att samma fält hittas efter omritningen; null utanför dialogen. */
function focusSelector(el: Element | null, root: HTMLElement): string | null {
  if (!(el instanceof HTMLElement) || !root.contains(el)) return null;
  if (el.id) return `#${CSS.escape(el.id)}`;
  const attrs = ['data-key', 'data-field', 'data-lab', 'data-pen', 'data-linetype', 'data-filltype', 'data-material', 'data-material-id', 'data-action', 'data-pen-key', 'data-filltype-id', 'data-linetype-id', 'data-family'];
  const parts = attrs.filter((a) => el.hasAttribute(a)).map((a) => `[${a}="${CSS.escape(el.getAttribute(a)!)}"]`);
  if (!parts.length) return null;
  const v = el instanceof HTMLInputElement && el.type === 'radio' ? `[value="${CSS.escape(el.value)}"]` : '';
  return el.tagName.toLowerCase() + parts.join('') + v;
}
