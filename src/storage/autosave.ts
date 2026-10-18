import { ENGINE } from '../core/engine';
import { FORMAT_VERSION } from '../core/model';
import type { DocStore } from '../core/store';
import { serialize } from './format';
import { saveLocal } from './localStore';

export type SaveStatus =
  | { kind: 'saved'; at: Date }
  | { kind: 'pending' }
  | { kind: 'unavailable' }
  /** Det autosparade projektet är från en nyare version och skrivs inte över. */
  | { kind: 'blocked' };

/**
 * Sparar projektet i webbläsaren en kort stund efter varje ändring, så att
 * inget går förlorat om fliken stängs. Är autosparet låst (`blocked`) sparas
 * ingenting i webbläsaren under resten av sessionen; projektet kan fortfarande
 * sparas som fil.
 */
export function startAutosave(store: DocStore, onStatus: (s: SaveStatus) => void, opts: { blocked?: boolean; delayMs?: number } = {}): void {
  const delayMs = opts.delayMs ?? 800;
  let blocked = !!opts.blocked;
  let timer = 0;
  const flush = async () => {
    timer = 0;
    if (blocked) return onStatus({ kind: 'blocked' });
    const r = await saveLocal(serialize(store.doc), FORMAT_VERSION, ENGINE.version);
    if (r === 'blocked') blocked = true;
    onStatus(r === 'saved' ? { kind: 'saved', at: new Date() } : { kind: r });
  };
  store.subscribe(() => {
    if (blocked) return onStatus({ kind: 'blocked' });
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
