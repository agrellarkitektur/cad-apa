import { newId } from './ids';
import type { Definition, Id } from './model';
import { DEFAULT_OPENING_TYPES, elementTypeOfKind, newOpeningModel, openingDefinition, OPENING_GROUPS, type OpeningKind, type OpeningTypeModel } from './openingTypes';
import type { DocStore, TxBuilder } from './store';

/**
 * Kommandona för dörr-, fönster- och vägghålstyperna (0.11.8): lägga in de
 * förvalda, ny typ, duplicera, ta bort och ändra en typ, och grupperna.
 */

/** De förvalda typerna som saknas i projektet. */
export function missingDefaultOpeningTypes(doc: DocStore['doc']): number {
  return DEFAULT_OPENING_TYPES.filter((t) => !doc.definitions[t.id]).length;
}

export function addDefaultOpeningTypes(store: DocStore): number {
  let n = 0;
  store.transact('Lägg in förvalda dörr- och fönstertyper', (tx) => {
    for (const t of DEFAULT_OPENING_TYPES)
      if (!tx.doc.definitions[t.id]) {
        tx.putDefinition(openingDefinition(t));
        n++;
      }
  });
  return n;
}

/** En förvald typ i en transaktion, om den saknas (verktyget när projektet saknar typer). */
export function ensureOpeningType(tx: TxBuilder, id: Id): void {
  const t = DEFAULT_OPENING_TYPES.find((x) => x.id === id);
  if (t && !tx.doc.definitions[id]) tx.putDefinition(openingDefinition(t));
}

/** Typerna i den ordning de visas: grupperna, sedan namnet. */
export function openingTypesOf(doc: DocStore['doc'], kind?: OpeningKind): Definition[] {
  const groups = openingGroups(doc);
  return Object.values(doc.definitions)
    .filter((d) => d.opening && (!kind || d.opening.kind === kind))
    .sort((a, b) => groups.indexOf(a.opening!.group) - groups.indexOf(b.opening!.group) || a.name.localeCompare(b.name, 'sv', { numeric: true }));
}

/** Grupperna: Fönster, Dörrar, Vägghål och de egna, i den ordningen. */
export function openingGroups(doc: DocStore['doc']): string[] {
  const out = OPENING_GROUPS.map((g) => g.group);
  for (const d of Object.values(doc.definitions)) if (d.opening && !out.includes(d.opening.group)) out.push(d.opening.group);
  return out;
}

export const openingTypeUses = (doc: DocStore['doc'], defId: Id): number => Object.values(doc.elements).filter((e) => e.definition === defId).length;

export function updateOpeningType(store: DocStore, defId: Id, label: string, fn: (m: OpeningTypeModel, d: Definition) => OpeningTypeModel | null, defPatch?: Partial<Definition>): boolean {
  const def = store.doc.definitions[defId];
  if (!def?.opening) return false;
  const next = fn(structuredClone(def.opening), def);
  if (!next && !defPatch) return false;
  store.transact(label, (tx) => tx.putDefinition({ ...def, ...(defPatch ?? {}), opening: next ?? def.opening }));
  return true;
}

export function addOpeningType(store: DocStore, name: string, model: OpeningTypeModel, description?: string): Id {
  const id = newId('t');
  store.transact(`Ny typ ${name}`, (tx) => tx.putDefinition({ id, origin: 'component', name, elementType: elementTypeOfKind(model.kind), params: {}, props: {}, opening: model, ...(description ? { description } : {}) }));
  return id;
}

export function newOpeningType(store: DocStore, kind: OpeningKind, group: string, name: string): Id {
  return addOpeningType(store, name, newOpeningModel(kind, group));
}

export function duplicateOpeningType(store: DocStore, defId: Id): Id | null {
  const d = store.doc.definitions[defId];
  if (!d?.opening) return null;
  return addOpeningType(store, `${d.name} (kopia)`, structuredClone(d.opening), d.description);
}

export function removeOpeningType(store: DocStore, defId: Id): boolean {
  const d = store.doc.definitions[defId];
  if (!d?.opening || openingTypeUses(store.doc, defId)) return false;
  store.transact(`Ta bort typ ${d.name}`, (tx) => tx.removeDefinition(defId));
  return true;
}
