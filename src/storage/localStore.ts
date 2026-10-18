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

export type LocalSaveResult = 'saved' | 'blocked' | 'unavailable';

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
          os.put(existing, `unreadable-${existing.savedAt ?? Date.now()}`);
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
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result ?? null;
  } catch {
    return null;
  }
}

/** Lägg ett autospar som inte gick att läsa under en egen nyckel, så att det finns kvar. */
export async function keepUnreadable(rec: LocalRecord): Promise<void> {
  try {
    const db = await open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(rec, `unreadable-${rec.savedAt ?? Date.now()}`);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* Ingen lagring: inget att skydda. */
  }
}
