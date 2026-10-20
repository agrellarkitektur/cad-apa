import { newId } from './ids';
import type { Id, PaperSize, ProjectDoc, Sheet, SheetTextItem, TitleBlockItem, Viewport } from './model';
import type { DocStore, TxBuilder } from './store';

/**
 * Ritningsblad (0.8 del 3, format 6): kommandon för blad, vyerna och
 * ritningshuvudena på bladen (0.8.6) och projektets fält i ritningshuvudet.
 * Måtten på bladen är i mm på papperet.
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

/** Bladets storlek i mm, efter format och orientering. */
export function paperSize(s: Pick<Sheet, 'size' | 'orientation'>): [number, number] {
  const [w, h] = PAPER[s.size] ?? PAPER.A3;
  return s.orientation === 'portrait' ? [h, w] : [w, h];
}

/** Marginalerna till ritningsramen: 20 mm till vänster för inbindning, 10 mm i övrigt. */
export const FRAME_MARGIN = { left: 20, right: 10, top: 10, bottom: 10 } as const;

/** Var ett nytt ritningshuvud hamnar: i ritningsramens nedre högra hörn. */
export const TITLE_BLOCK_AT: [number, number] = [-FRAME_MARGIN.right, FRAME_MARGIN.bottom];

/** Mallarna för ritningshuvuden att lägga på ett blad. */
export const TITLE_BLOCK_TEMPLATES: { id: 'bh90'; name: string; note: string }[] = [{ id: 'bh90', name: 'BH90', note: '180 mm brett, så att ett vikt blad blir A4' }];

/** Ett ritningshuvuds nedre högra hörn på papperet, mm från papperets nedre vänstra hörn. */
export function itemCorner(sheet: Pick<Sheet, 'size' | 'orientation'>, item: Pick<TitleBlockItem, 'at'>): [number, number] {
  const [w] = paperSize(sheet);
  return [w + item.at[0], item.at[1]];
}

/** Fält i ritningshuvudet som hör till bladet, med förval. */
export const SHEET_FIELDS: { key: string; label: string; placeholder?: string }[] = [
  { key: 'skede', label: 'Skede', placeholder: 'BYGGLOVSHANDLING' },
  { key: 'datum', label: 'Datum' },
  { key: 'andring', label: 'Ändring', placeholder: '–' },
  { key: 'ritat', label: 'Ritat av' },
  { key: 'granskat', label: 'Granskat av' },
  { key: 'skala', label: 'Skala', placeholder: '{skala}' },
];

/** Fält i ritningshuvudet som gäller alla blad i projektet (`project.fields`). */
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

/**
 * Skapa ett ritningsblad, blankt med ritningsram (0.8.6). `titleBlock` lägger
 * ett BH90-huvud i ramens hörn. Svarar med bladets id.
 */
export function createSheet(
  store: DocStore,
  init: Partial<Omit<Sheet, 'id' | 'viewports' | 'items'>> & { titleBlock?: boolean } = {},
  folder: Id | null = null,
): Id {
  const id = newId('blad');
  const sheet: Sheet = {
    id,
    number: init.number ?? nextSheetNumber(store.doc),
    name: init.name ?? 'Nytt blad',
    size: init.size ?? 'A3',
    orientation: init.orientation ?? 'landscape',
    frame: init.frame ?? true,
    fields: { datum: today(), ...(init.fields ?? {}) },
    viewports: [],
    items: init.titleBlock ? [{ kind: 'titleBlock', id: newId('huvud'), template: 'bh90', at: [...TITLE_BLOCK_AT] }] : [],
  };
  store.transact(`Nytt blad ${sheet.number}`, (tx) => {
    tx.setField('sheets', [...tx.doc.sheets, sheet]);
    if (folder) placeIn(tx, id, folder);
  });
  return id;
}

function updateSheet(tx: TxBuilder, id: Id, fn: (s: Sheet) => Sheet): void {
  tx.setField(
    'sheets',
    tx.doc.sheets.map((s) => (s.id === id ? fn(s) : s)),
  );
}

