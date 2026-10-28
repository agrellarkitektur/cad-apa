import { newId } from './ids';
import { SITE_CATEGORIES, SITE_STOREY, type Id, type ProjectDoc, type SiteCategory, type ViewDef } from './model';
import { defaultState } from './states';
import type { DocStore } from './store';

/**
 * Vyer av Platsen (0.10.25): tre förinställningar att utgå från. De är
 * vanliga sparade vyer med vykategori, skala och det som visas; allt går att
 * ändra efteråt under Visa och i vyns inställningar. Materialen (0.10.26)
 * ritas efter kategorin.
 */

/** Det som släcks (eller med plus tänds) i varje kategori, som vyns `hide`. */
const PRESET_HIDE: Record<SiteCategory, readonly string[]> = {
  // Gränser, grannhus, träd, huset, höjdkurvorna och markobjektens höjder; inga markörer.
  situation: ['Elevation', 'Section', 'BasisFacade', 'littera:Ground'],
  // Allt om marken, också de branta slänterna och stödmurarnas littera.
  grading: ['Elevation', 'Section', 'BasisFacade', '+steepSlopes'],
  // Färglagd och mindre teknisk: utan höjdkurvor, mått, littera och markörer.
  illustration: ['Terrain', 'Elevation', 'Section', 'BasisFacade', 'Dimension', 'Label', 'littera:Ground'],
};

const PRESET_SCALE: Record<SiteCategory, number> = { situation: 400, grading: 200, illustration: 200 };

/** En ny vy av Platsen efter förinställningen; namnet får ett nummer om det redan finns. */
export function siteViewPreset(doc: Pick<ProjectDoc, 'states' | 'views'>, category: SiteCategory, id: Id = newId('vy')): ViewDef {
  const base = SITE_CATEGORIES.find((c) => c.id === category)!.name;
  const names = new Set(doc.views.map((v) => v.name));
  let name = base;
  for (let n = 2; names.has(name); n++) name = `${base} ${n}`;
  return {
    id,
    name,
    storey: SITE_STOREY,
    state: defaultState(doc),
    compare: false,
    detail: 'normal',
    hide: [...PRESET_HIDE[category]],
    hideDemolished: false,
    trace: null,
    scale: PRESET_SCALE[category],
    category,
  };
}

/** Lägg till en vy av Platsen; svarar med vyn. */
export function addSiteView(store: DocStore, category: SiteCategory): ViewDef {
  const v = siteViewPreset(store.doc, category);
  store.transact(`Ny vy: ${v.name}`, (tx) => tx.setViews([...tx.doc.views, v]));
  return v;
}
