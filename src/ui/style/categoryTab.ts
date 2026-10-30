import type { ProjectDoc, ViewDef } from '../../core/model';
import { SITE_CATEGORIES, SITE_STOREY } from '../../core/model';
import type { StyleBook } from '../../core/graphics';
import { DETAIL_LABELS, DETAIL_LEVELS } from '../../core/states';
import { categoriesOf, deviationCount, sheetFor, stylePresets, viewsWithCategory, VIEW_TYPES, type ViewCategory, type ViewType } from '../../core/viewCategories';
import { hostFor, underlayAddSelect, underlayRowsMarkup } from '../underlayRows';
import { isShown, OFF_BY_DEFAULT, showGroupsFor } from '../app/showKeys';
import { penKey, penTable, stylePlaces } from '../../repr/penPlaces';
import { escapeHtml } from '../labels';
import { icons } from '../icons';
import { actionRows } from './actions';
import { penSection } from './pens';
import { contentIcon, RARE_CONTENT } from './contentIcons';

/**
 * Det som ändras i stilboken (0.10.33): kategorin, med förvalet som nivån
 * ovanför, eller vyn, med kategorin ovanför. `cur` är det som visas.
 */
export interface StyleScope {
  cat: ViewCategory;
  ref: ViewCategory;
  cur: ViewCategory;
  view?: ViewDef;
}

/**
 * En vytyp i stilboken (0.10.32): kategorierna som flikar, verktygen för
 * den valda och dess inställningar (visningen, innehållet, underlagen,
 * åtgärderna och pennorna); eller en vys stil med dess verktyg (0.10.33).
 * Bara HTML; klicken och fälten tas om hand i `styleDialog.ts` och
 * `categoryEdits.ts`.
 */
