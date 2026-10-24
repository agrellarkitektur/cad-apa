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
  // Varje vägg vänds mot projektet som det var: väggarna har var sina dörrar
  // och fönster, så ordningen spelar ingen roll. Samlingen fylls först när
  // allt är räknat, eftersom registren (0.8.15) inte tål ändringar på plats.
  const elements = { ...doc.elements };
  for (const w of wrong) for (const e of reversedWall(doc, doc.elements[w.id], true)) elements[e.id] = e;
  return { ...doc, elements };
}
