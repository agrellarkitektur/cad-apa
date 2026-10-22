import { pruneAssets } from './commands';
import { newId } from './ids';
import type { Element, Folder, Id, Storey, TreeTab, ViewDef } from './model';
import type { DocStore, TxBuilder } from './store';

/**
 * Kommandon för projektträdet (0.8, format 5): mappar, och att spara en
 * vys, en fasads eller sektions eller en vånings inställningar på en gång.
 */

/** Skapa en mapp i en flik, eventuellt i en annan mapp. Svarar med mappens id. */
export function createFolder(store: DocStore, tab: TreeTab, name: string, parent: Id | null = null): Id {
  const id = newId('mapp');
  store.transact(`Ny mapp ${name}`, (tx) => tx.setField('folders', [...tx.doc.folders, { id, name, tab, parent }]));
  return id;
}

/** Spara en mapps namn och överordnade mapp. En mapp kan inte läggas i sig själv eller i en av sina undermappar. */
export function saveFolder(store: DocStore, id: Id, patch: { name?: string; parent?: Id | null }): void {
  const doc = store.doc;
  if (patch.parent && (patch.parent === id || descendantsOf(doc.folders, id).includes(patch.parent))) patch = { ...patch, parent: undefined };
  store.transact('Spara mappen', (tx) =>
    tx.setField(
      'folders',
      tx.doc.folders.map((f) => (f.id === id ? { ...f, ...(patch.name !== undefined ? { name: patch.name.trim() || f.name } : {}), ...(patch.parent !== undefined ? { parent: patch.parent } : {}) } : f)),
    ),
  );
}

/**
 * Ta bort en mapp. Det som låg i den, och undermapparna, flyttas upp till
 * mappen den låg i (inget annat tas bort).
 */
export function deleteFolder(store: DocStore, id: Id): void {
  const f = store.doc.folders.find((x) => x.id === id);
  if (!f) return;
  store.transact(`Ta bort mappen ${f.name}`, (tx) => {
    tx.setField(
      'folders',
      tx.doc.folders.filter((x) => x.id !== id).map((x) => (x.parent === id ? { ...x, parent: f.parent } : x)),
    );
    const tree: Record<Id, Id> = {};
    for (const [item, folder] of Object.entries(tx.doc.tree)) {
      if (folder !== id) tree[item] = folder;
      else if (f.parent) tree[item] = f.parent;
    }
    tx.setField('tree', tree);
  });
}

/** Alla mappar under en mapp, på alla nivåer. */
export function descendantsOf(folders: readonly Folder[], id: Id): Id[] {
  const out: Id[] = [];
  const walk = (p: Id) => {
    for (const f of folders) if (f.parent === p) {
      out.push(f.id);
      walk(f.id);
    }
  };
  walk(id);
  return out;
}

function placeIn(tx: TxBuilder, item: Id, folder: Id | null | undefined): void {
  if (folder === undefined) return;
  const cur = tx.doc.tree[item] ?? null;
  if (cur === folder) return;
  const tree = { ...tx.doc.tree };
  if (folder) tree[item] = folder;
  else delete tree[item];
  tx.setField('tree', tree);
}

/** Lägg något i en mapp, eller utanför alla mappar (null). */
export function moveToFolder(store: DocStore, item: Id, folder: Id | null): void {
  store.transact('Flytta till mapp', (tx) => placeIn(tx, item, folder));
}

/** Spara en vys inställningar och mapp i ett steg. */
export function saveView(store: DocStore, id: Id, patch: Partial<Omit<ViewDef, 'id'>>, folder?: Id | null): void {
  const v = store.doc.views.find((x) => x.id === id);
  if (!v) return;
  store.transact(`Spara vyn ${patch.name ?? v.name}`, (tx) => {
    const next: ViewDef = { ...v, ...patch };
    if (!next.tags?.length) delete next.tags;
    if (!next.scale) delete next.scale;
    tx.setViews(tx.doc.views.map((x) => (x.id === id ? next : x)));
    // Nya vy-taggar läggs till i projektets lista i samma steg.
    const fresh = (next.tags ?? []).filter((t) => !tx.doc.viewTags.includes(t));
    if (fresh.length) tx.setField('viewTags', [...tx.doc.viewTags, ...fresh]);
    placeIn(tx, id, folder);
  });
}