export function categoryTabMarkup(doc: ProjectDoc, type: ViewType, s: StyleScope, onlyChanged: boolean): string {
  const book = doc.graphics;
  const cats = categoriesOf(book, type);
  const c = s.cat;
  const only = `<label class="check sb-only"><input type="checkbox" data-sb-only${onlyChanged ? ' checked' : ''}> Visa bara avvikelser</label>`;
  const sheet = sheetFor(book, c, s.view?.overrides);
  const body = `<p class="note sb-none" hidden>Inga avvikelser: allt är som ${s.view ? `kategorin ${escapeHtml(c.name)}` : 'förvalet'}.</p>
      ${showMarkup(s.cur, !!s.view)}
      ${contentMarkup(doc, s.cur)}
      ${underlayMarkup(doc, s.cur, s.view)}
      <section class="style-labels style-actions">
        <h3>Åtgärder</h3>
        <p class="note">Hur väggarnas snitt och linjerna ritas för det som finns kvar, rivs och planeras.</p>
        ${actionRows(sheet)}
      </section>
      ${penSection(sheet, type, penNumbers(doc))}`;
  if (s.view) {
    const n = deviationCount(doc, s.view);
    return `<div class="sb-viewhead">
          <button class="btn btn-ghost sb-back" data-action="sb-back" title="Tillbaka till kategorin">${icons.chevron}<span>${escapeHtml(c.name)}</span></button>
          <div class="sb-viewname"><b>Stil för vyn ${escapeHtml(s.view.name)}</b><span>Följer kategorin ${escapeHtml(c.name)}${n ? ` · avviker på ${n} ${n === 1 ? 'rad' : 'rader'}` : ' utan avvikelser'}. Det som ändras här gäller bara vyn.</span></div>
        </div>
        <div class="sb-toolbar">
          <button class="btn" data-action="view-reset"${n ? '' : ' disabled'} title="Ta bort vyns avvikelser, så att den följer kategorin helt">Återställ till kategorin</button>
          <button class="btn" data-action="view-default"${n ? '' : ' disabled'} title="Kategorin får det vyn ser ut med; vyn följer den utan avvikelser">Gör avvikelserna till kategorins förval</button>
          <button class="btn" data-action="view-newcat" title="En ny kategori med det vyn ser ut med; vyn följer den">Spara som ny kategori…</button>
          ${only}
        </div>
        ${body}`;
  }
  const views = viewsWithCategory(doc, c);
  const uses = views.length;
  const changed = views.filter((v) => deviationCount(doc, v) > 0).length;
  const tool = (action: string, icon: string, title: string, disabled = false) => `<button class="icon-btn sb-tool" data-action="${action}" title="${title}" aria-label="${title}"${disabled ? ' disabled' : ''}>${icon}</button>`;
  const viewList = uses
    ? `<details class="sb-views"><summary>Vyer med den här kategorin (${uses})</summary><ul>${views
        .map((v) => {
          const n = deviationCount(doc, v);
          return `<li><button class="sb-view-link" data-sb-view="${escapeHtml(v.id)}" title="Visa vyns stil och dess avvikelser">${escapeHtml(v.name)}</button>${n ? `<span class="sb-dev" title="Avviker från kategorin på ${n} ${n === 1 ? 'rad' : 'rader'}"><i class="sb-dot" aria-hidden="true"></i>${n}</span>` : ''}<button class="btn btn-ghost" data-sb-goview="${escapeHtml(v.id)}">Gå dit</button></li>`;
        })
        .join('')}</ul></details>`
    : '';
  return `<div class="sb-tabs" role="tablist" aria-label="Kategorier">
        ${cats.map((x) => `<button role="tab" class="sb-tab" data-sb-cat="${escapeHtml(x.id)}" aria-selected="${x === c}">${escapeHtml(x.name)}</button>`).join('')}
        <button class="sb-tab sb-tab-add" data-action="cat-new" title="Ny kategori">${icons.plus}<span>Ny kategori</span></button>
      </div>
      <div class="sb-toolbar">
        ${tool('cat-duplicate', icons.copy, 'Duplicera')}
        ${tool('cat-rename', icons.text, 'Byt namn')}
        <select class="sb-copy" data-sb-copy aria-label="Kopiera från">${copyOptions(book, type, c)}</select>
        ${tool('cat-reset', icons.restore, 'Återställ till förvalet')}
        ${tool('cat-left', icons.chevron, 'Flytta åt vänster', cats[0] === c)}
        ${tool('cat-right', icons.chevron, 'Flytta åt höger', cats[cats.length - 1] === c)}
        ${tool('cat-delete', icons.trash, 'Ta bort', cats.length < 2)}
        <span class="sb-uses">Används av ${uses} ${uses === 1 ? 'vy' : 'vyer'}${changed ? ` · ${changed} med avvikelser` : ''}</span>
        ${only}
      </div>
      ${viewList}
      ${body}`;
}

/** *Kopiera från…*: de andra kategorierna i vytypen, de i andra vytyper (bara stilen) och förinställningarna. */
function copyOptions(book: StyleBook, type: ViewType, c: ViewCategory): string {
  const others = book.categories.filter((x) => x !== c);
  const opt = (x: ViewCategory, name: string) => `<option value="cat:${escapeHtml(x.type)}:${escapeHtml(x.id)}">${escapeHtml(name)}</option>`;
  return (
    `<option value="">Kopiera från…</option>` +
    (others.some((x) => x.type === type) ? `<optgroup label="Den här vytypen">${others.filter((x) => x.type === type).map((x) => opt(x, x.name)).join('')}</optgroup>` : '') +
    `<optgroup label="Andra vytyper (bara stilen)">${others.filter((x) => x.type !== type).map((x) => opt(x, `${VIEW_TYPES.find((t) => t.type === x.type)?.name ?? ''} › ${x.name}`)).join('')}</optgroup>` +
    `<optgroup label="Förinställningar (bara stilen)">${stylePresets().map((p) => `<option value="preset:${p.id}">${escapeHtml(p.name)}</option>`).join('')}</optgroup>`
  );
}

