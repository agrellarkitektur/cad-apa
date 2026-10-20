import type { Id, ProjectDoc, Sheet } from '../core/model';
import { applyFieldChanges, fieldsOf, fieldValue, type FieldChanges } from '../core/sheetFields';
import { deleteSheet, duplicateSheet, masterOf, mastersOf, PAPER_SIZES, removeViewport, renameProject, saveSheet, setViewportCrop, sheetOfViewport, today, updateViewport } from '../core/sheets';
import type { DocStore } from '../core/store';
import { centeredAt, placeableViews, viewCenter, viewSource } from '../repr/sheet';
import { SMART_TEXT, smartVars } from '../repr/smartText';
import { ANNOTATION_SCALES } from './app/helpers';
import { askConfirm } from './ask';
import { icons } from './icons';
import { escapeHtml } from './labels';

/**
 * Inställningarna för ett ritningsblad och en vy på ett blad (0.8 del 3),
 * i egenskapspanelen som det andra i projektträdet:
 * inget ändras förrän man sparar. Att lägga en vy på bladet och ta bort
 * något görs direkt.
 *
 * Bladets formulär har mallbladet (0.8.8) och en tabell med fälten som
 * smarttexten fylls i med (0.8.10): allt inom klamrar i mallens och bladets
 * texter. Ett fält gäller bladet eller hela projektet. Flera blad markerade
 * i projektträdet visar bara tabellen, med *(olika)* där värdena skiljer.
 */

const esc = escapeHtml;
const field = (label: string, input: string) => `<label class="field"><span>${label}</span>${input}</label>`;

/** Det som har ett formulär här: bladet och vyerna på det. Det som är ritat på bladet är vanliga objekt (0.8.9). */
export type SheetFormKind = 'sheet' | 'viewport';

/** Det formuläret visar: bladet (med `also`, fler blad markerade i trädet) eller en vy på ett blad. */
export interface SheetFormItem {
  kind: SheetFormKind;
  id: Id;
  also?: readonly Id[];
}

export interface SheetFormHost {
  /** Visa något annat i panelen: bladet eller en vy på det. */
  pick(item: { kind: SheetFormKind; id: Id }): void;
  /** Börja skriva text på bladet (textverktyget). */
  startText(): void;
  /** Börja rita linjer och ytor på bladet (2D-verktyget, 0.8.9). */
  startDraw(): void;
  /** Lägg en vy på bladet, mitt på den lediga ytan. */
  place(sheetId: Id, view: Id, scale: number): void;
  /** Öppna ett mallblad för att rita på det. */
  openMaster(id: Id): void;
  /** Öppna vyn som en vy på bladet visar. */
  openView(view: Id): void;
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
  const own = !ANNOTATION_SCALES.includes(current);
  return (
    ANNOTATION_SCALES.map((n) => `<option value="${n}"${n === current ? ' selected' : ''}>1:${n}</option>`).join('') + `<option value="egen"${own ? ' selected' : ''}>Egen skala…</option>`
  );
}

/**
 * Skalan för en vy: de vanliga skalorna och *Egen skala* (0.8.9), där man
 * skriver nämnaren i fältet bredvid, 1:___.
 */
function scaleField(name: string, current: number, attr = ''): string {
  const own = !ANNOTATION_SCALES.includes(current);
  return `<span class="scale-pick"><select name="${name}"${attr}>${scaleOptions(current)}</select><span class="scale-own"${own ? '' : ' hidden'}>1:<input name="${name}-own" type="number" min="1" max="100000" step="1" value="${current}" inputmode="numeric" aria-label="Egen skala, 1:"></span></span>`;
}

/** Skalan som valts i ett `scaleField`: nämnaren, eller null om den egna inte är ett tal. */
function readScale(form: HTMLFormElement, name: string): number | null {
  const sel = form.querySelector<HTMLSelectElement>(`select[name="${name}"]`);
  if (!sel) return null;
  const v = sel.value === 'egen' ? form.querySelector<HTMLInputElement>(`input[name="${name}-own"]`)?.value : sel.value;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 1 ? n : null;
}

const ORIENTATION = { landscape: 'Liggande', portrait: 'Stående' } as const;

/** En kort beskrivning av bladet: format och antal vyer. */
export function describeSheet(s: Sheet): string {
  const n = s.viewports.length;
  return `${s.size} ${ORIENTATION[s.orientation].toLowerCase()} · ${n} ${n === 1 ? 'vy' : 'vyer'}`;
}

/**
 * Fälten som bladen använder (0.8.10), i en tabell: namn, värde och om det
 * gäller hela projektet. Med flera blad visar ett fält med olika värden
 * *(olika)*, och bara de fält man ändrar skrivs till bladen.
 */
