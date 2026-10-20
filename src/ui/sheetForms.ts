import type { Id, ProjectDoc, Sheet } from '../core/model';
import { deleteSheet, duplicateSheet, PAPER_SIZES, PROJECT_FIELDS, removeFromSheet, removeViewport, saveProjectFields, saveSheet, setLogo, setViewportCrop, SHEET_FIELDS, SHEET_TEXT_HEIGHTS, sheetOfItem, sheetOfViewport, TITLE_BLOCK_TEMPLATES, updateSheetText, updateViewport } from '../core/sheets';
import type { DocStore } from '../core/store';
import { centeredAt, placeableViews, viewCenter, viewSource } from '../repr/sheet';
import { SMART_TEXT } from '../repr/titleBlock';
import { ANNOTATION_SCALES } from './app/helpers';
import { askConfirm } from './ask';
import { icons } from './icons';
import { escapeHtml } from './labels';

/**
 * Inställningarna för ett ritningsblad, en vy på ett blad (0.8 del 3) och ett
 * ritningshuvud (0.8.6) och en text på bladet (0.8.7), i egenskapspanelen som det andra i projektträdet:
 * inget ändras förrän man sparar. Att lägga en vy eller ett huvud på bladet,
 * ta bort det och byta logga görs direkt.
 *
 * Huvudets fält visas i huvudets egenskaper: det som hör till ritningen
 * (nummer, innehåll, datum, skala …) sparas på bladet och det som gäller alla
 * ritningar i projektet.
 */

const esc = escapeHtml;
const field = (label: string, input: string) => `<label class="field"><span>${label}</span>${input}</label>`;

/** Det som har ett formulär här: bladet och sakerna på det. */
export type SheetFormKind = 'sheet' | 'viewport' | 'titleBlock' | 'sheetText';

export interface SheetFormHost {
  /** Visa något annat i panelen: bladet, en vy, ett ritningshuvud eller en text på det. */
  pick(item: { kind: SheetFormKind; id: Id }): void;
  /** Börja skriva text på bladet (textverktyget). */
  startText(): void;
  /** Lägg en vy på bladet, mitt på den lediga ytan. */
  place(sheetId: Id, view: Id, scale: number): void;
  /** Lägg ett ritningshuvud på bladet, i ramens hörn. */
  placeTitleBlock(sheetId: Id): void;
  /** Om nya blad får ett ritningshuvud (minns det senaste valet). */
  newSheetTitleBlock(): boolean;
  setNewSheetTitleBlock(on: boolean): void;
  /** Öppna vyn som en vy på bladet visar. */
  openView(view: Id): void;
  /** Välj en bild som logga i ritningshuvudet. */
  chooseLogo(): void;
  /** Efter Spara. */
  saved(): void;
  /** Bladet togs bort. */
  closed(): void;
  /** Rita om formuläret (Återställ). */
  rerender(): void;
}

function folderOptions(doc: ProjectDoc, current: Id | null): string {
  const list = doc.folders.filter((f) => f.tab === 'ritningar');
  const out: string[] = [`<option value=""${current ? '' : ' selected'}>Ingen mapp</option>`];
  const walk = (parent: Id | null, depth: number) => {
    for (const f of list.filter((x) => x.parent === parent).sort((a, b) => a.name.localeCompare(b.name, 'sv', { numeric: true }))) {
      out.push(`<option value="${f.id}"${f.id === current ? ' selected' : ''}>${' '.repeat(depth)}${esc(f.name)}</option>`);
      walk(f.id, depth + 1);
    }
  };
  walk(null, 0);
  return out.join('');
}

function scaleOptions(current: number): string {
  const list = ANNOTATION_SCALES.includes(current) ? ANNOTATION_SCALES : [...ANNOTATION_SCALES, current].sort((a, b) => a - b);
  return list.map((n) => `<option value="${n}"${n === current ? ' selected' : ''}>1:${n}</option>`).join('');
}

const ORIENTATION = { landscape: 'Liggande', portrait: 'Stående' } as const;

/** En kort beskrivning av bladet: format och antal vyer. */
export function describeSheet(s: Sheet): string {
  const n = s.viewports.length;
  return `${s.size} ${ORIENTATION[s.orientation].toLowerCase()} · ${n} ${n === 1 ? 'vy' : 'vyer'}`;
}

