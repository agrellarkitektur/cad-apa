import { dimensionType, textType } from './annotation';
import { doorType } from './door';
import { furnitureType } from './furniture';
import { registerType } from './registry';
import { spaceType } from './space';
import { wallType } from './wall';
import { windowType } from './window';

/** Alla elementtyper som programmet känner till. En ny typ = en ny rad här. */
export function registerBuiltInTypes(): void {
  registerType(wallType);
  registerType(doorType);
  registerType(windowType);
  registerType(furnitureType);
  registerType(spaceType);
  registerType(dimensionType);
  registerType(textType);
}

export { typeOf, allTypes } from './registry';
