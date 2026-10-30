import { newId } from './ids';
import { SITE_STOREY, type Id, type ProjectDoc, type ViewDef } from './model';
import { categoryOf } from './viewCategories';
import { defaultState } from './states';
import type { DocStore } from './store';

/**
 * Vyer av Platsen (0.10.25): en ny vy med en av Platsens kategorier i
 * stilboken (0.10.32), som ger det som visas och hur materialen ritas.
 */

/** En ny vy av Platsen efter förinställningen; namnet får ett nummer om det redan finns. */
export function siteViewPreset(doc: Pick<ProjectDoc, 'states' | 'views' | 'graphics'>, category: string, id: Id = newId('vy')): ViewDef {
  const c = categoryOf(doc.graphics, 'site', category);
  const base = c.name;
  const names = new Set(doc.views.map((v) => v.name));
  let name = base;
  for (let n = 2; names.has(name); n++) name = `${base} ${n}`;
  return {
    id,
    name,
    storey: SITE_STOREY,
    state: defaultState(doc),
    trace: null,
    scale: c.scale,
    category: c.id,
  };
}

/** Lägg till en vy av Platsen; svarar med vyn. */
export function addSiteView(store: DocStore, category: string): ViewDef {
  const v = siteViewPreset(store.doc, category);
  store.transact(`Ny vy: ${v.name}`, (tx) => tx.setViews([...tx.doc.views, v]));
  return v;
}
