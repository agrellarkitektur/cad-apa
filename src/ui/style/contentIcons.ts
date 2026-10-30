import { icons } from '../icons';

/**
 * Symbolerna på knapparna under *Innehåll* i stilboken (0.10.34): samma
 * nycklar som kryssen under Visa. En nyckel utan egen symbol får gruppens.
 */
const BY_KEY: Record<string, keyof typeof icons> = {
  demolished: 'demolish',
  Wall: 'wall',
  Door: 'door',
  Window: 'window',
  Slab: 'slab',
  Roof: 'roof',
  footprint: 'roof',
  roofsAround: 'roof',
  hiddenSlabs: 'slab',
  hiddenWalls: 'wall',
  hiddenSlabsSection: 'section',
  Furniture: 'furniture',
  swing: 'flipSwing',
  Underlay: 'fileImage',
  Label: 'label',
  Space: 'room',
  Dimension: 'dimension',
  Text: 'text',
  Shape2D: 'draw2d',
  fill: 'grid',
  Terrain: 'ground',
  terrain3d: 'ground',
  contours3d: 'multi',
  Ground: 'ground',
  ground3d: 'multi',
  slopes3d: 'multi',
  steepSlopes: 'ground',
  SiteBuilding: 'storeys',
  SiteMap: 'north',
  house: 'roof',
  Elevation: 'elevation',
  BasisFacade: 'elevation',
  Section: 'section',
  North: 'north',
  roofSlope: 'roof',
  level: 'moveZ',
  heightDims: 'dimension',
  buildingHeight: 'moveZ',
};

const BY_GROUP: Record<string, keyof typeof icons> = { model: 'wall', littera: 'label', annotation: 'text', '2d': 'draw2d', site: 'ground', markers: 'section' };

/** Symbolen för nyckeln i gruppen. */
export function contentIcon(key: string, group: string): string {
  const name = BY_KEY[key] ?? (key.startsWith('littera:') || key.startsWith('label:') ? 'label' : BY_GROUP[group]) ?? 'states';
  return icons[name] ?? '';
}

/**
 * Det som sällan ändras (0.10.34): döljs under *Vanliga* i stilboken, men
 * syns alltid när det är ändrat mot nivån ovanför.
 */
export const RARE_CONTENT: ReadonlySet<string> = new Set(['footprint', 'roofsAround', 'hiddenSlabs', 'hiddenWalls', 'hiddenSlabsSection', 'contours3d', 'ground3d', 'slopes3d', 'steepSlopes', 'BasisFacade', 'heightDims', 'buildingHeight', 'roofSlope', 'Underlay']);