function fieldTable(doc: ProjectDoc, sheets: readonly Sheet[]): string {
  const fields = fieldsOf(doc, sheets);
  const built = SMART_TEXT.map(([k, d]) => `<code title="${esc(d)}">{${esc(k)}}</code>`).join(' ');
  const auto = sheets.length === 1 ? smartVars(doc, sheets[0], today()) : null;
  const rows = fields
    .map((f) => {
      const values = sheets.map((s) => fieldValue(doc, s, f.key));
      const mixed = values.some((v) => v !== values[0]);
      const v = mixed ? '' : values[0];
      const ph = mixed ? '(olika)' : f.key === 'skala' || f.key === 'skala a3' ? auto?.[f.key] || 'vyernas skala' : '';
      const name = esc(f.key);
      return `<tr${f.used ? '' : ' class="unused"'}>
        <th scope="row" title="{${esc(f.label)}}">${esc(f.label)}${f.used ? '' : '<small>används inte</small>'}</th>
        <td><input data-field="${name}" data-orig="${esc(v)}" value="${esc(v)}"${ph ? ` placeholder="${esc(ph)}"` : ''} autocomplete="off" aria-label="${esc(f.label)}"></td>
        <td class="shared"><input type="checkbox" data-shared="${name}"${f.shared ? ' checked data-orig="1"' : ''}${f.key.startsWith('skala') ? ' disabled' : ''} aria-label="${esc(f.label)} gäller hela projektet" title="Gäller hela projektet"></td>
      </tr>`;
    })
    .join('');
  return `<section>
      <h3>Fält</h3>
      ${
        rows
          ? `<table class="field-table"><thead><tr><th>Fält</th><th>Värde</th><th title="Gäller hela projektet">Projekt</th></tr></thead><tbody>${rows}</tbody></table>`
          : '<p class="note">Mallen och bladet har inga fält än.</p>'
      }
      <p class="note">Skriv <code>{Namn}</code> i en text i mallbladet eller på bladet för ett nytt fält, t.ex. <code>{Konstruktör}</code>. Ett fält med kryss i <i>Projekt</i> gäller alla blad.${sheets.length > 1 ? ' Bara fälten du ändrar skrivs till de markerade bladen.' : ' Skalan fylls i med vyernas skalor om fältet är tomt.'}</p>
      <p class="note smart-note">Inbyggt: ${built}</p>
    </section>`;
}

/** Ändringarna i fälttabellen jämfört med när den ritades. */
function readFieldChanges(form: HTMLFormElement): FieldChanges {
  const values: Record<string, string> = {};
  const shared: Record<string, boolean> = {};
  form.querySelectorAll<HTMLInputElement>('input[data-field]').forEach((i) => {
    // Ett fält med olika värden skrivs bara om man skrivit något i det.
    const mixed = i.placeholder === '(olika)';
    if (mixed ? i.value.trim() !== '' : i.value.trim() !== (i.dataset.orig ?? '')) values[i.dataset.field!] = i.value;
  });
  form.querySelectorAll<HTMLInputElement>('input[data-shared]').forEach((i) => {
    if (i.checked !== (i.dataset.orig === '1')) shared[i.dataset.shared!] = i.checked;
  });
  return { values, shared };
}

/** Formuläret för flera blad markerade i projektträdet: bara fälten. */
function multiSheetMarkup(doc: ProjectDoc, sheets: Sheet[], actions: string): string {
  const list = sheets.map((s) => esc(s.number)).join(', ');
  return `<form class="tree-form sheet-form" data-tree-kind="sheets" data-tree-id="${sheets[0].id}" data-ids="${sheets.map((s) => s.id).join(' ')}">
    <header class="sel-head"><h2>${sheets.length} blad</h2><p>${list}</p></header>
    ${fieldTable(doc, sheets)}
    ${actions}
  </form>`;
}

