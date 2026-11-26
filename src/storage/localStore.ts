// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Carl August Agrell / Agrell Arkitektur
/**
 * Autospar i webbläsarens IndexedDB. Fungerar i alla moderna webbläsare och
 * offline. Allt är inslaget i try/catch: om lagringen är avstängd (privat
 * fönster, blockerad webbplatsdata) fungerar appen ändå, bara utan autospar.
 *
 * Skydd mot äldre versioner (0.6.2): programmet skriver aldrig över ett
 * autosparat projekt som är sparat i ett nyare format än det kan läsa. Det
 * kontrolleras i samma transaktion som skrivningen, så att det gäller även
 * om en nyare version har sparat i en annan flik under tiden. Ett autospar
 * som inte går att läsa alls flyttas undan till en egen nyckel innan något
 * nytt sparas, så att det inte försvinner.
 */

const DB_NAME = 'bacchus';
const STORE = 'projects';
const KEY = 'current';

export interface LocalRecord {
  text: string;
  savedAt: number;
  /** Formatet texten är sparad i. Saknas i autospar från före 0.6.2. */
  formatVersion?: number;
  /** Programversionen som sparade. Saknas före 0.6.2. */
  engine?: string;
}

type LocalSaveResult = 'saved' | 'blocked' | 'unavailable';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Vilket format ett autospar har. Läses från fältet om det finns, annars ur
 * texten. `null` om texten inte ser ut som ett projekt alls.
 */
export function recordFormatVersion(rec: Pick<LocalRecord, 'text' | 'formatVersion'>): number | null {
  if (typeof rec.formatVersion === 'number' && Number.isFinite(rec.formatVersion)) return rec.formatVersion;
  if (typeof rec.text !== 'string') return null;
  const m = /"formatVersion"\s*:\s*(\d+)/.exec(rec.text.slice(0, 2000));
  if (m) return Number(m[1]);
  // Projekt från format 1 saknade fältet men hade formatnamnet.
  return /"format"\s*:\s*"bacchus-project"/.test(rec.text.slice(0, 2000)) ? 1 : null;
}

/**
 * Får ett program som läser format `myFormat` skriva över det som ligger
 * sparat? Nej om det sparade är nyare än programmet.
 */
export function mayOverwrite(existing: Pick<LocalRecord, 'text' | 'formatVersion'> | null | undefined, myFormat: number): boolean {
  if (!existing) return true;
  const v = recordFormatVersion(existing);
  return v === null || v <= myFormat;
}

/**
 * Spara texten som det aktuella projektet, om det som ligger där inte är
 * sparat av en nyare version. Ett oläsbart autospar flyttas undan först.
 */
export async function saveLocal(text: string, formatVersion: number, engine: string): Promise<LocalSaveResult> {
  try {
    const db = await open();
    const result = await new Promise<LocalSaveResult>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const os = tx.objectStore(STORE);
      let outcome: LocalSaveResult = 'saved';
      const get = os.get(KEY);
      get.onsuccess = () => {
        const existing = get.result as LocalRecord | undefined;
        if (!mayOverwrite(existing, formatVersion)) {
          outcome = 'blocked';
          return;
        }
        if (existing && recordFormatVersion(existing) === null) {
          os.put(existing, `${UNREADABLE_PREFIX}${existing.savedAt ?? Date.now()}`);
        }
        const rec: LocalRecord = { text, savedAt: Date.now(), formatVersion, engine };
        os.put(rec, KEY);
      };
      tx.oncomplete = () => resolve(outcome);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
    return result;
  } catch {
    return 'unavailable';
  }
}

export async function loadLocal(): Promise<LocalRecord | null> {
  try {
    const db = await open();
    const result = await new Promise<LocalRecord | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
    return result ?? null;
  } catch {
    return null;
  }
}

/**
 * Allt som ligger sparat i webbläsaren (0.12.5.3, flytten): autosparet,
 * undanlagda autospar och mallen, med sina nycklar. Tomt utan lagring.
 */
