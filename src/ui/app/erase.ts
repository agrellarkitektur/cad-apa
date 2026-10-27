import { deleteElements } from '../../core/commands';
import type { Id } from '../../core/model';
import type { AppContext } from './context';

/**
 * Ta bort det markerade (Delete, Ta bort, Klipp ut, kommandot). Låst betyder
 * låst (0.10.12): låsta objekt står kvar och förblir markerade, och ett
 * meddelande säger att de måste låsas upp först.
 */
export function eraseSelection(app: AppContext, ids: Id[] = app.selection.list()): void {
  if (!ids.length) return;
  const { removed, locked } = deleteElements(app.store, ids);
  if (locked.length) {
    app.selection.set(locked);
    const n = locked.length;
    const what = n === 1 ? 'Objektet är låst' : `${n} objekt är låsta`;
    app.hint(`${what}${removed ? ' och togs inte bort' : ''}. Lås upp i egenskaperna för att ta bort.`, 4000);
  } else app.selection.clear();
}