export function sheetFormMarkup(doc: ProjectDoc, item: SheetFormItem): string {
  const actions = (extra = '') =>
    `<div class="tree-save">${extra}<button type="button" class="btn" data-tree="reset" disabled>Återställ</button><button type="submit" class="btn btn-primary" data-tree="save" disabled>Spara</button></div>`;
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
          ${field('Skala', scaleField('scale', vp.scale))}
          ${field('Rubrik', `<input name="title" value="${esc(vp.title ?? '')}" placeholder="${esc(src?.name ?? '')}">`)}
        </div>
        <label class="check"><input type="checkbox" name="showScale"${vp.hideScale ? '' : ' checked'}> Skalan i rubriken</label>
        <p class="note">Texter, mått och symboler ritas för vyns skala, så att de får rätt höjd på papperet. Dra vyn på bladet för att flytta den; den fäster mot de andra vyernas kanter och mittlinjer. Markera flera saker på bladet (med en ruta eller Shift) för att flytta dem tillsammans.</p>
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
  const many = [item.id, ...(item.also ?? [])].map((id) => doc.sheets.find((x) => x.id === id)).filter((x): x is Sheet => !!x);
  if (many.length > 1) return multiSheetMarkup(doc, many, actions());
  const s = doc.sheets.find((x) => x.id === item.id);
  if (!s) return '';
  const views = s.viewports
    .map((vp) => {
      const src = viewSource(doc, vp.view);
      return `<div class="view-row"><button type="button" class="view-apply" data-sheet="pick-viewport" data-id="${vp.id}">${esc(vp.title || src?.name || 'Vyn finns inte längre')}<small>1:${vp.scale}</small></button><button type="button" class="icon-mini view-more" data-sheet="remove-row" data-id="${vp.id}" aria-label="Ta bort från bladet" title="Ta bort från bladet">${icons.close}</button></div>`;
    })
    .join('');
  const placeable = placeableViews(doc);
  const master = masterOf(doc, s);
  const masters = mastersOf(doc);
  return `<form class="tree-form sheet-form" data-tree-kind="sheet" data-tree-id="${s.id}">
    <header class="sel-head"><h2>${esc(s.number)} · ${esc(s.name)}</h2><p>Ritningsblad · ${esc(describeSheet(s))}</p></header>
    <section>
      <div class="fields">
        ${field('Ritningsnummer', `<input name="number" value="${esc(s.number)}" autocomplete="off">`)}
        ${field('Innehåll', `<input name="name" value="${esc(s.name)}" autocomplete="off">`)}
        ${field('Format', `<select name="size">${PAPER_SIZES.map((p) => `<option${p === s.size ? ' selected' : ''}>${p}</option>`).join('')}</select>`)}
        ${field('Orientering', `<select name="orientation">${(['landscape', 'portrait'] as const).map((o) => `<option value="${o}"${o === s.orientation ? ' selected' : ''}>${ORIENTATION[o]}</option>`).join('')}</select>`)}
        ${field('Mapp', `<select name="folder">${folderOptions(doc, doc.tree[s.id] ?? null)}</select>`)}
        ${field('Mallblad', `<select name="master"><option value=""${master ? '' : ' selected'}>Inget</option>${masters.map((m) => `<option value="${m.id}" data-size="${m.paper.size}" data-orientation="${m.paper.orientation}"${m.id === master?.id ? ' selected' : ''}>${esc(m.name)}</option>`).join('')}</select>`)}
      </div>
      ${master && (master.paper.size !== s.size || master.paper.orientation !== s.orientation) ? `<p class="note warn">Mallbladet är ritat för ${master.paper.size} ${ORIENTATION[master.paper.orientation].toLowerCase()}, bladet är ${s.size} ${ORIENTATION[s.orientation].toLowerCase()}. Mallen ritas från papperets nedre vänstra hörn och kan hamna utanför.</p>` : ''}
      ${master ? `<div class="row"><button type="button" class="btn" data-sheet="open-master" data-id="${master.id}">Öppna mallbladet</button></div>` : masters.length ? '' : '<p class="note">Projektet har inget mallblad. Skapa ett under Ritningar i projektträdet, och rita ramen och huvudet på det.</p>'}
    </section>
    <section>
      <div class="fields">
        ${field('Projekt', `<input name="projectName" value="${esc(doc.project.name)}" autocomplete="off">`)}
      </div>
      <p class="note">Projektets namn, <code>{projekt}</code>, gäller alla blad.</p>
    </section>
    ${fieldTable(doc, [s])}
    <section>
      <h3>Vyer på bladet</h3>
      ${views ? `<div class="nav-list">${views}</div>` : '<p class="note">Inga vyer än. Välj en vy och lägg den på bladet.</p>'}
      <div class="fields">
        ${field('Vy', `<select data-sheet-view>${placeable.map((o) => `<option value="${esc(o.id)}" data-scale="${o.def.scale ?? 100}">${esc(o.name)}${o.id.startsWith('modell:') ? ' (modell)' : ''}</option>`).join('')}</select>`)}
        ${field('Skala', scaleField('placeScale', placeable[0]?.def.scale ?? 100, ' data-sheet-scale'))}
      </div>
      <div class="row"><button type="button" class="btn" data-sheet="place">${icons.plus}<span>Lägg på bladet</span></button></div>
    </section>
    <section>
      <h3>Rita på bladet</h3>
      <p class="note">Linjer, ytor, text och bilder ritas direkt på bladet i mm på papperet, med samma verktyg som i planen. Bilder läggs in med <i>Lägg in underlag…</i>. Texter kan ha smarttext och en textruta.</p>
      <div class="row"><button type="button" class="btn" data-sheet="start-text">${icons.text}<span>Skriv text</span></button><button type="button" class="btn" data-sheet="start-draw">${icons.draw2d}<span>Linjer och ytor</span></button></div>
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
  const kind = form.dataset.treeKind as SheetFormKind | 'sheets';
  const id = form.dataset.treeId!;
  const dirty = () => form.querySelectorAll<HTMLButtonElement>('[data-tree="save"], [data-tree="reset"]').forEach((b) => (b.disabled = false));
  const own = '[data-sheet-view], [data-sheet-scale], [name="placeScale-own"]';
  form.addEventListener('input', (e) => {
    if (!(e.target as HTMLElement).matches(own)) dirty();
  });
  form.addEventListener('change', (e) => {
    const t = e.target as HTMLSelectElement;
    // Egen skala: fältet för 1:___ visas (0.8.9).
    if (t.matches('.scale-pick select')) {
      const own = t.parentElement!.querySelector<HTMLElement>('.scale-own')!;
      own.hidden = t.value !== 'egen';
      if (!own.hidden) own.querySelector('input')?.select();
    }
    // Vyn att lägga på bladet föreslår sin egen skala.
    if (t.matches('[data-sheet-view]')) {
      const n = Number(t.selectedOptions[0]?.dataset.scale) || 100;
      const sel = form.querySelector<HTMLSelectElement>('[data-sheet-scale]')!;
      sel.innerHTML = scaleOptions(n);
      const own = sel.parentElement!.querySelector<HTMLElement>('.scale-own')!;
      own.hidden = sel.value !== 'egen';
      own.querySelector('input')!.value = String(n);
      return;
    }
    // Ett annat mallblad föreslår mallens format.
    if (t.matches('select[name="master"]')) {
      const o = t.selectedOptions[0];
      const size = form.querySelector<HTMLSelectElement>('select[name="size"]');
      const orientation = form.querySelector<HTMLSelectElement>('select[name="orientation"]');
      if (o?.dataset.size && size && orientation) {
        size.value = o.dataset.size;
        orientation.value = o.dataset.orientation ?? orientation.value;
      }
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
    const sheet = kind === 'viewport' ? sheetOfViewport(store.doc, id) : store.doc.sheets.find((x) => x.id === id);
    if (!sheet) return;
    switch (b.dataset.sheet) {
      case 'place': {
        const view = form.querySelector<HTMLSelectElement>('[data-sheet-view]')?.value;
        const scale = readScale(form, 'placeScale');
        if (view && scale) host.place(sheet.id, view, scale);
        break;
      }
      case 'pick-viewport':
        host.pick({ kind: 'viewport', id: b.dataset.id! });
        break;
      case 'open-master':
        host.openMaster(b.dataset.id!);
        break;
      case 'start-text':
        host.startText();
        break;
      case 'start-draw':
        host.startDraw();
        break;
      case 'reset-crop':
        setViewportCrop(store, sheet.id, id, null);
        host.rerender();
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
      case 'duplicate': {
        const copy = duplicateSheet(store, sheet.id);
        if (copy) host.pick({ kind: 'sheet', id: copy });
        break;
      }
      case 'delete':
        void askConfirm('Ta bort bladet?', `${sheet.number} ${sheet.name} tas bort med det som är ritat på det. Vyerna finns kvar i projektet. Det går att ångra.`).then((ok) => {
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
      const scale = readScale(form, 'scale') ?? 100;
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
      // Bladet med fälten i ett steg, och projektets namn.
      if (!store.doc.sheets.some((x) => x.id === id)) return;
      saveSheet(
        store,
        id,
        {
          number: str('number'),
          name: str('name'),
          size: str('size') as Sheet['size'],
          orientation: str('orientation') as Sheet['orientation'],
          master: str('master') || undefined,
        },
        str('folder') || null,
        readFieldChanges(form),
      );
      renameProject(store, str('projectName'));
    } else {
      // Flera blad (0.8.10): bara ändrade fält skrivs.
      const ids = (form.dataset.ids ?? '').split(' ').filter(Boolean);
      applyFieldChanges(store, ids, readFieldChanges(form), `Spara fälten på ${ids.length} blad`);
    }
    host.saved();
  });
}
