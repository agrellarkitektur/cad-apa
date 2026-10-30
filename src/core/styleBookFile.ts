import { pruneAssets } from './commands';
import { normalizeBook, type StyleBook } from './graphics';
import { newId } from './ids';
import { isMaster, isStamp, type Asset, type Element, type Id, type ProjectDoc, type Worksheet } from './model';
import { relinkLogos } from './office';
import type { DocStore, TxBuilder } from './store';
import type { ViewCategory } from './viewCategories';

/**
 * Stilboken ut och in (0.10.40): hela stilboken som fil, med bilderna den
 * använder (logotypen och materialens texturer) inbäddade, och som val
 * projektets mallblad och stämplar med det som är ritat på dem. Samma fil är
 * *Mall för nya projekt*. Projektets uppgifter (namn, nummer, fastighet,
 * skede, projektets fält) bor i projektet och följer inte med.
 */

/** Mallbladen och stämplarna i en stilboksfil: arbetsbladen, det som är ritat på dem och det förvalda mallbladet. */
export interface PaperPart {
  worksheets: Worksheet[];
  elements: Element[];
  master?: Id;
}

/** En stilbok som fil: stilboken med bilderna och (valfritt) papperet. */
export type StyleBookFile = StyleBook & { assets?: Asset[]; paper?: PaperPart };

/** Det som lästs ur en fil: stilboken, dess bilder och papperet, om det finns. */
export interface ReadBook {
  book: StyleBook;
  assets: Asset[];
  paper?: PaperPart;
}

export interface PaperChoice {
  masters: boolean;
  stamps: boolean;
}

/** Bilderna stilboken använder: logotypen och materialens texturer. */
export function bookAssetIds(book: StyleBook): Id[] {
  const ids = new Set<Id>();
  if (book.office?.logo) ids.add(book.office.logo.asset);
  for (const m of book.materials ?? []) if (m.texture) ids.add(m.texture.asset);
  return [...ids];
}

/** Hur många mallblad och stämplar projektet har. */
export function paperCounts(doc: Pick<ProjectDoc, 'worksheets'>): { masters: number; stamps: number } {
  return { masters: doc.worksheets.filter(isMaster).length, stamps: doc.worksheets.filter(isStamp).length };
}

/**
 * Stilboken som fil. Med mallbladen tas också stämplarna som ligger på dem,
 * så att mallbladen ritas som i projektet.
 */
export function exportBook(doc: ProjectDoc, choice: PaperChoice = { masters: false, stamps: false }): StyleBookFile {
  const book = structuredClone(doc.graphics) as StyleBookFile;
  const assetIds = new Set(bookAssetIds(doc.graphics));
  const pick = new Set<Id>();
  for (const w of doc.worksheets) if ((choice.masters && isMaster(w)) || (choice.stamps && isStamp(w))) pick.add(w.id);
  const all = Object.values(doc.elements);
  // Stämplar på det som tas med (också i stämplar) följer med.
  for (let grew = true; grew; ) {
    grew = false;
    for (const e of all)
      if (e.type === 'Stamp' && e.space && pick.has(e.space) && typeof e.params.stamp === 'string' && !pick.has(e.params.stamp) && isStamp(doc.worksheets.find((w) => w.id === e.params.stamp))) {
        pick.add(e.params.stamp);
        grew = true;
      }
  }
  if (pick.size) {
    const elements = all.filter((e) => e.space && pick.has(e.space)).map((e) => structuredClone(e));
    for (const e of elements) if (typeof e.params.asset === 'string') assetIds.add(e.params.asset);
    const master = doc.project.master && pick.has(doc.project.master) ? doc.project.master : undefined;
    book.paper = { worksheets: doc.worksheets.filter((w) => pick.has(w.id)).map((w) => structuredClone(w)), elements, ...(master ? { master } : {}) };
  }
  const assets = [...assetIds].map((id) => doc.assets[id]).filter(Boolean).map((a) => structuredClone(a));
  if (assets.length) book.assets = assets;
  return book;
}

const isAsset = (a: any): a is Asset => !!a && typeof a.id === 'string' && typeof a.data === 'string' && typeof a.mime === 'string';

/** Läs en stilboksfil (eller en äldre stilbok eller stilmall utan bilder). */
export function readBookFile(data: any, base?: StyleBook, styleTo?: ViewCategory): ReadBook {
  const book = normalizeBook(data, base, styleTo);
  const assets = Array.isArray(data?.assets) ? data.assets.filter(isAsset).map((a: Asset) => ({ id: a.id, name: String(a.name ?? a.id), mime: a.mime, data: a.data })) : [];
  delete (book as StyleBookFile).assets;
  delete (book as StyleBookFile).paper;
  const p = data?.paper;
  const worksheets: Worksheet[] = Array.isArray(p?.worksheets) ? p.worksheets.filter((w: any) => w && typeof w.id === 'string' && (isMaster(w) || isStamp(w))) : [];
  if (!worksheets.length) return { book, assets };
  const ids = new Set(worksheets.map((w) => w.id));
  const elements: Element[] = Array.isArray(p.elements) ? p.elements.filter((e: any) => e && typeof e.id === 'string' && typeof e.type === 'string' && ids.has(e.space)) : [];
  return { book, assets, paper: { worksheets, elements, ...(typeof p.master === 'string' && ids.has(p.master) ? { master: p.master } : {}) } };
}

