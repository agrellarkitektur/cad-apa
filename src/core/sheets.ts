import { pruneAssets } from './commands';
import { newId } from './ids';
import { isMaster, type Element, type Id, type PaperSize, type ProjectDoc, type Sheet, type Viewport, type Worksheet } from './model';
import type { DocStore, TxBuilder } from './store';

/**
 * Ritningsblad (0.8 del 3, format 9): kommandon för blad, vyerna på
 * bladen, mallbladen (0.8.8) och projektets fält för smarttexten. Måtten på
 * bladen är i mm på papperet. Det som är ritat på ett blad (0.8.9) är
 * vanliga element med `space` satt till bladets id.
 */

/** Pappersformaten liggande, bredd × höjd i mm. */
export const PAPER: Record<PaperSize, readonly [number, number]> = {
  A4: [297, 210],
  A3: [420, 297],
  A2: [594, 420],
  A1: [841, 594],
  A0: [1189, 841],
};

export const PAPER_SIZES = Object.keys(PAPER) as PaperSize[];

/** Bladets (eller mallbladets) storlek i mm, efter format och orientering. */
export function paperSize(s: Pick<Sheet, 'size' | 'orientation'>): [number, number] {
  const [w, h] = PAPER[s.size] ?? PAPER.A3;
  return s.orientation === 'portrait' ? [h, w] : [w, h];
}

/**
 * Den vanliga ritningsramens marginaler: 20 mm till vänster för inbindning,
 * 10 mm i övrigt. Ramen ritas i mallbladet (0.8.8); marginalerna avgör var
 * nya vyer läggs och vad flyttade saker fäster mot.
 */
export const FRAME_MARGIN = { left: 20, right: 10, top: 10, bottom: 10 } as const;

/** Fält som hör till bladet, för smarttexten i mallen, med förval. */
export const SHEET_FIELDS: { key: string; label: string; placeholder?: string }[] = [
  { key: 'skede', label: 'Skede', placeholder: 'BYGGLOVSHANDLING' },
  { key: 'datum', label: 'Datum' },
  { key: 'andring', label: 'Ändring', placeholder: '–' },
  { key: 'ritat', label: 'Ritat av' },
  { key: 'granskat', label: 'Granskat av' },
  { key: 'skala', label: 'Skala', placeholder: '{skala}' },
];

/** Fält som gäller alla blad i projektet (`project.fields`), för smarttexten i mallen. */
export const PROJECT_FIELDS: { key: string; label: string }[] = [
  { key: 'adress', label: 'Adress' },
  { key: 'fastighet', label: 'Fastighetsbeteckning' },
  { key: 'bestallare', label: 'Beställare' },
  { key: 'uppdragsnummer', label: 'Uppdragsnummer' },
  { key: 'arkitekt', label: 'Arkitekt (företag)' },
  { key: 'ansvarig', label: 'Ansvarig' },
];

/** Nästa lediga ritningsnummer efter det senaste bladet: A-101, A-102 … eller A-40.1-09, A-40.1-10 … */
export function nextSheetNumber(doc: Pick<ProjectDoc, 'sheets'>): string {
  const used = new Set(doc.sheets.map((s) => s.number.trim()));
  const m = [...doc.sheets]
    .reverse()
    .map((s) => /^(.*?)(\d+)$/.exec(s.number.trim()))
    .find(Boolean);
  const prefix = m ? m[1] : 'A-';
  const width = m ? m[2].length : 3;
  let n = m ? Number(m[2]) + 1 : 101;
  while (used.has(`${prefix}${String(n).padStart(width, '0')}`)) n++;
  return `${prefix}${String(n).padStart(width, '0')}`;
}

