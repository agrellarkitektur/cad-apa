import { newId } from './ids';
import type { Element, Id } from './model';
import { defaultRailingTypes, type RailingTypeModel } from './railingTypes';
import type { DocStore, TxBuilder } from './store';

/**
 * Kommandona för räcken (0.11.1): lägga räcken (och de förvalda typerna
 * första gången), och ändra en räckestyp.
 */

/** De förvalda räckestyperna, om projektet saknar dem (äldre projekt och nya utan räcken). */
export function ensureRailingTypes(tx: TxBuilder): void {
  if (Object.values(tx.doc.definitions).some((d) => d.elementType === 'Railing')) return;
  for (const d of defaultRailingTypes()) if (!tx.doc.definitions[d.id]) tx.putDefinition(d);
}

/** Den typ ett nytt räcke får: den senast använda, annars RÄ01 (eller den första). */
export function defaultRailingDef(doc: DocStore['doc'], wanted?: Id): Id {
  if (wanted && doc.definitions[wanted]?.elementType === 'Railing') return wanted;
  if (doc.definitions['t-ra01']?.elementType === 'Railing') return 't-ra01';
  return Object.values(doc.definitions).find((d) => d.elementType === 'Railing')?.id ?? 't-ra01';
}

export type NewRailing = Omit<Element, 'id' | 'type' | 'states' | 'tags' | 'props'> & { states?: Id[] };

/** Lägg räcken, med de förvalda typerna om de saknas. */
export function addRailings(store: DocStore, list: NewRailing[], states: Id[], label: string): Element[] {
  const made: Element[] = list.map((r) => ({ id: newId('el'), type: 'Railing', tags: [], props: {}, ...r, states: r.states ?? states }));
  store.transact(label, (tx) => {
    ensureRailingTypes(tx);
    for (const e of made) tx.putElement({ ...e, definition: defaultRailingDef(tx.doc, e.definition) });
  });
  return made.map((e) => store.doc.elements[e.id]).filter(Boolean);
}

/** Ändra räckestypen i en definition; alla räcken av typen ändras med den. */
export function updateRailingType(store: DocStore, defId: Id, label: string, fn: (m: RailingTypeModel) => RailingTypeModel | null): boolean {
  const def = store.doc.definitions[defId];
  if (!def?.railing) return false;
  const next = fn(structuredClone(def.railing));
  if (!next) return false;
  store.transact(label, (tx) => tx.putDefinition({ ...def, railing: next }));
  return true;
}
