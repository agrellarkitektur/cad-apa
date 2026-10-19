import type { Id, ProjectDoc } from '../core/model';
import { offsetEdge } from '../core/roofEdit';
import { left } from '../geometry/vec';
import type { Vec2 } from '../repr/primitives';
import { zOn } from '../repr/solids';
import { markerFrame } from './markers';
import { resolveParams } from './registry';
import { roofPlanes, type RoofParams } from './roof';

/**
 * Grepp för taket i fasader och sektioner (0.8). Nocken dras upp eller ned
 * och ändrar lutningen; takfoten ligger kvar. Takfoten dras upp eller ned och
 * höjer eller sänker hela taket med samma lutning (med `keepRidge` står
 * nocken still och lutningen ändras), och åt sidan för att ändra taksprånget.
 *
 * Koordinaterna är vyns: x längs linjen, y = höjd över nollnivån.
 */

export interface RoofGrip {
  roof: Id;
  kind: 'ridge' | 'eave';
  /** Takfotens sida, sett tvärs nocken: där takfallet slutar lägst (`min`) eller på andra sidan (`max`). */
  side?: 'min' | 'max';
  /** Greppets plats i vyn. */
  at: Vec2;
}

export interface RoofDrag {
  params: RoofParams;
  /** Vad som ändras, för texten vid markören. */
  text: string;
  /** Takets nya kontur i vyn: över- och undersida per takfall, för förhandsvisningen. */
  outline: Vec2[][];
}

/** Takets mått tvärs nocken: riktningar, w för varje hörn och bredden till nocken. */
function across(p: RoofParams) {
  const r = (p.ridge * Math.PI) / 180;
  const a: Vec2 = [Math.cos(r), Math.sin(r)];
  const n = left(a);
  const ws = p.outline.map((q) => q[0] * n[0] + q[1] * n[1]);
  const wMin = Math.min(...ws);
  const wMax = Math.max(...ws);
  // Från takfoten till nocken: halva bredden för sadeltak, hela för pulpettak.
  const run = p.kind === 'shed' ? wMax - wMin : (wMax - wMin) / 2;
  return { a, n, ws, wMin, wMax, run };
}

/** Takets ovansida vid nocken över golvet, för en lutning i grader. */
function ridgeTop(eave: number, run: number, slope: number, thickness: number): number {
  const r = (slope * Math.PI) / 180;
  return eave + Math.tan(r) * run + thickness / Math.cos(r);
}

