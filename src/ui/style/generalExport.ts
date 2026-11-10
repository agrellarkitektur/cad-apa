import { activeMap, isSb11List, LAYER_MAP_LABEL, LAYER_MAPS, type DxfSettings, type LayerMapId } from '../../core/dxfLayers';
import { EXPORT_KINDS, NAME_DEFAULTS, type ExportKind, type ExportSettings } from '../../core/exportSettings';
import { dxfBytesText, readDxfLayerList } from '../../formats/dxfLayerList';
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
 * eget, uppladdat), exportens filnamnsmallar och DXF:ens lager (0.12.1).
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
    </section>
    ${dxfMarkup(doc)}`;
}

/** DXF:ens lagerkarta (0.12.1): SB11 förenklad, fullständig, Enkel eller en egen lista ur en DXF. */
function dxfMarkup(doc: ProjectDoc): string {
  const d = doc.graphics.export?.dxf;
  const map = activeMap(d);
  const own = d?.custom;
  const options = LAYER_MAPS.filter((m) => m !== 'custom' || own).map((m) => [m, m === 'custom' ? `Egen: ${own!.name}` : LAYER_MAP_LABEL[m]] as const);
  const all = map === 'sb11full' || map === 'custom';
  return `<section class="style-labels gen-dxf">
      <h3>DXF</h3>
      <p class="note">Lagret räknas fram ur objektet: byggdel (yttervägg eller innervägg, bärande, fast eller lös inredning …), del och status (N nytt, E befintligt, R rivs). Färgen följer pennan som i pennväljaren: grå 0,13, cyan 0,18, röd 0,25, grön 0,35, svart 0,50 (vit på skärmen i AutoCAD), magenta 0,70, blå 1,00 och gul 1,40.</p>
      <div class="fields gen-grid">
        <label class="field" title="Lagerkartan för DXF-exporten"><span>Lager</span><select data-gen="dxf:map">${options.map(([v, l]) => `<option value="${v}"${v === map ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
      </div>
      <div class="row"><button type="button" class="btn" data-gen-action="dxf-layers" title="Lagren i en DXF-mall blir kontorets lista; namnen följer SB11 och hamnar på närmaste lager i listan">Läs lagerlista ur DXF…</button>${own ? '<button type="button" class="btn btn-ghost" data-gen-action="dxf-layers-remove">Ta bort den egna listan</button>' : ''}</div>
      ${all ? `<label class="check"><input type="checkbox" data-gen="dxf:all"${d?.allLayers ? ' checked' : ''}> Alla lager i listan, också de tomma</label>` : ''}
    </section>`;
}

/** Stilboken med ändrade DXF-inställningar. */
function withDxf(book: StyleBook, fn: (d: DxfSettings) => void): StyleBook {
  return withExport(book, (e) => {
    const d: DxfSettings = { ...(e.dxf ?? {}) };
    fn(d);
    if (Object.keys(d).length) e.dxf = d;
    else delete e.dxf;
  });
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
  if (kind === 'dxf') {
    if (name === 'map' && LAYER_MAPS.includes(value as LayerMapId)) {
      if (activeMap(book.export?.dxf) !== value)
        setBook(
          withDxf(book, (d) => {
            if (value === 'sb11') delete d.map;
            else d.map = value as LayerMapId;
          }),
          `DXF-lager: ${LAYER_MAP_LABEL[value as LayerMapId]}`,
        );
    } else if (name === 'all')
      setBook(
        withDxf(book, (d) => {
          if (value) d.allLayers = true;
          else delete d.allLayers;
        }),
        value ? 'DXF: alla lager i listan' : 'DXF: bara lager med innehåll',
      );
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

/** *Läs lagerlista ur DXF…* och *Ta bort den egna listan*. Svarar sant om det var en av dem. */
export async function dxfClick(store: DocStore, action: string, setBook: (book: StyleBook, label: string) => void): Promise<boolean> {
  if (action !== 'dxf-layers' && action !== 'dxf-layers-remove') return false;
  const book = store.doc.graphics;
  if (action === 'dxf-layers-remove') {
    setBook(
      withDxf(book, (d) => {
        delete d.custom;
        if (d.map === 'custom') delete d.map;
      }),
      'Ta bort den egna lagerlistan',
    );
    return true;
  }
  const [file] = await pickFiles('.dxf');
  if (!file) return true;
  const list = readDxfLayerList(dxfBytesText(new Uint8Array(await file.arrayBuffer())));
  if (!list.layers.length) {
    await askChoice('Lagerlistan', 'Filen har inga lager (utom 0 och Defpoints). Välj en DXF med lagertabellen, t.ex. kontorets mall sparad som DXF.', [{ value: 'ok', label: 'Ok' }]);
    return true;
  }
  const name = file.name.replace(/\.dxf$/i, '');
  setBook(
    withDxf(book, (d) => {
      d.custom = { name, layers: list.layers, ...(list.linetypes.length ? { linetypes: list.linetypes } : {}) };
      d.map = 'custom';
    }),
    `Lagerlista: ${name}`,
  );
  if (!isSb11List(list.layers))
    await askChoice('Lagerlistan', `${list.layers.length} lager lästes in. Namnen följer inte SB11 (som A-27C---E-N), så exporten skriver SB11-namnen med listans färger där namnen är lika.`, [{ value: 'ok', label: 'Ok' }]);
  return true;
}