export async function allLocalEntries(): Promise<{ key: string; value: unknown }[]> {
  try {
    const db = await open();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const os = tx.objectStore(STORE);
        const keys = os.getAllKeys();
        const values = os.getAll();
        values.onsuccess = () => resolve((keys.result as IDBValidKey[]).map((k, i) => ({ key: String(k), value: values.result[i] })));
        values.onerror = () => reject(values.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  } catch {
    return [];
  }
}

/** Prefixet för undanlagda autospar. */
export const UNREADABLE_PREFIX = 'unreadable-';
/** Så många undanlagda autospar sparas; de äldsta tas bort (0.12.5.9). */
export const KEEP_UNREADABLE = 5;

/** Nycklarna att ta bort så att bara de `keep` nyaste undanlagda autosparen finns kvar. */
export function unreadableToDrop(keys: readonly string[], keep = KEEP_UNREADABLE): string[] {
  const time = (k: string) => Number(k.slice(UNREADABLE_PREFIX.length)) || 0;
  return keys
    .filter((k) => k.startsWith(UNREADABLE_PREFIX))
    .sort((a, b) => time(b) - time(a))
    .slice(keep);
}

/**
 * Lägg ett autospar som inte gick att läsa under en egen nyckel, så att det
 * finns kvar, och ta bort de äldsta undanlagda (0.12.5.9). Med `clear` tas
 * autosparet också bort, så att nästa start börjar med exemplet
 * (räddningsrutan). Svarar false om det inte gick att spara undan.
 */
export async function keepUnreadable(rec: LocalRecord, opts: { clear?: boolean } = {}): Promise<boolean> {
  try {
    const db = await open();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        const os = tx.objectStore(STORE);
        const key = `${UNREADABLE_PREFIX}${Number.isFinite(rec.savedAt) ? rec.savedAt : Date.now()}`;
        os.put(rec, key);
        if (opts.clear) os.delete(KEY);
        const keys = os.getAllKeys();
        keys.onsuccess = () => {
          for (const k of unreadableToDrop((keys.result as IDBValidKey[]).map(String))) os.delete(k);
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      return true;
    } finally {
      db.close();
    }
  } catch {
    /* Ingen lagring, eller full: inget att skydda, eller inget som gick. */
    return false;
  }
}

/** De undanlagda autosparen, nyast först (0.12.5.9). */
export async function unreadableEntries(): Promise<{ key: string; rec: LocalRecord }[]> {
  return (await allLocalEntries())
    .filter((e): e is { key: string; value: LocalRecord } => e.key.startsWith(UNREADABLE_PREFIX) && typeof (e.value as LocalRecord | null)?.text === 'string')
    .map((e) => ({ key: e.key, rec: e.value }))
    .sort((a, b) => (b.rec.savedAt ?? 0) - (a.rec.savedAt ?? 0));
}

/**
 * Mall för nya projekt (0.10.40): en stilboksfil i webbläsaren, under en
 * egen nyckel bredvid autosparet. Försvinner när webbläsarens data rensas;
 * den kan också sparas som fil (*Exportera…*) och väljas vid *Nytt projekt*.
 */
export interface TemplateRecord {
  text: string;
  name: string;
  savedAt: number;
}

const TEMPLATE_KEY = 'stilboksmall';

async function withStore<T>(mode: IDBTransactionMode, run: (os: IDBObjectStore) => IDBRequest | null): Promise<T | undefined> {
  const db = await open();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = run(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req?.result as T | undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** Spara mallen. Svarar false om webbläsaren inte sparar något (privat fönster, för stor). */
export async function saveTemplate(text: string, name: string): Promise<boolean> {
  try {
    await withStore('readwrite', (os) => os.put({ text, name, savedAt: Date.now() } satisfies TemplateRecord, TEMPLATE_KEY));
    return true;
  } catch {
    return false;
  }
}

export async function loadTemplate(): Promise<TemplateRecord | null> {
  try {
    const r = await withStore<TemplateRecord>('readonly', (os) => os.get(TEMPLATE_KEY));
    return r && typeof r.text === 'string' ? r : null;
  } catch {
    return null;
  }
}

export async function clearTemplate(): Promise<void> {
  try {
    await withStore('readwrite', (os) => os.delete(TEMPLATE_KEY));
  } catch {
    /* Ingen lagring: ingen mall. */
  }
}
