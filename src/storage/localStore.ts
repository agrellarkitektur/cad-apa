/**
 * Autospar i webbläsarens IndexedDB. Fungerar i alla moderna webbläsare och
 * offline. Allt är inslaget i try/catch: om lagringen är avstängd (privat
 * fönster, blockerad webbplatsdata) fungerar appen ändå, bara utan autospar.
 */

const DB_NAME = 'bacchus';
const STORE = 'projects';
const KEY = 'current';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveLocal(text: string): Promise<boolean> {
  try {
    const db = await open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ text, savedAt: Date.now() }, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return true;
  } catch {
    return false;
  }
}

export async function loadLocal(): Promise<{ text: string; savedAt: number } | null> {
  try {
    const db = await open();
    const result = await new Promise<{ text: string; savedAt: number } | undefined>((resolve, reject) => {
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
