import { dimensionType, textType } from './annotation';
import { basisFacadeType } from './basisFacade';
import { doorType } from './door';
import { shape2dType } from './drawing2d';
import { furnitureType } from './furniture';
import { labelType } from './label';
import { registerType } from './registry';
import { placement } from '../core/commands';
import { elevationType, markerFrame, northType, sectionType } from './markers';
import { roofType } from './roof';
import { roofSlopeType } from './roofSlope';
import { scaleBarType } from './scaleBar';
import { stampType } from './stamp';
import { slabType } from './slab';
import { groundType } from './ground';
import { siteBuildingType, siteMapType, terrainType, treeType } from './site';
import { spaceType } from './space';
import { underlayType } from './underlay';
import { wallType } from './wall';
import { windowType } from './window';

/** Alla elementtyper som programmet känner till. En ny typ = en ny rad här. */
export function registerBuiltInTypes(): void {
  registerType(wallType);
  registerType(slabType);
  registerType(doorType);
  registerType(windowType);
  registerType(furnitureType);
  registerType(spaceType);
  registerType(dimensionType);
  registerType(textType);
  registerType(labelType);
  registerType(roofType);
  registerType(northType);
  registerType(elevationType);
  registerType(sectionType);
  registerType(shape2dType);
  registerType(roofSlopeType);
  registerType(underlayType);
  registerType(scaleBarType);
  registerType(stampType);
  registerType(terrainType);
  registerType(siteBuildingType);
  registerType(treeType);
  registerType(siteMapType);
  registerType(groundType);
  registerType(basisFacadeType);
  // Fasader och sektioner som följer byggnaden placeras där de ligger när de flyttas.
  placement.auto = (doc, el) => {
    const f = markerFrame(doc, el);
    return { start: [Math.round(f.start[0]), Math.round(f.start[1])], end: [Math.round(f.end[0]), Math.round(f.end[1])] };
  };
}

export { typeOf, allTypes } from './registry';