/** Huvudets fält: ritningens och projektets, med loggan och smarttexten. */
function titleBlockFields(doc: ProjectDoc, s: Sheet): string {
  const f = doc.project.fields;
  const smart = SMART_TEXT.map(([k, d]) => `<code title="${esc(d)}">{${esc(k)}}</code>`).join(' ');
  return `<section>
      <h3>Den här ritningen</h3>
      <div class="fields">
        ${field('Ritningsnummer', `<input name="number" value="${esc(s.number)}" autocomplete="off">`)}
        ${field('Innehåll', `<input name="name" value="${esc(s.name)}" autocomplete="off">`)}
        ${SHEET_FIELDS.map((x) => field(x.label, `<input name="f:${x.key}" value="${esc(s.fields[x.key] ?? '')}" placeholder="${esc(x.placeholder ?? '')}" autocomplete="off">`)).join('')}
      </div>
      <p class="note">Skalan fylls i med vyernas skalor om fältet är tomt. Skriv något annat för just den här ritningen.</p>
    </section>
    <section>
      <h3>Alla ritningar i projektet</h3>
      <div class="fields">
        ${field('Projekt', `<input name="projectName" value="${esc(doc.project.name)}" autocomplete="off">`)}
        ${PROJECT_FIELDS.map((x) => field(x.label, `<input name="p:${x.key}" value="${esc(f[x.key] ?? '')}" autocomplete="off">`)).join('')}
      </div>
      <div class="row logo-row">
        <span class="note">${f.logo && doc.assets[f.logo] ? `Logga: ${esc(doc.assets[f.logo].name)}` : 'Ingen logga'}</span>
        <button type="button" class="btn" data-sheet="logo">${f.logo ? 'Byt logga…' : 'Välj logga…'}</button>
        ${f.logo ? '<button type="button" class="btn" data-sheet="logo-remove">Ta bort</button>' : ''}
      </div>
      <p class="note smart-note">Fälten kan innehålla smarttext som fylls i av sig själv: ${smart}</p>
    </section>`;
}

/** Texthöjderna att välja, med den nuvarande om den inte finns i listan. */
function heightOptions(current: number): string {
  const list = SHEET_TEXT_HEIGHTS.includes(current) ? SHEET_TEXT_HEIGHTS : [...SHEET_TEXT_HEIGHTS, current].sort((a, b) => a - b);
  return list.map((h) => `<option value="${h}"${h === current ? ' selected' : ''}>${String(h).replace('.', ',')} mm</option>`).join('');
}