/** Visningen: detaljnivåerna, jämförelsen, skalan och (Platsen) hur materialen ritas. */
function showMarkup(c: ViewCategory, inView: boolean): string {
  const s = c.show;
  const level = (k: 'detail' | 'labelDetail' | 'modelDetail', label: string) =>
    `<label class="field"><span>${label}</span><select data-cat-show="${k}">${DETAIL_LEVELS.map((l) => `<option value="${l}"${s[k] === l ? ' selected' : ''}>${DETAIL_LABELS[l]}</option>`).join('')}</select></label>`;
  return `<section class="style-labels sb-show"><h3>Visning</h3>
      <div class="fields">
        ${level('labelDetail', 'Littera')}${level('detail', '2D-symboler')}${level('modelDetail', '3D och fasader')}
        ${inView ? '' : `<label class="field"><span>Skala för nya vyer</span><span class="input-unit scale-unit"><i>1:</i><input type="text" inputmode="numeric" data-cat-scale value="${c.scale}"></span></label>`}
        ${c.type === 'site' && !inView ? `<label class="field"><span>Materialen ritas som</span><select data-cat-kind>${SITE_CATEGORIES.map((k) => `<option value="${k.id}"${(c.kind ?? 'situation') === k.id ? ' selected' : ''}>${k.name}</option>`).join('')}</select></label>` : ''}
      </div>
      <label class="check"><input type="checkbox" data-cat-show="compare"${s.compare ? ' checked' : ''}> Jämför med befintligt</label>
      <p class="note">${inView ? 'Vyns skala ändras i vyn. Det som sparas under Visa i vyn hamnar också här.' : 'Vyerna med kategorin följer den. Det en vy ändrar under Visa och sparar, eller här under <i>Stil för den här vyn…</i>, gäller bara den vyn.'}</p>
    </section>`;
}

/** Innehållet: samma kryss som under Visa i vyn. */
function contentMarkup(doc: ProjectDoc, c: ViewCategory): string {
  const groups = showGroupsFor(doc).filter((g) => g.id !== 'site' || c.type === 'site' || !!doc.site);
  return `<section class="style-labels sb-content"><h3>Innehåll</h3>
      <div class="sb-groups">${groups
        .map(
          (g) => `<fieldset><legend>${escapeHtml(g.label)}</legend>${g.items
            .map(
              ([k, label]) =>
                `<label class="check sb-tog${OFF_BY_DEFAULT.has(k) ? ' off-default' : ''}${RARE_CONTENT.has(k) ? ' sb-rare' : ''}"><input type="checkbox" data-cat-hide="${escapeHtml(k)}"${isShown(c.show, k) ? ' checked' : ''}>${contentIcon(k, g.id)}<span>${escapeHtml(label)}</span></label>`,
            )
            .join('')}</fieldset>`,
        )
        .join('')}</div>
    </section>`;
}

/**
 * Underlagen i vyn (0.10.35): samma rader som under Visa. En kategori har
 * ingen våning, så *Våningen under* gäller där vyn står.
 */
function underlayMarkup(doc: ProjectDoc, c: ViewCategory, view?: ViewDef): string {
  const list = c.show.underlays ?? [];
  const host = view ? hostFor(view.storey, { ...view, viewId: view.id }) : { storey: c.type === 'site' ? SITE_STOREY : '', plan: c.type === 'storey' || c.type === 'site' };
  return `<section class="style-labels sb-underlays"><h3>Underlag i vyn</h3>
      <div class="style-row sb-ul-head" data-cat-underlays><span class="style-name">Underlagen, nedifrån och upp</span></div>
      ${underlayRowsMarkup(doc, list, view ? host : null, underlayAddSelect(doc, host, list))}
      <p class="note">Ritas tonade under eller över vyn och följer med till bladet: en våning, Platsen, ortofotot, ett arbetsblad eller en annan vy. Kalkera i projektträdet lägger ett underlag där du är.</p>
    </section>`;
}

/** Pennans nummer för en tjocklek och färg (0.10.36), för numret framför pennraderna. */
function penNumbers(doc: ProjectDoc): (weight: number, color: string | undefined) => number | undefined {
  const no = new Map(penTable(doc.graphics, stylePlaces(doc)).map((r) => [penKey(r.pen), r.pen.no]));
  return (weight, color) => no.get(penKey({ weight, color }));
}
