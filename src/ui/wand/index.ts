import { groundAlong } from './groundAlong';
import { selectConnected } from './selectConnected';
import { shapeAround } from './shapeAround';
import { wallAlong } from './wallAlong';
import { registerWand } from './wand';

/** Smartspötets funktioner (0.10.22). En ny funktion = en ny fil och en rad här. */
export function registerWands(): void {
  registerWand(selectConnected);
  registerWand(wallAlong);
  registerWand(groundAlong);
  registerWand(shapeAround);
}
