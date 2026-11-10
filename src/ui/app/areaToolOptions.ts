import { setGraphics } from '../../core/commands';
import { defaultCategories } from '../../core/viewCategories';
import { AREA_KINDS, AREA_NAMES, type AreaKind } from '../../elements/areaCalc';
import { escapeHtml } from '../labels';
import type { AppContext } from './context';
import { isShown, setShown } from './showKeys';

/**
 * Areaverktygets rad (0.12.3): areaslaget, funktionen, och knapparna som
 * tänder areorna i vyn eller lägger in kategorin Areaplan i en äldre stilbok.
 */
export function areaOptionsMarkup(app: AppContext): string {
  const t = app.areaTool;
  const kinds = AREA_KINDS.map((k) => `<option value="${k}"${t.kind === k ? ' selected' : ''}>${k} – ${AREA_NAMES[k]}</option>`).join('');
  const shown = isShown(app.ui, 'Area');
  const hasCategory = app.store.doc.graphics.categories.some((c) => c.id === 'areaplan' && c.type === 'storey');
  const computed = t.kind === 'BTA' || t.kind === 'BYA';
  return `
    <label class="opt"><span>Areaslag</span><select id="area-kind" aria-label="Areaslag">${kinds}</select></label>
    ${computed ? '' : `<label class="opt"><span>Funktion</span><input id="area-func" value="${escapeHtml(t.func)}" placeholder="t.ex. Kontor" style="width:110px" list="area-funcs"><datalist id="area-funcs">${funcOptions(app)}</datalist></label>`}
    ${shown ? '' : '<button class="btn" data-action="area-show" title="Areorna är släckta i vyn; tänd dem under Visa › Areor">Visa areorna här</button>'}
    ${hasCategory ? '' : '<button class="btn" data-action="area-category" title="Stilboken saknar kategorin Areaplan (den kom i 0.12.3)">Lägg in Areaplan</button>'}
    <span class="opt-hint">${computed ? `${t.kind} räknas fram ur modellen; ett klick på våningen visar konturen.` : t.kind === 'OPA' ? 'Klicka under ett tak: takets kontur blir en start som ändras i Modifiera.' : 'Klicka i ett rum. Shift+klick lägger till eller tar bort rum i den markerade arean.'}</span>`;
}

function funcOptions(app: AppContext): string {
  const list = app.store.doc.graphics.general?.areas?.functions ?? [{ name: 'Handel' }, { name: 'Kontor' }];
  return list.map((f) => `<option value="${escapeHtml(f.name)}">`).join('');
}

/** Ett ändrat fält i raden. Svarar sant om det var ett av areaverktygets. */
export function areaOptionChange(app: AppContext, t: HTMLInputElement | HTMLSelectElement): boolean {
  if (t.id === 'area-kind') {
    app.areaTool.kind = t.value as AreaKind;
    app.toolOpts.renderToolOptions();
    return true;
  }
  if (t.id === 'area-func') {
    app.areaTool.func = t.value;
    return true;
  }
  return false;
}

/** En knapp i raden. Svarar sant om det var en av areaverktygets. */
export function areaOptionClick(app: AppContext, b: HTMLElement): boolean {
  if (b.dataset.action === 'area-show') {
    setShown(app.ui, 'Area', true);
    app.renderAll();
    app.toolOpts.renderToolOptions();
    return true;
  }
  if (b.dataset.action === 'area-category') {
    const book = app.store.doc.graphics;
    const cat = defaultCategories().find((c) => c.id === 'areaplan')!;
    const at = book.categories.findIndex((c) => c.id === 'golv');
    const categories = [...book.categories];
    categories.splice(at < 0 ? categories.length : at + 1, 0, cat);
    setGraphics(app.store, { ...book, categories }, 'Lägg in kategorin Areaplan');
    app.hint('Areaplan finns nu bland våningarnas kategorier: Ny vy… › Areaplan, eller byt kategori i vyns egenskaper.', 5000);
    app.toolOpts.renderToolOptions();
    return true;
  }
  return false;
}
