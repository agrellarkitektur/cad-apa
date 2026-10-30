import { dimWall } from './dimWall';
import { groundAlong } from './groundAlong';
import { stairAlong } from './stairAlong';
import { groundArea } from './groundArea';
import { labelOn } from './labelOn';
import { lineAlong } from './lineAlong';
import { roofOver } from './roofOver';
import { selectConnected } from './selectConnected';
import { shapeAround } from './shapeAround';
import { slabFrom } from './slabFrom';
import { wallAlong } from './wallAlong';
import { registerWand } from './wand';

/**
 * Smartspötets funktioner (0.10.22, 0.10.23). En ny funktion = en ny fil och
 * en rad här. Ordningen avgör vilket förslag som kommer först när flera
 * funktioner svarar för samma verktyg (2D: kanten före ytan).
 */
export function registerWands(): void {
  registerWand(selectConnected);
  registerWand(wallAlong);
  registerWand(groundAlong);
  registerWand(stairAlong);
  registerWand(groundArea);
  registerWand(lineAlong);
  registerWand(shapeAround);
  registerWand(slabFrom);
  registerWand(roofOver);
  registerWand(labelOn);
  registerWand(dimWall);
}