/** Spara en fasads eller sektions namn, parametrar, lås och mapp i ett steg. */
export function saveMarker(store: DocStore, id: Id, patch: { name?: string; params?: Record<string, unknown>; locked?: boolean }, folder?: Id | null): void {
  const el = store.doc.elements[id];
  if (!el) return;
  store.transact('Spara', (tx) => {
    const next: Element = { ...el, params: { ...el.params, ...(patch.params ?? {}) } };
    if (patch.name !== undefined) next.name = patch.name.trim() || undefined;
    if (patch.locked !== undefined) {
      if (patch.locked) next.locked = true;
      else delete next.locked;
    }
    tx.putElement(next);
    placeIn(tx, id, folder);
  });
}

/** Spara en vånings namn, nivå, höjd och mapp i ett steg. */
export function saveStorey(store: DocStore, id: Id, patch: Partial<Omit<Storey, 'id'>>, folder?: Id | null): void {
  const s = store.doc.storeys.find((x) => x.id === id);
  if (!s) return;
  store.transact(`Spara ${patch.name ?? s.name}`, (tx) => {
    tx.setStoreys(tx.doc.storeys.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    placeIn(tx, id, folder);
  });
}

/** Skapa ett arbetsblad (0.8 del 2), eventuellt i en mapp. Svarar med dess id. */
export function createWorksheet(store: DocStore, name: string, folder: Id | null = null): Id {
  const id = newId('ab');
  store.transact(`Nytt arbetsblad ${name}`, (tx) => {
    tx.setField('worksheets', [...tx.doc.worksheets, { id, name }]);
    placeIn(tx, id, folder);
  });
  return id;
}

/** Spara ett arbetsblads namn och mapp i ett steg. */
export function saveWorksheet(store: DocStore, id: Id, patch: { name?: string }, folder?: Id | null): void {
  const w = store.doc.worksheets.find((x) => x.id === id);
  if (!w) return;
  store.transact(`Spara ${patch.name?.trim() || w.name}`, (tx) => {
    tx.setField('worksheets', tx.doc.worksheets.map((x) => (x.id === id ? { ...x, name: patch.name?.trim() || x.name } : x)));
    placeIn(tx, id, folder);
  });
}

/** Det som är ritat på ett arbetsblad. */
export function worksheetContents(doc: { elements: Record<Id, Element> }, id: Id): Element[] {
  return Object.values(doc.elements).filter((e) => e.space === id);
}

/**
 * Ta bort ett arbetsblad eller mallblad med allt som är ritat på det och
 * vyerna av det. Underlagens filer tas bort om inget annat använder dem;
 * blad som använde mallbladet blir utan mall. Går att ångra.
 */
export function deleteWorksheet(store: DocStore, id: Id): void {
  const w = store.doc.worksheets.find((x) => x.id === id);
  if (!w) return;
  store.transact(`Ta bort ${w.stamp ? 'stämpeln' : w.paper ? 'mallbladet' : 'arbetsbladet'} ${w.name}`, (tx) => {
    const files = new Set<Id>();
    for (const el of worksheetContents(tx.doc, id)) {
      if (typeof el.params.asset === 'string') files.add(el.params.asset);
      tx.removeElement(el.id);
    }
    pruneAssets(tx, files);
    // En stämpel (0.8.12): den tas bort från bladen den ligger på.
    if (w.stamp) for (const el of Object.values(tx.doc.elements)) if (el.type === 'Stamp' && el.params.stamp === id) tx.removeElement(el.id);
    const views = tx.doc.views.filter((v) => v.worksheet === id);
    if (views.length) tx.setViews(tx.doc.views.filter((v) => v.worksheet !== id));
    tx.setField('worksheets', tx.doc.worksheets.filter((x) => x.id !== id));
    // Ett mallblad (0.8.8): bladen som använde det blir utan mall.
    if (tx.doc.sheets.some((s) => s.master === id)) tx.setField('sheets', tx.doc.sheets.map((s) => (s.master === id ? (({ master: _, ...rest }) => rest)(s) : s)));
    if (tx.doc.project.master === id) {
      const { master: _, ...project } = tx.doc.project;
      tx.setProject(project);
    }
    const tree = { ...tx.doc.tree };
    for (const k of [id, ...views.map((v) => v.id)]) delete tree[k];
    tx.setField('tree', tree);
  });
}