/** Hur många mallblad och stämplar en läst fil har. */
export function paperInFile(read: ReadBook): { masters: number; stamps: number } {
  return paperCounts({ worksheets: read.paper?.worksheets ?? [] });
}

/** Byt id:n i ett objekt (djupt), där en sträng är ett av de gamla. */
function remap(v: unknown, map: ReadonlyMap<string, string>): unknown {
  if (typeof v === 'string') return map.get(v) ?? v;
  if (Array.isArray(v)) return v.map((x) => remap(x, map));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, remap(x, map)]));
  return v;
}

/**
 * Lägg in filens bilder: en bild som redan finns (samma innehåll) används
 * igen, andra får ett nytt id om deras är upptaget. Svarar med de gamla
 * id:nas nya.
 */
function putAssets(tx: TxBuilder, assets: readonly Asset[]): Map<Id, Id> {
  const map = new Map<Id, Id>();
  for (const a of assets) {
    const same = Object.values(tx.doc.assets).find((x) => x.data === a.data && x.mime === a.mime);
    if (same) {
      map.set(a.id, same.id);
      continue;
    }
    const id = tx.doc.assets[a.id] ? newId('fil') : a.id;
    tx.putAsset({ ...a, id });
    map.set(a.id, id);
  }
  return map;
}

/**
 * Lägg in en läst stilbok i projektet, i en transaktion: stilboken ersätter
 * projektets (projektets egna linjetyper och fyllningstyper som filen saknar
 * är kvar), bilderna läggs in, logotyperna på bladen får den nya bilden och
 * de valda mallbladen och stämplarna läggs till bredvid de som finns. Med
 * `replaceMaster` (ett nytt projekt) blir filens förvalda mallblad
 * projektets, och det gamla förvalda tas bort om inget blad använder det.
 */
export function importBook(store: DocStore, read: ReadBook, choice: PaperChoice, label: string, replaceMaster = false): void {
  store.transact(label, (tx) => {
    const old = bookAssetIds(tx.doc.graphics);
    const files = putAssets(tx, read.assets);
    const book = remap(structuredClone(read.book), files) as StyleBook;
    const keep = (tx.doc.graphics.lineTypes ?? []).filter((t) => !book.lineTypes?.some((r) => r.id === t.id));
    if (keep.length) book.lineTypes = [...(book.lineTypes ?? []), ...keep];
    const keepFills = (tx.doc.graphics.fillTypes ?? []).filter((t) => !book.fillTypes?.some((r) => r.id === t.id));
    if (keepFills.length) book.fillTypes = [...(book.fillTypes ?? []), ...keepFills];
    tx.setGraphics(book);
    const paper = read.paper;
    const worksheets = (paper?.worksheets ?? []).filter((w) => (choice.masters && isMaster(w)) || (choice.stamps && isStamp(w)));
    if (worksheets.length) {
      const map = new Map(files);
      const taken = new Set(tx.doc.worksheets.map((w) => w.id));
      for (const w of worksheets) map.set(w.id, taken.has(w.id) ? newId(isStamp(w) ? 'stampel' : 'mall') : w.id);
      const chosen = new Set(worksheets.map((w) => w.id));
      const elements = paper!.elements.filter((e) => chosen.has(e.space!));
      for (const e of elements) map.set(e.id, tx.doc.elements[e.id] ? newId('el') : e.id);
      const storey = tx.doc.storeys[0].id;
      const before = tx.doc.project.master;
      // Ett namn som redan finns får *(importerat)* efter sig, så att de går att skilja åt.
      const names = new Set(tx.doc.worksheets.filter((w) => !(replaceMaster && w.id === tx.doc.project.master)).map((w) => w.name));
      const named = (w: Worksheet) => (names.has(w.name) ? `${w.name} (importerat)` : w.name);
      tx.setField('worksheets', [...tx.doc.worksheets, ...worksheets.map((w) => ({ ...structuredClone(w), id: map.get(w.id)!, name: named(w) }))]);
      for (const e of elements) tx.putElement({ ...(remap(structuredClone(e), map) as Element), storey });
      const master = paper!.master && chosen.has(paper!.master) ? map.get(paper!.master) : undefined;
      if (replaceMaster && master) {
        tx.setProject({ ...tx.doc.project, master });
        if (before && before !== master && !tx.doc.sheets.some((s) => s.master === before)) {
          for (const e of Object.values(tx.doc.elements)) if (e.space === before) tx.removeElement(e.id);
          tx.setField('worksheets', tx.doc.worksheets.filter((w) => w.id !== before));
          const tree = { ...tx.doc.tree };
          delete tree[before];
          tx.setField('tree', tree);
        }
      }
    }
    if (book.office?.logo) relinkLogos(tx, book.office.logo);
    pruneAssets(tx, old);
  });
}

/** Ett nytt projekt med stilboken ur en mall (eller en fil): papperet följer med, och mallens förvalda mallblad gäller. */
export function applyTemplate(store: DocStore, read: ReadBook): void {
  importBook(store, read, { masters: true, stamps: true }, `Stilbok ur mallen: ${read.book.name}`, true);
}
