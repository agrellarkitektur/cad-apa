import { writeZip } from '../../formats/zip';
import { saveBlobFile } from '../../storage/projectFile';

/**
 * Vart exporten skrivs (0.12): direkt i en vald mapp på datorn (Chrome och
 * Edge, File System Access API), så att en leverans hamnar i projektmappen
 * utan zip, eller som en zipfil. Mappen kommer ihåg sig per projekt i
 * webbläsarens IndexedDB; Chrome frågar om lov igen när sidan laddats om.
 */

export interface OutFile {
  /** Sökvägen i mappen eller zipfilen, med undermappar, t.ex. `PDF/A-40-1-101.pdf`. */
  path: string;
  data: Uint8Array;
  /** Jobbets sökväg före *(2)* (förhandslistans storlekar). */
  job?: string;
}

type DirHandle = FileSystemDirectoryHandle & {
  queryPermission?: (o: { mode: 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (o: { mode: 'readwrite' }) => Promise<PermissionState>;
};

/** Om webbläsaren kan skriva i en vald mapp. */
export const canPickFolder = (): boolean => typeof (window as any).showDirectoryPicker === 'function';

const DB = 'bacchus-export';
const STORE = 'folders';

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  try {
    const d = await db();
    return await new Promise<T>((resolve, reject) => {
      const req = fn(d.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return undefined;
  }
}

/** Mappen som valdes senast för projektet, eller null. */
export async function rememberedFolder(project: string): Promise<DirHandle | null> {
  return ((await idb<DirHandle>('readonly', (s) => s.get(project))) as DirHandle | undefined) ?? null;
}

/**
 * Mappen att skriva i: den som kommer ihåg sig (efter lov), eller en ny som
 * väljs. Null om man avbryter eller lov inte ges.
 */
export async function folderFor(project: string, pickNew: boolean): Promise<DirHandle | null> {
  const old = pickNew ? null : await rememberedFolder(project);
  if (old) {
    const ok = (await old.queryPermission?.({ mode: 'readwrite' })) === 'granted' || (await old.requestPermission?.({ mode: 'readwrite' }).catch(() => 'denied')) === 'granted';
    if (ok) return old;
  }
  try {
    const picked = (await (window as any).showDirectoryPicker({ id: 'cad-apa-export', mode: 'readwrite', ...(old ? { startIn: old } : {}) })) as DirHandle;
    await idb('readwrite', (s) => s.put(picked, project));
    return picked;
  } catch {
    return null;
  }
}

/** Skriv filerna i mappen, med undermapparna. Svarar med antalet skrivna. */
export async function writeToFolder(dir: FileSystemDirectoryHandle, files: readonly OutFile[]): Promise<number> {
  let n = 0;
  for (const f of files) {
    const parts = f.path.split('/');
    let d = dir;
    for (const p of parts.slice(0, -1)) d = await d.getDirectoryHandle(p, { create: true });
    const h = await d.getFileHandle(parts[parts.length - 1], { create: true });
    const w = await h.createWritable();
    await w.write(f.data as Uint8Array<ArrayBuffer>);
    await w.close();
    n++;
  }
  return n;
}

/**
 * Filerna i en zipfil. Tidsstämpeln är dagens datum klockan 00.00, så att
 * samma export samma dag ger samma bytes.
 */
export function zipFiles(files: readonly OutFile[], day: string): Uint8Array {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y || 2026, (m || 1) - 1, d || 1);
  return writeZip(files.map((f) => ({ name: f.path, data: f.data, date })));
}

export async function saveZip(files: readonly OutFile[], name: string, day: string): Promise<'saved' | 'downloaded' | 'cancelled'> {
  const zip = zipFiles(files, day);
  return saveBlobFile(new Blob([zip as Uint8Array<ArrayBuffer>], { type: 'application/zip' }), name, 'Zipfil', { 'application/zip': ['.zip'] });
}

/** En fil sparas för sig (när exporten bara blev en fil och mappen inte används). */
export async function saveOne(file: OutFile, mime: string): Promise<'saved' | 'downloaded' | 'cancelled'> {
  const name = file.path.split('/').pop()!;
  const ext = name.slice(name.lastIndexOf('.'));
  return saveBlobFile(new Blob([file.data as Uint8Array<ArrayBuffer>], { type: mime }), name, ext.slice(1).toUpperCase(), { [mime]: [ext] });
}
