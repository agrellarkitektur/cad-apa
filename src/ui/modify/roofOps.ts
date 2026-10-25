import type { Element, Id } from '../../core/model';
import { resolveParams } from '../../elements/registry';
import { outlineRing, type RoofParams } from '../../elements/roof';
import { trimRoof } from '../../elements/roofMaker';
import { ringArea } from '../../elements/slab';
import { distToSegment, pointInRings } from '../../geometry/vec';
import type { Vec2 } from '../../repr/primitives';
import { pxToMm } from '../tools/host';
import type { ModifyState } from './state';

/**
 * Kapa mot tak i Modifiera (0.10): de markerade takfallen kapas där deras
 * ovansida möter takfallet man klickar på. Kvar blir den del man klickade
 * på när takfallet valdes, eller den största delen.
 */

/** Takfallet under punkten (inne i konturen eller nära den), utom de markerade. Det minsta om flera. */
export function roofAt(s: ModifyState, at: Vec2): Element | null {
  const doc = s.host.store.doc;
  const mine = new Set(s.ctx.ids);
  const tol = pxToMm(s.host, 10);
  let best: { el: Element; area: number } | null = null;
  for (const pk of s.host.plan().pickables) {
    const el = doc.elements[pk.id];
    if (el?.type !== 'Roof' || mine.has(el.id)) continue;
    const ring = outlineRing(resolveParams<RoofParams>(doc, el));
    const near = pointInRings(at, [ring]) || ring.some((q, i) => distToSegment(at, q, ring[(i + 1) % ring.length]) <= tol);
    if (!near) continue;
    const area = Math.abs(ringArea(ring));
    if (!best || area < best.area) best = { el, area };
  }
  return best?.el ?? null;
}

/** Punkten, eller en punkt strax innanför konturen om den ligger på en kant (man klickar på takfallets linjer). */
function inside(p: RoofParams, at: Vec2): Vec2 | null {
  const ring = outlineRing(p);
  if (pointInRings(at, [ring])) return at;
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8;
    const q: Vec2 = [at[0] + 20 * Math.cos(a), at[1] + 20 * Math.sin(a)];
    if (pointInRings(q, [ring])) return q;
  }
  return null;
}

/** Ett klick på takfallet att kapa mot. Svarar true när valet är klart. */
export function clickRoofTrim(s: ModifyState, model: Vec2): boolean {
  const host = s.host;
  const doc = host.store.doc;
  const target = roofAt(s, model);
  if (!target) {
    host.hint('Klicka på ett annat takfall, det som de markerade ska kapas mot.');
    return false;
  }
  const level = (id: Id) => doc.storeys.find((x) => x.id === doc.elements[id]?.storey)?.elevation ?? 0;
  const b = resolveParams<RoofParams>(doc, target);
  const roofs = s.ctx.ids.filter((id) => doc.elements[id]?.type === 'Roof');
  // Punkten man klickade när takfallet valdes gäller bara när ett takfall är markerat.
  const keep = roofs.length === 1 && (s.ctx.kind !== 'body' || s.ctx.clicked) ? inside(resolveParams<RoofParams>(doc, doc.elements[roofs[0]]), s.ctx.at) : null;
  const patches = new Map<Id, Record<string, unknown>>();
  for (const id of roofs) {
    const a = resolveParams<RoofParams>(doc, doc.elements[id]);
    const r = trimRoof(a, b, keep, level(target.id) - level(id));
    if (r) patches.set(id, { outline: r.outline, bulges: r.bulges });
  }
  if (!patches.size) {
    host.hint('Takfallen möts inte inom konturen, så det finns inget att kapa.', 3500);
    return false;
  }
  host.store.transact('Kapa mot tak', (tx) => {
    for (const [id, p] of patches) {
      const el = tx.doc.elements[id];
      if (el) tx.putElement({ ...el, params: { ...el.params, ...p } });
    }
  });
  return true;
}