/** Spara bladets nummer, namn, format, fält och mapp i ett steg. Tomma fält tas bort. */
export function saveSheet(store: DocStore, id: Id, patch: Partial<Omit<Sheet, 'id' | 'viewports' | 'items'>>, folder?: Id | null): void {
  const s = store.doc.sheets.find((x) => x.id === id);
  if (!s) return;
  store.transact(`Spara bladet ${patch.number?.trim() || s.number}`, (tx) => {
    updateSheet(tx, id, (x) => {
      const next: Sheet = { ...x, ...patch };
      next.number = (patch.number ?? x.number).trim() || x.number;
      next.name = (patch.name ?? x.name).trim() || x.name;
      if (patch.fields) next.fields = Object.fromEntries(Object.entries(patch.fields).filter(([, v]) => v.trim() !== ''));
      return next;
    });
    placeIn(tx, id, folder);
  });
}

/** Ta bort ett blad. Vyerna på det finns kvar i projektet. Går att ångra. */
export function deleteSheet(store: DocStore, id: Id): void {
  const s = store.doc.sheets.find((x) => x.id === id);
  if (!s) return;
  store.transact(`Ta bort bladet ${s.number}`, (tx) => {
    tx.setField('sheets', tx.doc.sheets.filter((x) => x.id !== id));
    if (tx.doc.tree[id]) {
      const tree = { ...tx.doc.tree };
      delete tree[id];
      tx.setField('tree', tree);
    }
  });
}