export function sheetFormMarkup(doc: ProjectDoc, item: { kind: SheetFormKind; id: Id }, prefs: { newSheetTitleBlock: boolean } = { newSheetTitleBlock: false }): string {
  const actions = (extra = '') =>
    `<div class="tree-save">${extra}<button type="button" class="btn" data-tree="reset" disabled>Återställ</button><button type="submit" class="btn btn-primary" data-tree="save" disabled>Spara</button></div>`;
  if (item.kind === 'sheetText') {
    const sheet = sheetOfItem(doc, item.id);
    const it = sheet?.items.find((i) => i.id === item.id);
    if (!sheet || it?.kind !== 'text') return '';
    const smart = SMART_TEXT.map(([k, d]) => `<code title="${esc(d)}">{${esc(k)}}</code>`).join(' ');
    return `<form class="tree-form sheet-form" data-tree-kind="sheetText" data-tree-id="${it.id}">
      <header class="sel-head"><h2>Text</h2><p>Text på bladet ${esc(sheet.number)} · ${esc(sheet.name)}</p></header>
      <section>
        <div class="fields">
          ${field('Text', `<textarea class="sheet-text-value" name="text" rows="${Math.min(8, Math.max(2, it.text.split('\n').length))}">${esc(it.text)}</textarea>`)}
          ${field('Höjd', `<select name="height">${heightOptions(it.height)}</select>`)}
        </div>
        <label class="check"><input type="checkbox" name="bold"${it.bold ? ' checked' : ''}> Fet stil</label>
        <p class="note">Dubbelklicka på texten på bladet för att skriva direkt i den, och dra den för att flytta den. Höjden är på papperet.</p>
        <p class="note smart-note">Texten kan innehålla smarttext som fylls i av sig själv: ${smart}</p>
        <div class="row"><button type="button" class="btn" data-sheet="back" data-id="${sheet.id}">${icons.sheet}<span>Bladet</span></button></div>
      </section>
      ${actions(`<button type="button" class="btn btn-danger" data-sheet="remove-item">Ta bort texten</button>`)}
    </form>`;
  }
  if (item.kind === 'titleBlock') {
    const sheet = sheetOfItem(doc, item.id);
    if (!sheet) return '';
    return `<form class="tree-form sheet-form" data-tree-kind="titleBlock" data-tree-id="${item.id}">
      <header class="sel-head"><h2>Ritningshuvud</h2><p>BH90 på ${esc(sheet.number)} · ${esc(sheet.name)}</p></header>
      ${titleBlockFields(doc, sheet)}
      <section>
        <p class="note">Dra huvudet på bladet för att flytta det; det fäster mot ramen och vyernas kanter. Huvudet följer med till hörnet om formatet byts.</p>
        <div class="row"><button type="button" class="btn" data-sheet="back" data-id="${sheet.id}">${icons.sheet}<span>Bladet</span></button></div>
      </section>
      ${actions(`<button type="button" class="btn btn-danger" data-sheet="remove-item">Ta bort huvudet</button>`)}
    </form>`;
  }
  if (item.kind === 'viewport') {
    const sheet = sheetOfViewport(doc, item.id);
    const vp = sheet?.viewports.find((v) => v.id === item.id);
    if (!sheet || !vp) return '';
    const src = viewSource(doc, vp.view);
    const options = placeableViews(doc);
    if (!options.some((o) => o.id === vp.view)) options.unshift({ id: vp.view, name: 'Vyn finns inte längre', def: undefined as never });
    return `<form class="tree-form sheet-form" data-tree-kind="viewport" data-tree-id="${vp.id}">
      <header class="sel-head"><h2>${esc(vp.title || src?.name || 'Vy')}</h2><p>Vy på bladet ${esc(sheet.number)}</p></header>
      <section>
        <div class="fields">
          ${field('Vy', `<select name="view">${options.map((o) => `<option value="${esc(o.id)}"${o.id === vp.view ? ' selected' : ''}>${esc(o.name)}${o.id.startsWith('modell:') ? ' (modell)' : ''}</option>`).join('')}</select>`)}
          ${field('Skala', `<select name="scale">${scaleOptions(vp.scale)}</select>`)}
          ${field('Rubrik', `<input name="title" value="${esc(vp.title ?? '')}" placeholder="${esc(src?.name ?? '')}">`)}
        </div>
        <label class="check"><input type="checkbox" name="showScale"${vp.hideScale ? '' : ' checked'}> Skalan i rubriken</label>
        <p class="note">Texter, mått och symboler ritas för vyns skala, så att de får rätt höjd på papperet. Dra vyn på bladet för att flytta den; den fäster mot de andra vyernas kanter och mittlinjer.</p>
        <p class="note">${vp.crop ? 'Ramen är ändrad: det som ligger utanför den syns inte på bladet.' : 'Ramen följer det som är ritat i vyn.'} Dra i greppen i ramens kanter och hörn för att ändra den.</p>
        <div class="row">
          <button type="button" class="btn" data-sheet="reset-crop"${vp.crop ? '' : ' disabled'}>Återställ ramen till innehållet</button>
        </div>
        <div class="row">
          <button type="button" class="btn" data-sheet="open-view">Öppna vyn</button>
          <button type="button" class="btn" data-sheet="back" data-id="${sheet.id}">${icons.sheet}<span>Bladet</span></button>
        </div>
      </section>
      ${actions(`<button type="button" class="btn btn-danger" data-sheet="remove-viewport">Ta bort från bladet</button>`)}
    </form>`;
  }
  const s = doc.sheets.find((x) => x.id === item.id);
  if (!s) return '';
  const views = s.viewports
    .map((vp) => {
      const src = viewSource(doc, vp.view);
      return `<div class="view-row"><button type="button" class="view-apply" data-sheet="pick-viewport" data-id="${vp.id}">${esc(vp.title || src?.name || 'Vyn finns inte längre')}<small>1:${vp.scale}</small></button><button type="button" class="icon-mini view-more" data-sheet="remove-row" data-id="${vp.id}" aria-label="Ta bort från bladet" title="Ta bort från bladet">${icons.close}</button></div>`;
    })
    .join('');
  const placeable = placeableViews(doc);
  const texts = s.items.filter((it) => it.kind === 'text');
  return `<form class="tree-form sheet-form" data-tree-kind="sheet" data-tree-id="${s.id}">
    <header class="sel-head"><h2>${esc(s.number)} · ${esc(s.name)}</h2><p>Ritningsblad · ${esc(describeSheet(s))}</p></header>
    <section>
      <div class="fields">
        ${field('Ritningsnummer', `<input name="number" value="${esc(s.number)}" autocomplete="off">`)}
        ${field('Innehåll', `<input name="name" value="${esc(s.name)}" autocomplete="off">`)}
        ${field('Format', `<select name="size">${PAPER_SIZES.map((p) => `<option${p === s.size ? ' selected' : ''}>${p}</option>`).join('')}</select>`)}
        ${field('Orientering', `<select name="orientation">${(['landscape', 'portrait'] as const).map((o) => `<option value="${o}"${o === s.orientation ? ' selected' : ''}>${ORIENTATION[o]}</option>`).join('')}</select>`)}
        ${field('Mapp', `<select name="folder">${folderOptions(doc, doc.tree[s.id] ?? null)}</select>`)}
      </div>
      <label class="check"><input type="checkbox" name="frame"${s.frame ? ' checked' : ''}> Ritningsram</label>
    </section>
    <section>
      <h3>Vyer på bladet</h3>
      ${views ? `<div class="nav-list">${views}</div>` : '<p class="note">Inga vyer än. Välj en vy och lägg den på bladet.</p>'}
      <div class="fields">
        ${field('Vy', `<select data-sheet-view>${placeable.map((o) => `<option value="${esc(o.id)}" data-scale="${o.def.scale ?? 100}">${esc(o.name)}${o.id.startsWith('modell:') ? ' (modell)' : ''}</option>`).join('')}</select>`)}
        ${field('Skala', `<select data-sheet-scale>${scaleOptions(placeable[0]?.def.scale ?? 100)}</select>`)}
      </div>
      <div class="row"><button type="button" class="btn" data-sheet="place">${icons.plus}<span>Lägg på bladet</span></button></div>
    </section>
    <section>
      <h3>Ritningshuvud</h3>
      ${
        s.items.some((it) => it.kind === 'titleBlock')
          ? `<div class="nav-list">${s.items
              .filter((it) => it.kind === 'titleBlock')
              .map(
                (it) =>
                  `<div class="view-row"><button type="button" class="view-apply" data-sheet="pick-item" data-id="${it.id}">BH90<small>${esc(s.number)} · ${esc(s.name)}</small></button><button type="button" class="icon-mini view-more" data-sheet="remove-item-row" data-id="${it.id}" aria-label="Ta bort huvudet" title="Ta bort huvudet">${icons.close}</button></div>`,
              )
              .join('')}</div><p class="note">Ritningens nummer, innehåll, datum och de andra fälten ändras i huvudets egenskaper.</p>`
          : '<p class="note">Bladet är blankt. Lägg på ett ritningshuvud från listan.</p>'
      }
      <div class="fields">
        ${field('Mall', `<select data-sheet-template>${TITLE_BLOCK_TEMPLATES.map((t) => `<option value="${t.id}" title="${esc(t.note)}">${esc(t.name)}</option>`).join('')}</select>`)}
      </div>
      <div class="row"><button type="button" class="btn" data-sheet="place-title">${icons.plus}<span>Lägg på ritningshuvud</span></button></div>
      <label class="check"><input type="checkbox" data-sheet-pref="new-title"${prefs.newSheetTitleBlock ? ' checked' : ''}> Nya blad får ritningshuvud</label>
    </section>
    <section>
      <h3>Texter</h3>
      ${
        texts.length
          ? `<div class="nav-list">${texts
              .map(
                (it) =>
                  `<div class="view-row"><button type="button" class="view-apply" data-sheet="pick-text" data-id="${it.id}">${esc(it.text.split('\n')[0])}<small>${String(it.height).replace('.', ',')} mm</small></button><button type="button" class="icon-mini view-more" data-sheet="remove-item-row" data-id="${it.id}" aria-label="Ta bort texten" title="Ta bort texten">${icons.close}</button></div>`,
              )
              .join('')}</div>`
          : '<p class="note">Inga texter på bladet än.</p>'
      }
      <div class="row"><button type="button" class="btn" data-sheet="start-text">${icons.text}<span>Skriv text på bladet</span></button></div>
    </section>
    <section>
      <div class="row">
        <button type="button" class="btn" data-sheet="duplicate">Duplicera bladet</button>
      </div>
    </section>
    ${actions(`<button type="button" class="btn btn-danger" data-sheet="delete">Ta bort…</button>`)}
  </form>`;
}

