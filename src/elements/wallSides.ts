import type { Element, Id, ProjectDoc } from '../core/model';
import { union, type Rings } from '../geometry/boolean';
import { pointInRings } from '../geometry/vec';
import { resolveParams } from './registry';
import { computeWallShapes, wallFrame, type WallParams } from './wall';

/**
 * Vilken sida av en vägg som vetter ut. Väggarna på våningen slås ihop; det
 * som ligger innanför den sammanslagna konturens ytterkant är inne i huset
 * (rummen blir hål i väggmassan). Ger 1 om väggens vänstra sida (sett i
 * ritriktningen) är utsidan, -1 om den högra är det, och null för väggar som
 * har inne på båda sidor (innerväggar) eller ute på båda (fristående).
 */
export function outsideSide(doc: ProjectDoc, wall: Element): 1 | -1 | null {
  const outlines = buildingOutlines(doc, wall.storey);
  const p = resolveParams<WallParams>(doc, wall);
  const f = wallFrame(p);
  const probe = f.half + 60;
  // Prova på några ställen längs väggen; det räcker att ett ger svar.
  for (const t of [0.5, 0.3, 0.7, 0.15, 0.85]) {
    const inside = (o: number) => outlines.some((ring) => pointInRings(f.at(f.length * t, o), [ring]));
    const l = inside(probe);
    const r = inside(-probe);
    if (l !== r) return l ? -1 : 1;
  }
  return null;
}

const cache = new WeakMap<object, Map<Id, Rings>>();

/** Ytterkonturerna av alla väggar på en våning, sammanslagna. */
function buildingOutlines(doc: ProjectDoc, storey: Id): Rings {
  let byStorey = cache.get(doc.elements);
  if (!byStorey) cache.set(doc.elements, (byStorey = new Map()));
  let rings = byStorey.get(storey);
  if (!rings) {
    const walls = Object.values(doc.elements)
      .filter((e) => e.type === 'Wall' && e.storey === storey)
      .map((e) => ({ id: e.id, p: resolveParams<WallParams>(doc, e) }));
    const shapes = computeWallShapes(walls, () => []);
    rings = union([...shapes.values()].flat()).map((poly) => poly[0]);
    byStorey.set(storey, rings);
  }
  return rings;
}

export type WallFace = 'outside' | 'center' | 'inside';

/**
 * Varje vägg har en insida: höger sida sett i ritriktningen (den sida som
 * vetter in när man ritar medurs). För ytterväggar ser väggverktyget till att insidan
 * vetter in i huset; för innerväggar är det den sida man ritat den åt, och
 * den kan bytas med Vänd väggen. Insidan styr var littera står och senare
 * skiktordningen i väggtypen.
 */
export const INSIDE: -1 = -1;

/** Referenslinjens läge i ord: utsida, center eller insida. */
export function faceOf(doc: ProjectDoc, wall: Element): { face: WallFace; label: string } {
  const j = resolveParams<WallParams>(doc, wall).justification;
  if (j === 'center') return { face: 'center', label: 'Center' };
  // Väggen till höger om linjen: linjen ligger i vänstra livet, som är utsidan.
  return j === 'right' ? { face: 'outside', label: 'Utsida' } : { face: 'inside', label: 'Insida' };
}

/** Justeringen som lägger referenslinjen i ett visst liv. */
export function justificationFor(_doc: ProjectDoc, _wall: Element, face: WallFace): WallParams['justification'] {
  return face === 'center' ? 'center' : face === 'outside' ? 'right' : 'left';
}

const CHOICES: { face: WallFace; label: string }[] = [
  { face: 'outside', label: 'Utsida' },
  { face: 'center', label: 'Center' },
  { face: 'inside', label: 'Insida' },
];

/** Valen för en vägg, i den ordning de visas. */
export function faceChoices(_doc?: ProjectDoc, _wall?: Element): { face: WallFace; label: string }[] {
  return CHOICES;
}

/** Ytterväggar vars insida vetter ut, och alltså ska vändas. */
export function wallsFacingOut(doc: ProjectDoc, ids?: readonly string[]): Element[] {
  return Object.values(doc.elements).filter((e) => e.type === 'Wall' && (!ids || ids.includes(e.id)) && outsideSide(doc, e) === -1);
}
