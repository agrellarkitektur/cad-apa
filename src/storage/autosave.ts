import type { DocStore } from '../core/store';
import { serialize } from './format';
import { saveLocal } from './localStore';

export type SaveStatus = { kind: 'saved'; at: Date } | { kind: 'pending' } | { kind: 'unavailable' };

/**
 * Sparar projektet i webbläsaren en kort stund efter varje ändring, så att
 * inget går förlorat om fliken stängs.
 */
export function startAutosave(store: DocStore, onStatus: (s: SaveStatus) => void, delayMs = 800): void {
  let timer = 0;
  const flush = async () => {
    timer = 0;
    const ok = await saveLocal(serialize(store.doc));
    onStatus(ok ? { kind: 'saved', at: new Date() } : { kind: 'unavailable' });
  };
  store.subscribe(() => {
    onStatus({ kind: 'pending' });
    clearTimeout(timer);
    timer = window.setTimeout(flush, delayMs);
  });
  // Spara direkt om fliken göms, t.ex. när mobilen byter app.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && timer) {
      clearTimeout(timer);
      void flush();
    }
  });
}