/** Dagens datum som i ritningshuvuden: 2026-10-20. */
export function today(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function placeIn(tx: TxBuilder, item: Id, folder: Id | null | undefined): void {
  if (folder === undefined) return;
  const tree = { ...tx.doc.tree };
  if (folder) tree[item] = folder;
  else delete tree[item];
  tx.setField('tree', tree);
}

/** Mallbladet ett blad använder, om det finns. */
export function masterOf(doc: Pick<ProjectDoc, 'worksheets'>, sheet: Pick<Sheet, 'master'>): (Worksheet & { paper: NonNullable<Worksheet['paper']> }) | undefined {
  const w = sheet.master ? doc.worksheets.find((x) => x.id === sheet.master) : undefined;
  return isMaster(w) ? w : undefined;
}

/** Projektets mallblad, i den ordning de skapades. */
export function mastersOf(doc: Pick<ProjectDoc, 'worksheets'>): (Worksheet & { paper: NonNullable<Worksheet['paper']> })[] {
  return doc.worksheets.filter(isMaster);
}

/**
 * Skapa ett ritningsblad (0.8.8): det får projektets förvalda mallblad och
 * mallens format, om inget annat anges. Svarar med bladets id.
 */
export function createSheet(store: DocStore, init: Partial<Omit<Sheet, 'id' | 'viewports'>> = {}, folder: Id | null = null): Id {
  const id = newId('blad');
  const doc = store.doc;
  const master = masterOf(doc, { master: 'master' in init ? init.master : doc.project.master });
  const sheet: Sheet = {
    id,
    number: init.number ?? nextSheetNumber(doc),
    name: init.name ?? 'Nytt blad',
    size: init.size ?? master?.paper.size ?? 'A3',
    orientation: init.orientation ?? master?.paper.orientation ?? 'landscape',
    ...(master ? { master: master.id } : {}),
    fields: { datum: today(), ...(init.fields ?? {}) },
    viewports: [],
  };
  store.transact(`Nytt blad ${sheet.number}`, (tx) => {
    tx.setField('sheets', [...tx.doc.sheets, sheet]);
    if (folder) placeIn(tx, id, folder);
  });
  return id;
}

/** Skapa ett mallblad (0.8.8), eventuellt i en mapp i Ritningar. Svarar med dess id. */
export function createMaster(store: DocStore, init: { name: string; size?: PaperSize; orientation?: 'landscape' | 'portrait' }, folder: Id | null = null): Id {
  const id = newId('mall');
  const w: Worksheet = { id, name: init.name, paper: { size: init.size ?? 'A3', orientation: init.orientation ?? 'landscape' } };
  store.transact(`Nytt mallblad ${init.name}`, (tx) => {
    tx.setField('worksheets', [...tx.doc.worksheets, w]);
    placeIn(tx, id, folder);
  });
  return id;
}

/** Spara ett mallblads namn, format, orientering och mapp i ett steg. */
export function saveMaster(store: DocStore, id: Id, patch: { name?: string; size?: PaperSize; orientation?: 'landscape' | 'portrait' }, folder?: Id | null): void {
  const w = store.doc.worksheets.find((x) => x.id === id);
  if (!isMaster(w)) return;
  store.transact(`Spara mallbladet ${patch.name?.trim() || w.name}`, (tx) => {
    tx.setField(
      'worksheets',
      tx.doc.worksheets.map((x) => (x.id === id && x.paper ? { ...x, name: patch.name?.trim() || x.name, paper: { size: patch.size ?? x.paper.size, orientation: patch.orientation ?? x.paper.orientation } } : x)),
    );
    placeIn(tx, id, folder);
  });
}

/** Välj mallbladet som nya blad får, eller inget (null). */
export function setDefaultMaster(store: DocStore, id: Id | null): void {
  if (id && !isMaster(store.doc.worksheets.find((w) => w.id === id))) return;
  store.transact(id ? 'Förvalt mallblad' : 'Inget förvalt mallblad', (tx) => {
    const p = { ...tx.doc.project };
    if (id) p.master = id;
    else delete p.master;
    tx.setProject(p);
  });
}

function updateSheet(tx: TxBuilder, id: Id, fn: (s: Sheet) => Sheet): void {
  tx.setField(
    'sheets',
    tx.doc.sheets.map((s) => (s.id === id ? fn(s) : s)),
  );
}

/** Spara bladets nummer, namn, format, mallblad, fält och mapp i ett steg. Tomma fält tas bort; `master: undefined` tar bort mallen. */
export function saveSheet(store: DocStore, id: Id, patch: Partial<Omit<Sheet, 'id' | 'viewports'>>, folder?: Id | null): void {
  const s = store.doc.sheets.find((x) => x.id === id);
  if (!s) return;
  store.transact(`Spara bladet ${patch.number?.trim() || s.number}`, (tx) => {
    updateSheet(tx, id, (x) => {
      const next: Sheet = { ...x, ...patch };
      if (!next.master) delete next.master;
      next.number = (patch.number ?? x.number).trim() || x.number;
      next.name = (patch.name ?? x.name).trim() || x.name;
      if (patch.fields) next.fields = Object.fromEntries(Object.entries(patch.fields).filter(([, v]) => v.trim() !== ''));
      return next;
    });
    placeIn(tx, id, folder);
  });
}

/** Det som är ritat direkt på ett blad (0.8.9). */
export function sheetContents(doc: Pick<ProjectDoc, 'elements'>, id: Id): Element[] {
  return Object.values(doc.elements).filter((e) => e.space === id);
}

/** Ta bort ett blad med det som är ritat på det. Vyerna på det finns kvar i projektet. Går att ångra. */
export function deleteSheet(store: DocStore, id: Id): void {
  const s = store.doc.sheets.find((x) => x.id === id);
  if (!s) return;
  store.transact(`Ta bort bladet ${s.number}`, (tx) => {
    const files = new Set<Id>();
    for (const el of sheetContents(tx.doc, id)) {
      if (typeof el.params.asset === 'string') files.add(el.params.asset);
      tx.removeElement(el.id);
    }
    pruneAssets(tx, files);
    tx.setField('sheets', tx.doc.sheets.filter((x) => x.id !== id));
    if (tx.doc.tree[id]) {
      const tree = { ...tx.doc.tree };
      delete tree[id];
      tx.setField('tree', tree);
    }
  });
}

/** Duplicera ett blad med vyerna och det som är ritat på det. Svarar med kopians id. */
export function duplicateSheet(store: DocStore, id: Id): Id | null {
  const s = store.doc.sheets.find((x) => x.id === id);
  if (!s) return null;
  const copy: Sheet = {
    ...structuredClone(s),
    id: newId('blad'),
    number: nextSheetNumber(store.doc),
    viewports: s.viewports.map((v) => ({ ...v, id: newId('vp') })),
  };
  store.transact(`Duplicera bladet ${s.number}`, (tx) => {
    tx.setField('sheets', [...tx.doc.sheets, copy]);
    for (const el of sheetContents(tx.doc, id)) tx.putElement({ ...structuredClone(el), id: newId('el'), space: copy.id });
    if (tx.doc.tree[id]) placeIn(tx, copy.id, tx.doc.tree[id]);
  });
  return copy.id;
}

/**
 * Lägg en vy på ett blad. `view` är en sparad vys id eller modellvyn av en
 * våning, fasad, sektion eller ett arbetsblad (`modelViewId`). `at` är var
 * vyns nollpunkt hamnar på papperet. Svarar med vyns id på bladet.
 */
export function addViewport(store: DocStore, sheetId: Id, vp: Omit<Viewport, 'id'>): Id | null {
  if (!store.doc.sheets.some((x) => x.id === sheetId)) return null;
  const id = newId('vp');
  store.transact('Lägg vyn på bladet', (tx) => updateSheet(tx, sheetId, (s) => ({ ...s, viewports: [...s.viewports, { ...vp, id }] })));
  return id;
}

/**
 * Ändra en vy på ett blad: läge, skala, rubrik eller ram. En tom rubrik
 * betyder vyns namn; `crop: undefined` låter ramen följa innehållet.
 */
export function updateViewport(store: DocStore, sheetId: Id, vpId: Id, patch: Partial<Omit<Viewport, 'id'>>, label = 'Ändra vyn på bladet'): void {
  const s = store.doc.sheets.find((x) => x.id === sheetId);
  if (!s?.viewports.some((v) => v.id === vpId)) return;
  store.transact(label, (tx) =>
    updateSheet(tx, sheetId, (x) => ({
      ...x,
      viewports: x.viewports.map((v) => {
        if (v.id !== vpId) return v;
        const next: Viewport = { ...v, ...patch };
        if (!next.title?.trim()) delete next.title;
        if (!next.hideScale) delete next.hideScale;
        if (!next.crop) delete next.crop;
        return next;
      }),
    })),
  );
}

/** Byt vyns ram (i modellens koordinater), eller återställ den till innehållet med null (0.8.7). */
export function setViewportCrop(store: DocStore, sheetId: Id, vpId: Id, crop: Viewport['crop'] | null): void {
  const r = (x: number) => Math.round(x);
  const c = crop ? { minX: r(Math.min(crop.minX, crop.maxX)), minY: r(Math.min(crop.minY, crop.maxY)), maxX: r(Math.max(crop.minX, crop.maxX)), maxY: r(Math.max(crop.minY, crop.maxY)) } : undefined;
  updateViewport(store, sheetId, vpId, { crop: c }, c ? 'Ändra vyns ram' : 'Återställ vyns ram till innehållet');
}

/** Ta bort en vy från ett blad (vyn finns kvar i projektet). */
export function removeViewport(store: DocStore, sheetId: Id, vpId: Id): void {
  store.transact('Ta bort vyn från bladet', (tx) => updateSheet(tx, sheetId, (s) => ({ ...s, viewports: s.viewports.filter((v) => v.id !== vpId) })));
}

/** Texthöjderna att välja för text på ett blad, mm på papperet (som SS-EN ISO 3098). */
export const SHEET_TEXT_HEIGHTS = [1.8, 2.5, 3.5, 5, 7, 10];

/**
 * Flytta vyer på bladen i en pågående transaktion (0.8.9): de vyer bland
 * `ids` som finns, `d` i mm, avrundat till 0,1 mm. Används av
 * `moveElements`, så att vyer och ritade objekt flyttas i ett steg.
 */
export function moveViewportsTx(tx: TxBuilder, ids: ReadonlySet<Id>, d: readonly [number, number]): void {
  if (!tx.doc.sheets.some((s) => s.viewports.some((v) => ids.has(v.id)))) return;
  const r = (x: number) => Math.round(x * 10) / 10;
  tx.setField(
    'sheets',
    tx.doc.sheets.map((s) => (s.viewports.some((v) => ids.has(v.id)) ? { ...s, viewports: s.viewports.map((v) => (ids.has(v.id) ? { ...v, at: [r(v.at[0] + d[0]), r(v.at[1] + d[1])] as [number, number] } : v)) } : s)),
  );
}

/** Flytta vyer på ett blad i ett steg. `d` är förflyttningen i mm. */
export function moveOnSheet(store: DocStore, ids: readonly Id[], d: readonly [number, number], label = 'Flytta vyn på bladet'): void {
  if (!ids.length || (d[0] === 0 && d[1] === 0)) return;
  store.transact(label, (tx) => moveViewportsTx(tx, new Set(ids), d));
}

/** Ta bort vyer från bladen i en pågående transaktion (vyerna finns kvar i projektet). */
export function removeViewportsTx(tx: TxBuilder, ids: ReadonlySet<Id>): void {
  if (!tx.doc.sheets.some((s) => s.viewports.some((v) => ids.has(v.id)))) return;
  tx.setField(
    'sheets',
    tx.doc.sheets.map((s) => (s.viewports.some((v) => ids.has(v.id)) ? { ...s, viewports: s.viewports.filter((v) => !ids.has(v.id)) } : s)),
  );
}

/** Om ett id är en vy på något blad. */
export function isViewportId(doc: Pick<ProjectDoc, 'sheets'>, id: Id): boolean {
  return doc.sheets.some((s) => s.viewports.some((v) => v.id === id));
}

/** Det blad en vy på ett blad ligger på. */
export function sheetOfViewport(doc: Pick<ProjectDoc, 'sheets'>, vpId: Id): Sheet | undefined {
  return doc.sheets.find((s) => s.viewports.some((v) => v.id === vpId));
}

/** Spara projektets fält (gäller alla blad) och projektnamnet. Tomma fält tas bort. */
export function saveProjectFields(store: DocStore, fields: Record<string, string>, name?: string): void {
  store.transact('Spara projektets fält', (tx) => {
    const p = tx.doc.project;
    const next = { ...p.fields };
    for (const [k, v] of Object.entries(fields)) {
      if (v.trim()) next[k] = v.trim();
      else delete next[k];
    }
    tx.setProject({ ...p, ...(name?.trim() ? { name: name.trim() } : {}), fields: next });
  });
}
