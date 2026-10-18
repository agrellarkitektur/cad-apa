import { reversedWall } from '../core/commands';
import type { ProjectDoc } from '../core/model';
import { wallsFacingOut } from './wallSides';

/**
 * Vänd ytterväggar så att deras insida (höger sida i ritriktningen) vetter in
 * i huset. Väggarna och allt i dem ligger kvar; bara riktningen ändras.
 * Används när äldre projekt öppnas och för exemplet.
 */
export function orientExteriorWalls(doc: ProjectDoc): ProjectDoc {
  const wrong = wallsFacingOut(doc);
  if (!wrong.length) return doc;
  const elements = { ...doc.elements };
  let working: ProjectDoc = { ...doc, elements };
  for (const w of wrong) {
    for (const e of reversedWall(working, elements[w.id], true)) elements[e.id] = e;
    working = { ...working, elements };
  }
  return working;
}
