import { EXPORT_KINDS, NAME_DEFAULTS, type ExportKind, type ExportSettings } from '../../core/exportSettings';
import type { StyleBook } from '../../core/graphics';
import { newId } from '../../core/ids';
import type { ProjectDoc } from '../../core/model';
import type { DocStore } from '../../core/store';
import { BUNDLED_FONTS, fontOf, isBundledFont, readFontFile } from '../../formats/fonts';
import { pickFiles } from '../app/imageFile';
import { base64Of } from '../app/underlays';
import { askChoice } from '../ask';
import { escapeHtml as esc } from '../labels';

/**
 * Stilboken › Allmänt (0.12): typsnittet (de som följer med appen och ett
 * eget, uppladdat) och exportens filnamnsmallar.
 */

const KIND_LABEL: Record<ExportKind, string> = { sheet: 'Blad', view: 'Vyer', image: 'Bilder ur 3D', model: 'Modellen' };

/** Typsnittets lista och knapparna för ett eget. */
export function fontMarkup(doc: ProjectDoc): string {
  const id = doc.graphics.font ?? 'osifont';
  const custom = !isBundledFont(id) && doc.assets[id] ? fontOf(doc) : null;
  const options = [...BUNDLED_FONTS.map((f) => [f.id, f.name] as const), ...(custom ? [[custom.id, `${custom.name} (egen fil)`] as const] : [])];
  return `<label class="field" title="Ritningens typsnitt, på skärmen och inbäddat i PDF:en"><span>Typsnitt</span><select data-gen="font">${options
    .map(([v, l]) => `<option value="${esc(v)}"${v === (custom ? custom.id : isBundledFont(id) ? id : 'osifont') ? ' selected' : ''}>${esc(l)}</option>`)
    .join('')}</select></label>
    <div class="field gen-font"><span>Eget typsnitt</span><div class="gen-logo-box"><button type="button" class="btn" data-gen-action="font-upload" title="En öppen TTF- eller OTF-fil; den sparas i stilboken och följer med mallen och Exportera…">Välj fil…</button>${custom ? '<button type="button" class="btn btn-ghost" data-gen-action="font-remove">Ta bort</button>' : ''}</div></div>`;
}

/** Exportens filnamnsmallar. */
export function exportMarkup(doc: ProjectDoc): string {
  const names = doc.graphics.export?.names ?? {};
  return `<section class="style-labels gen-export">
      <h3>Export</h3>
      <p class="note">Filnamnen skrivs med smarttext, t.ex. <code>{ritningsnummer}_{titel}</code>. Blad har bladets smarttext (<code>{ritningsnummer}</code>, <code>{innehåll}</code>, <code>{titel}</code>, <code>{skede}</code>, <code>{datum}</code> …), de andra <code>{projekt}</code>, <code>{vy}</code>, <code>{skala}</code>, <code>{datum}</code> och projektets fält. Tecken som inte får finnas i filnamn byts mot bindestreck.</p>
      <div class="fields gen-grid">
        ${EXPORT_KINDS.map((k) => `<label class="field"><span>${KIND_LABEL[k]}</span><input data-gen="export:${k}" value="${esc(names[k] ?? '')}" placeholder="${esc(NAME_DEFAULTS[k])}" autocomplete="off"></label>`).join('')}
      </div>
    </section>`;
}

/** Stilboken med ändrade exportinställningar (tomma tas bort). */
function withExport(book: StyleBook, fn: (e: ExportSettings) => void): StyleBook {
  const e: ExportSettings = { ...(book.export ?? {}), ...(book.export?.names ? { names: { ...book.export.names } } : {}) };
  fn(e);
  if (e.names && !Object.keys(e.names).length) delete e.names;
  const next = { ...book };
  if (Object.keys(e).length) next.export = e;
  else delete next.export;
  return next;
}

/** Ett fält för typsnittet eller exporten har ändrats. Svarar sant om det var ett av dem. */
export function exportChange(store: DocStore, kind: string, name: string, value: string, setBook: (book: StyleBook, label: string) => void): boolean {
  const book = store.doc.graphics;
  if (kind === 'font') {
    if ((book.font ?? 'osifont') === value) return true;
    const next = { ...book };
    if (value === 'osifont') delete next.font;
    else next.font = value;
    setBook(next, 'Ritningens typsnitt');
    return true;
  }
  if (kind !== 'export' || !EXPORT_KINDS.includes(name as ExportKind)) return false;
  const k = name as ExportKind;
  const v = value.trim();
  if ((book.export?.names?.[k] ?? '') === v) return true;
  setBook(
    withExport(book, (e) => {
      e.names = { ...(e.names ?? {}) };
      if (v && v !== NAME_DEFAULTS[k]) e.names[k] = v;
      else delete e.names[k];
    }),
    `Filnamn för ${KIND_LABEL[k].toLowerCase()}`,
  );
  return true;
}

/** *Välj fil…* och *Ta bort* för det egna typsnittet. Svarar sant om det var en av dem. */
export async function fontClick(store: DocStore, action: string): Promise<boolean> {
  if (action !== 'font-upload' && action !== 'font-remove') return false;
  const book = store.doc.graphics;
  const old = book.font && !isBundledFont(book.font) ? book.font : undefined;
  if (action === 'font-remove') {
    store.transact('Ta bort det egna typsnittet', (tx) => {
      const next = { ...book };
      delete next.font;
      tx.setGraphics(next);
      if (old) tx.removeAsset(old);
    });
    return true;
  }
  const [file] = await pickFiles('.ttf,.otf,font/ttf,font/otf');
  if (!file) return true;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const r = readFontFile(bytes);
  if ('error' in r) {
    await askChoice('Typsnittet', r.error, [{ value: 'ok', label: 'Ok' }]);
    return true;
  }
  const id = newId('fil');
  store.transact(`Typsnitt: ${r.name}`, (tx) => {
    tx.putAsset({ id, name: file.name, mime: r.metrics.cff ? 'font/otf' : 'font/ttf', data: base64Of(bytes) });
    tx.setGraphics({ ...book, font: id });
    if (old) tx.removeAsset(old);
  });
  return true;
}
