import type { ProjectDoc } from '../core/model';
import { boxOfPoints, flatContour, isEndProfile, profileModel, stretchPoint, type ProfileSection, type ProfileTypeModel } from '../core/profileTypes';
import type { Vec2 } from '../repr/primitives';
import { merged, stripCells, type EndShape, type EndSpec } from './profileBody';

/**
 * Ändprofilerna (0.11.7, utredningen 31 oktober 2026, tavla 4): en typ i
 * gruppen Ändprofiler (PA01 …) är en kontur ritad i sidovyn, x längs banan
 * ut från änden och y uppåt som tvärsnittets. Den skär änden: det som inte
 * ligger i konturen tas bort. Med *Utöver* ligger konturen efter
 * referenslinjens ände, med *Inom* ryms den i linjen; förskjutningen
 * flyttar den. Samma typ passar profiler med samma höjd; en annan höjd
 * sträcks med profilens sträckzon Höjd, annars varnar panelen. I början
 * speglas den av sig själv (u går alltid ut från änden).
 */

/** Ändprofilens kontur i en ände, och dess höjder i tvärsnittet (för varningen). */
export function endShapeOf(pa: ProfileTypeModel, section: ProfileSection, yShift: number, e: EndSpec): { shape: EndShape; y0: number; y1: number } | null {
  const h = section.deltas.filter((d) => d.zone.axis === 'height');
  const rings = pa.parts.map((p) => flatContour(p.contour).map((q) => stretchPoint(q, h))).filter((r) => r.length >= 3);
  if (!rings.length) return null;
  const box = boxOfPoints(rings.flat());
  const w = box.maxX - box.minX;
  if (w < 1 || box.maxY - box.minY < 1) return null;
  const base = (e.beyond ? 0 : -w) + (e.shift ?? 0) - box.minX;
  const polys = merged(rings.map((r) => r.map((q): Vec2 => [q[0] + base, q[1] - yShift])));
  const cells = stripCells(polys);
  if (!cells.length) return null;
  return { shape: { cells, rings: polys, minU: box.minX + base, maxU: box.maxX + base }, y0: box.minY - yShift, y1: box.maxY - yShift };
}

/** Ändprofilens typ för ett avslut, eller undefined. */
export function endProfileModel(doc: ProjectDoc, e: EndSpec): ProfileTypeModel | undefined {
  const m = e.kind === 'profile' && e.profile ? profileModel(doc.definitions[e.profile]) : undefined;
  return isEndProfile(m) ? m : undefined;
}

/** Ett avslut med ändprofilens kontur uträknad; utan ändprofil (eller en som saknas) ett vinkelrätt. `fit` är en varning när höjderna inte stämmer. */
export function resolveEnd(doc: ProjectDoc, e: EndSpec, section: ProfileSection, yShift: number, sectionY: [number, number]): { spec: EndSpec; fit?: string } {
  if (e.kind !== 'profile') return { spec: e };
  const pa = endProfileModel(doc, e);
  const name = e.profile ? doc.definitions[e.profile]?.name : undefined;
  const r = pa ? endShapeOf(pa, section, yShift, e) : null;
  if (!r) return { spec: { kind: 'square', ...(e.shift ? { shift: e.shift } : {}), ...(e.beyond ? { beyond: true } : {}) }, fit: pa ? `Ändprofilen ${name ?? ''} saknar yta; änden är vinkelrät.` : 'Ändprofilen saknas; änden är vinkelrät.' };
  const off = Math.max(Math.abs(r.y0 - sectionY[0]), Math.abs(r.y1 - sectionY[1]));
  const fit = off > 1 ? `Ändprofilen ${name ?? ''} är ritad ${Math.round(r.y1 - r.y0)} mm hög och tvärsnittet är ${Math.round(sectionY[1] - sectionY[0])} mm: den sträcks bara med en sträckzon för höjden.` : undefined;
  return { spec: { ...e, shape: r.shape }, ...(fit ? { fit } : {}) };
}