/** Lutningen (grader) som ger nocken höjden `top`, med takfoten kvar. Null om det inte går. */
export function slopeForRidge(eave: number, run: number, thickness: number, top: number): number | null {
  if (run < 1) return null;
  let lo = 0.5;
  let hi = 80;
  if (top <= ridgeTop(eave, run, lo, thickness)) return lo;
  if (top >= ridgeTop(eave, run, hi, thickness)) return hi;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (ridgeTop(eave, run, mid, thickness) < top) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Vyns ram: från plan till vyns x och tillbaka. */
function viewFrame(doc: ProjectDoc, markerId: Id) {
  const marker = doc.elements[markerId];
  if (!marker) return null;
  const fr = markerFrame(doc, marker);
  const z0 = doc.storeys.find((s) => s.id === marker.storey)?.elevation ?? 0;
  const u = (q: Vec2) => (q[0] - fr.start[0]) * fr.right[0] + (q[1] - fr.start[1]) * fr.right[1];
  const uMax = Math.hypot(fr.end[0] - fr.start[0], fr.end[1] - fr.start[1]);
  return { fr, z0, u, uMax, storey: marker.storey };
}

/** Mitten av punkternas läge i vyn, begränsad till linjens längd. Null om allt ligger utanför. */
function midU(us: number[], uMax: number): number | null {
  const lo = Math.max(0, Math.min(...us));
  const hi = Math.min(uMax, Math.max(...us));
  if (hi < lo - 1) return null;
  return (lo + Math.max(lo, hi)) / 2;
}

/** Greppen för de markerade taken i fasaden eller sektionen. */
export function roofGripsInView(doc: ProjectDoc, markerId: Id, roofIds: readonly Id[]): RoofGrip[] {
  const vf = viewFrame(doc, markerId);
  if (!vf) return [];
  const out: RoofGrip[] = [];
  for (const id of roofIds) {
    const el = doc.elements[id];
    if (el?.type !== 'Roof' || el.storey !== vf.storey) continue;
    const p = resolveParams<RoofParams>(doc, el);
    if (p.outline.length < 3) continue;
    const g = across(p);
    const top = vf.z0 + ridgeTop(p.eave, g.run, p.slope, p.thickness);
    // Nocken: mittlinjen för sadeltak, den höga kanten för pulpettak.
    const ridgeW = p.kind === 'shed' ? g.wMax : (g.wMin + g.wMax) / 2;
    const along = p.outline.map((q) => q[0] * g.a[0] + q[1] * g.a[1]);
    const ridgePts: Vec2[] = [Math.min(...along), Math.max(...along)].map((s): Vec2 => [g.a[0] * s + g.n[0] * ridgeW, g.a[1] * s + g.n[1] * ridgeW]);
    const ru = midU(ridgePts.map(vf.u), vf.uMax);
    if (ru !== null) out.push({ roof: id, kind: 'ridge', at: [Math.round(ru), Math.round(top)] });
    // Takfötterna: hörnen på den låga sidan (och för sadeltak båda sidorna).
    const sides: ('min' | 'max')[] = p.kind === 'shed' ? ['min'] : ['min', 'max'];
    const eaves: RoofGrip[] = [];
    for (const side of sides) {
      const w = side === 'min' ? g.wMin : g.wMax;
      const pts = p.outline.filter((_, i) => Math.abs(g.ws[i] - w) < 1);
      if (!pts.length) continue;
      const eu = midU(pts.map(vf.u), vf.uMax);
      if (eu === null) continue;
      const at: Vec2 = [Math.round(eu), Math.round(vf.z0 + p.eave)];
      // Ser man takfallen från sidan hamnar båda takfötterna på samma ställe: ett grepp räcker.
      if (eaves.some((e) => Math.abs(e.at[0] - at[0]) < 50)) continue;
      eaves.push({ roof: id, kind: 'eave', side, at });
    }
    out.push(...eaves);
  }
  return out;
}

/** Takets nya kontur i vyn: varje takfalls över- och undersida. */
function outlineInView(p: RoofParams, u: (q: Vec2) => number, z0: number): Vec2[][] {
  const out: Vec2[][] = [];
  for (const rp of roofPlanes(p)) {
    for (const ring of rp.rings) {
      for (const pl of [rp.top, rp.under]) out.push(ring.map((q): Vec2 => [u(q), z0 + zOn(pl, q[0], q[1])]));
    }
  }
  return out;
}

const fmtM = (mm: number) => {
  const m = mm / 1000;
  return `${m < 0 ? '−' : '+'}${Math.abs(m).toLocaleString('sv-SE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`;
};
const fmtDeg = (d: number) => `${d.toLocaleString('sv-SE', { maximumFractionDigits: 1 })}°`;

/**
 * Taket efter att greppet dragits till `to` (vyns koordinater). `free` ger
 * lutningen utan avrundning till hela grader; `keepRidge` låter nocken stå
 * still när takfoten dras.
 */
export function dragRoofGrip(doc: ProjectDoc, markerId: Id, grip: RoofGrip, to: Vec2, opts: { free?: boolean; keepRidge?: boolean } = {}): RoofDrag | null {
  const vf = viewFrame(doc, markerId);
  const el = doc.elements[grip.roof];
  if (!vf || !el) return null;
  const p = resolveParams<RoofParams>(doc, el);
  const g = across(p);
  const round = (s: number) => (opts.free ? Math.round(s * 10) / 10 : Math.round(s));
  const done = (next: RoofParams, text: string): RoofDrag => ({ params: next, text, outline: outlineInView(next, vf.u, vf.z0) });

  if (grip.kind === 'ridge') {
    const s = slopeForRidge(p.eave, g.run, p.thickness, to[1] - vf.z0);
    if (s === null) return null;
    const slope = Math.max(1, Math.min(80, round(s)));
    return done({ ...p, slope }, `Lutning ${fmtDeg(p.slope)} → ${fmtDeg(slope)}`);
  }

  // Takfoten. Åt sidan: taksprånget, om takfoten syns från gaveln.
  const outward: Vec2 = grip.side === 'max' ? g.n : [-g.n[0], -g.n[1]];
  const along = vf.fr.right[0] * outward[0] + vf.fr.right[1] * outward[1];
  const du = to[0] - grip.at[0];
  const dz = to[1] - grip.at[1];
  const k = Math.tan((p.slope * Math.PI) / 180);
  let d = Math.abs(along) > 0.3 ? Math.round(du * along) : 0;
  // Mest lodrätt: bara höjden. Mest vågrätt: taksprånget längs takfallet, höjden följer.
  if (Math.abs(du) < 0.3 * Math.abs(dz)) d = 0;
  const horizontal = d !== 0 && Math.abs(dz) < 0.3 * Math.abs(du);
  let outline = p.outline;
  if (d !== 0) {
    let next: [number, number][] | null = p.outline.map((q) => [q[0], q[1]] as [number, number]);
    // Sadeltak får samma taksprång på båda sidor, så att nocken ligger kvar.
    const sides: ('min' | 'max')[] = p.kind === 'shed' ? [grip.side ?? 'min'] : ['min', 'max'];
    for (const side of sides) {
      const ws = next!.map((q) => q[0] * g.n[0] + q[1] * g.n[1]);
      const w = side === 'min' ? Math.min(...ws) : Math.max(...ws);
      const out: Vec2 = side === 'max' ? g.n : [-g.n[0], -g.n[1]];
      for (let i = 0; i < next!.length && next; i++) {
        const j = (i + 1) % next.length;
        if (Math.abs(ws[i] - w) >= 1 || Math.abs(ws[j] - w) >= 1) continue;
        // Kanten flyttas åt vänster sett längs den; vänd om vänster är inåt.
        const e: Vec2 = [next[j][0] - next[i][0], next[j][1] - next[i][1]];
        const l = left(e);
        const sign = l[0] * out[0] + l[1] * out[1] >= 0 ? 1 : -1;
        next = offsetEdge(next, i, sign * d);
        break;
      }
      if (!next) return null;
    }
    outline = next!;
  }
  // Takfotens nya höjd: där greppet släpps, eller längs takfallet om dragningen var vågrät.
  const lowSide = p.kind === 'shed' ? grip.side !== 'max' : true;
  let eave = horizontal && lowSide ? Math.round(p.eave - k * d) : Math.round(to[1] - vf.z0);
  if (p.kind === 'shed' && grip.side === 'max') eave = p.eave;
  let slope = p.slope;
  const run = p.kind === 'shed' ? g.run + (lowSide ? d : 0) + (grip.side === 'max' ? d : 0) : g.run + d;
  if (opts.keepRidge) {
    const top = ridgeTop(p.eave, g.run, p.slope, p.thickness);
    const s = slopeForRidge(eave, run, p.thickness, top);
    if (s === null) return null;
    slope = Math.max(1, Math.min(80, round(s)));
  }
  const next: RoofParams = { ...p, outline, eave, slope };
  const parts: string[] = [];
  if (eave !== p.eave) parts.push(`Takfot ${fmtM(vf.z0 + eave)}`);
  if (d !== 0) parts.push(`Taksprång ${d > 0 ? '+' : '−'}${Math.abs(d).toLocaleString('sv-SE')} mm`);
  if (slope !== p.slope) parts.push(`Lutning ${fmtDeg(slope)}`);
  return done(next, parts.join('  ') || 'Oförändrat');
}