/** Koppla formulärets knappar och Spara. */
export function bindSheetForm(root: HTMLElement, store: DocStore, host: SheetFormHost): void {
  const form = root.querySelector<HTMLFormElement>('.sheet-form');
  if (!form) return;
  const kind = form.dataset.treeKind as SheetFormKind;
  const id = form.dataset.treeId!;
  const dirty = () => form.querySelectorAll<HTMLButtonElement>('[data-tree="save"], [data-tree="reset"]').forEach((b) => (b.disabled = false));
  const own = '[data-sheet-view], [data-sheet-scale], [data-sheet-template], [data-sheet-pref]';
  form.addEventListener('input', (e) => {
    if (!(e.target as HTMLElement).matches(own)) dirty();
  });
  form.addEventListener('change', (e) => {
    const t = e.target as HTMLSelectElement;
    // Vyn att lägga på bladet föreslår sin egen skala.
    if (t.matches('[data-sheet-view]')) {
      const n = Number(t.selectedOptions[0]?.dataset.scale) || 100;
      const sel = form.querySelector<HTMLSelectElement>('[data-sheet-scale]')!;
      sel.innerHTML = scaleOptions(n);
      return;
    }
    if (t.matches('[data-sheet-pref="new-title"]')) {
      host.setNewSheetTitleBlock((t as unknown as HTMLInputElement).checked);
      return;
    }
    if (!t.matches(own)) dirty();
  });
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') e.preventDefault();
  });
  form.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-sheet], [data-tree]');
    if (!b) return;
    if (b.dataset.tree === 'reset') {
      host.rerender();
      return;
    }
    const sheet = kind === 'sheet' ? store.doc.sheets.find((x) => x.id === id) : kind === 'viewport' ? sheetOfViewport(store.doc, id) : sheetOfItem(store.doc, id);
    if (!sheet) return;
    switch (b.dataset.sheet) {
      case 'place': {
        const view = form.querySelector<HTMLSelectElement>('[data-sheet-view]')?.value;
        const scale = Number(form.querySelector<HTMLSelectElement>('[data-sheet-scale]')?.value) || 100;
        if (view) host.place(sheet.id, view, scale);
        break;
      }
      case 'pick-viewport':
        host.pick({ kind: 'viewport', id: b.dataset.id! });
        break;
      case 'pick-item':
        host.pick({ kind: 'titleBlock', id: b.dataset.id! });
        break;
      case 'pick-text':
        host.pick({ kind: 'sheetText', id: b.dataset.id! });
        break;
      case 'start-text':
        host.startText();
        break;
      case 'reset-crop':
        setViewportCrop(store, sheet.id, id, null);
        host.rerender();
        break;
      case 'place-title':
        host.placeTitleBlock(sheet.id);
        break;
      case 'remove-item-row':
        removeFromSheet(store, sheet.id, [b.dataset.id!]);
        break;
      case 'remove-item':
        removeFromSheet(store, sheet.id, [id]);
        host.pick({ kind: 'sheet', id: sheet.id });
        break;
      case 'remove-row':
        removeViewport(store, sheet.id, b.dataset.id!);
        break;
      case 'remove-viewport':
        removeViewport(store, sheet.id, id);
        host.pick({ kind: 'sheet', id: sheet.id });
        break;
      case 'back':
        host.pick({ kind: 'sheet', id: sheet.id });
        break;
      case 'open-view': {
        const vp = sheet.viewports.find((v) => v.id === id);
        if (vp) host.openView(vp.view);
        break;
      }
      case 'logo':
        host.chooseLogo();
        break;
      case 'logo-remove':
        setLogo(store, null);
        break;
      case 'duplicate': {
        const copy = duplicateSheet(store, sheet.id);
        if (copy) host.pick({ kind: 'sheet', id: copy });
        break;
      }
      case 'delete':
        void askConfirm('Ta bort bladet?', `${sheet.number} ${sheet.name} tas bort. Vyerna finns kvar i projektet. Det går att ångra.`).then((ok) => {
          if (!ok) return;
          deleteSheet(store, sheet.id);
          host.closed();
        });
        break;
    }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = new FormData(form);
    const str = (k: string) => String(d.get(k) ?? '');
    if (kind === 'viewport') {
      const sheet = sheetOfViewport(store.doc, id);
      if (!sheet) return;
      const scale = Math.round(Number(str('scale'))) || 100;
      const view = str('view') || undefined;
      const vp = sheet.viewports.find((v) => v.id === id)!;
      // Byts skalan eller vyn står mitten kvar där den var på bladet. En
      // ändrad ram följer med skalan; byts vyn följer ramen innehållet igen.
      const other = !!view && view !== vp.view;
      const moved = scale !== vp.scale || other;
      const center = (b: { minX: number; minY: number; maxX: number; maxY: number }, at: [number, number], n: number): [number, number] => [at[0] + (b.minX + b.maxX) / 2 / n, at[1] + (b.minY + b.maxY) / 2 / n];
      let at: [number, number] = vp.at;
      if (moved && vp.crop && !other) {
        const c = center(vp.crop, vp.at, vp.scale);
        const m = center(vp.crop, [0, 0], scale);
        at = [Math.round(c[0] - m[0]), Math.round(c[1] - m[1])];
      } else if (moved) at = centeredAt(store.doc, view ?? vp.view, scale, vp.crop ? center(vp.crop, vp.at, vp.scale) : viewCenter(store.doc, vp.view, vp.scale, vp.at)) as [number, number];
      updateViewport(
        store,
        sheet.id,
        id,
        { scale, at, title: str('title').trim() || undefined, hideScale: d.get('showScale') === null, crop: other ? undefined : vp.crop, ...(view ? { view } : {}) },
        'Spara vyn på bladet',
      );
    } else if (kind === 'sheet') {
      saveSheet(
        store,
        id,
        {
          number: str('number'),
          name: str('name'),
          size: str('size') as Sheet['size'],
          orientation: str('orientation') as Sheet['orientation'],
          frame: d.get('frame') !== null,
        },
        str('folder') || null,
      );
    } else if (kind === 'sheetText') {
      updateSheetText(store, id, { text: str('text').replace(/\r/g, ''), height: Number(str('height')) || 2.5, bold: d.get('bold') !== null }, 'Spara texten på bladet');
      if (!sheetOfItem(store.doc, id)) {
        host.closed();
        return;
      }
    } else {
      // Ritningshuvudet: ritningens fält sparas på bladet, projektets för alla blad.
      const sheet = sheetOfItem(store.doc, id);
      if (!sheet) return;
      const fields: Record<string, string> = { ...sheet.fields };
      for (const x of SHEET_FIELDS) fields[x.key] = str(`f:${x.key}`);
      saveSheet(store, sheet.id, { number: str('number'), name: str('name'), fields });
      const project: Record<string, string> = {};
      for (const x of PROJECT_FIELDS) project[x.key] = str(`p:${x.key}`);
      const p = store.doc.project;
      const changed = PROJECT_FIELDS.some((x) => (p.fields[x.key] ?? '') !== project[x.key].trim()) || (str('projectName').trim() && str('projectName').trim() !== p.name);
      if (changed) saveProjectFields(store, project, str('projectName'));
    }
    host.saved();
  });
}