/** Duplicera ett blad med vyerna på det. Svarar med kopians id. */
export function duplicateSheet(store: DocStore, id: Id): Id | null {
  const s = store.doc.sheets.find((x) => x.id === id);
  if (!s) return null;
  const copy: Sheet = {
    ...structuredClone(s),
    id: newId('blad'),
    number: nextSheetNumber(store.doc),
    viewports: s.viewports.map((v) => ({ ...v, id: newId('vp') })),
    items: s.items.map((x) => ({ ...structuredClone(x), id: newId(x.kind === 'text' ? 'text' : 'huvud') })),
  };
  store.transact(`Duplicera bladet ${s.number}`, (tx) => {
    tx.setField('sheets', [...tx.doc.sheets, copy]);
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

/** Lägg ett ritningshuvud på ett blad, i ramens hörn om inget läge anges. Svarar med dess id. */
export function addTitleBlock(store: DocStore, sheetId: Id, at: [number, number] = TITLE_BLOCK_AT): Id | null {
  if (!store.doc.sheets.some((x) => x.id === sheetId)) return null;
  const id = newId('huvud');
  store.transact('Lägg på ritningshuvud', (tx) =>
    updateSheet(tx, sheetId, (s) => ({ ...s, items: [...s.items, { kind: 'titleBlock', id, template: 'bh90', at: [at[0], at[1]] }] })),
  );
  return id;
}

/** Texthöjderna att välja för text på ett blad, mm på papperet (som SS-EN ISO 3098). */
export const SHEET_TEXT_HEIGHTS = [1.8, 2.5, 3.5, 5, 7, 10];

/** Lägg en text på ett blad (0.8.7). `at` är första radens baslinje till vänster, mm på papperet. Svarar med dess id. */
export function addSheetText(store: DocStore, sheetId: Id, init: Omit<SheetTextItem, 'kind' | 'id'>): Id | null {
  if (!store.doc.sheets.some((x) => x.id === sheetId) || !init.text.trim()) return null;
  const id = newId('text');
  const r = (x: number) => Math.round(x * 10) / 10;
  const item: SheetTextItem = { kind: 'text', id, at: [r(init.at[0]), r(init.at[1])], text: init.text, height: init.height, ...(init.bold ? { bold: true } : {}) };
  store.transact('Skriv text på bladet', (tx) => updateSheet(tx, sheetId, (s) => ({ ...s, items: [...s.items, item] })));
  return id;
}

/** Ändra en text på ett blad: text, höjd eller fet stil. En tom text tar bort den. */
export function updateSheetText(store: DocStore, itemId: Id, patch: Partial<Pick<SheetTextItem, 'text' | 'height' | 'bold'>>, label = 'Ändra texten på bladet'): void {
  const s = sheetOfItem(store.doc, itemId);
  if (!s) return;
  if (patch.text !== undefined && !patch.text.trim()) {
    removeFromSheet(store, s.id, [itemId]);
    return;
  }
  store.transact(label, (tx) =>
    updateSheet(tx, s.id, (x) => ({
      ...x,
      items: x.items.map((i) => {
        if (i.id !== itemId || i.kind !== 'text') return i;
        const next: SheetTextItem = { ...i, ...patch };
        if (!next.bold) delete next.bold;
        return next;
      }),
    })),
  );
}

/** Flytta saker på ett blad: ritningshuvuden och vyer, i ett steg. `d` är förflyttningen i mm. */
export function moveOnSheet(store: DocStore, sheetId: Id, ids: readonly Id[], d: readonly [number, number], label = 'Flytta på bladet'): void {
  const s = store.doc.sheets.find((x) => x.id === sheetId);
  if (!s || !ids.length || (d[0] === 0 && d[1] === 0)) return;
  const set = new Set(ids);
  const r = (x: number) => Math.round(x * 10) / 10;
  const by = (p: [number, number]): [number, number] => [r(p[0] + d[0]), r(p[1] + d[1])];
  store.transact(label, (tx) =>
    updateSheet(tx, sheetId, (x) => ({
      ...x,
      viewports: x.viewports.map((v) => (set.has(v.id) ? { ...v, at: by(v.at) } : v)),
      items: x.items.map((i) => (set.has(i.id) ? { ...i, at: by(i.at) } : i)),
    })),
  );
}

/** Ta bort saker från ett blad: ritningshuvuden och vyer (vyerna finns kvar i projektet). */
export function removeFromSheet(store: DocStore, sheetId: Id, ids: readonly Id[]): void {
  const set = new Set(ids);
  const s = store.doc.sheets.find((x) => x.id === sheetId);
  if (!s) return;
  const hit = s.items.filter((i) => set.has(i.id));
  const label = hit.length === ids.length && hit.every((i) => i.kind === 'titleBlock') ? 'Ta bort ritningshuvudet' : hit.length === ids.length && hit.every((i) => i.kind === 'text') ? 'Ta bort texten' : 'Ta bort från bladet';
  store.transact(label, (tx) =>
    updateSheet(tx, sheetId, (x) => ({ ...x, viewports: x.viewports.filter((v) => !set.has(v.id)), items: x.items.filter((i) => !set.has(i.id)) })),
  );
}

/** Det blad en sak på ett blad (ett ritningshuvud eller en text) ligger på. */
export function sheetOfItem(doc: Pick<ProjectDoc, 'sheets'>, itemId: Id): Sheet | undefined {
  return doc.sheets.find((s) => s.items.some((i) => i.id === itemId));
}

/** Det blad en vy på ett blad ligger på. */
export function sheetOfViewport(doc: Pick<ProjectDoc, 'sheets'>, vpId: Id): Sheet | undefined {
  return doc.sheets.find((s) => s.viewports.some((v) => v.id === vpId));
}

/**
 * Spara projektets fält i ritningshuvudet (gäller alla blad), och
 * projektnamnet. Tomma fält tas bort; loggan och dess proportioner lämnas
 * orörda om de inte ingår.
 */
export function saveProjectFields(store: DocStore, fields: Record<string, string>, name?: string): void {
  store.transact('Spara ritningshuvudet', (tx) => {
    const p = tx.doc.project;
    const next = { ...p.fields };
    for (const [k, v] of Object.entries(fields)) {
      if (v.trim()) next[k] = v.trim();
      else delete next[k];
    }
    tx.setProject({ ...p, ...(name?.trim() ? { name: name.trim() } : {}), fields: next });
  });
}

/** Byt eller ta bort loggan i ritningshuvudet. `ratio` är bredd genom höjd. */
export function setLogo(store: DocStore, logo: { id: Id; name: string; mime: string; data: string; ratio: number } | null): void {
  store.transact(logo ? 'Byt logga' : 'Ta bort loggan', (tx) => {
    const p = tx.doc.project;
    const old = p.fields.logo;
    const fields = { ...p.fields };
    if (logo) {
      tx.putAsset({ id: logo.id, name: logo.name, mime: logo.mime, data: logo.data });
      fields.logo = logo.id;
      fields.logoRatio = String(Math.round(logo.ratio * 1000) / 1000);
    } else {
      delete fields.logo;
      delete fields.logoRatio;
    }
    tx.setProject({ ...p, fields });
    // Den gamla filen tas bort om inget underlag använder den.
    if (old && old !== logo?.id && !Object.values(tx.doc.elements).some((e) => e.params.asset === old)) tx.removeAsset(old);
  });
}
