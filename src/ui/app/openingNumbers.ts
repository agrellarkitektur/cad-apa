import { missingOpeningNumbers } from '../../elements/openingLittera';
import type { AppContext } from './context';

/**
 * Litterans nummer står still (0.11.8): när en ändring ger en ny
 * kombination av typ och mått (eller hängning) sparas dess nummer i
 * projektet, i samma ångra-steg, så att den inte byter nummer när andra
 * tillkommer. *Numrera om* under Allmänt sorterar om alla.
 */
export function installOpeningNumbers(app: Pick<AppContext, 'store'>): void {
  let busy = false;
  app.store.subscribe((_doc, e) => {
    if (e.cause !== 'commit' || busy) return;
    const missing = missingOpeningNumbers(app.store.doc);
    if (!Object.keys(missing).length) return;
    busy = true;
    try {
      app.store.transact(
        'Littera',
        (tx) => {
          const cur = tx.doc.project.openingNumbers ?? {};
          const next = { ...cur };
          for (const [type, map] of Object.entries(missing)) next[type] = { ...(cur[type] ?? {}), ...map };
          tx.setProject({ ...tx.doc.project, openingNumbers: next });
        },
        { merge: true },
      );
    } finally {
      busy = false;
    }
  });
}
