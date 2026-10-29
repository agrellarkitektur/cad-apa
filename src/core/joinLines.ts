import { isClosed, type Shape2DParams } from '../elements/drawing2d';
import { PATH_WIDTH } from '../elements/groundLines';
import type { RampParams } from '../elements/groundRamp';
import { fusedRamp, reversedRamp } from '../elements/rampEdits';
import { resolveParams } from '../elements/registry';
import type { Element, Id, ProjectDoc } from './model';
import type { DocStore } from './store';

/**
 * Foga ihop (0.10.17): öppna 2D-linjer som delar en ändpunkt blir en lång
 * linje. Linjer och splines fogas var för sig. Den första linjen i en kedja
 * (i markeringens ordning) behåller sin penna, fyllning och sitt id; de
 * andra tas bort. Slutar kedjan där den började blir linjen sluten.
 *
 * Ramper (0.10.19): två ramper vars ändar ligger nära varandra (inom den
 * bredaste rampens bredd) dockas till en, med en punkt med höjd där de
 * möts, så att lutningen bryts där (skarpt eller mjukt efter rampens
 * övergångar). Den första behåller sina inställningar.
 */

type P = [number, number];

/** Ändar närmare än så räknas som samma punkt (mm). */
const SAME = 1;

/** En öppen linje eller spline som kan fogas, eller en ramp (0.10.19). */
export function canFuse(doc: ProjectDoc, el: Element | undefined): boolean {
  if (!el || el.locked) return false;
  if (el.type === 'Ground') return isRampEl(doc, el);
  if (el.type !== 'Shape2D') return false;
  const q = resolveParams<Shape2DParams>(doc, el);
  return (q.shape === 'polyline' || q.shape === 'spline') && q.points.length >= 2 && !isClosed(q);
}

const isRampEl = (doc: ProjectDoc, el: Element): boolean => el.type === 'Ground' && el.params.kind === 'path' && ((resolveParams<RampParams>(doc, el).line ?? []).length ?? 0) >= 2;

/** Ramperna i markeringen fogade i kedjor: den första och de som hängs på, med parametrarna för resultatet. */
export function fuseRampChains(doc: ProjectDoc, ids: readonly Id[]): { ids: Id[]; params: RampParams }[] {
  const out: { ids: Id[]; params: RampParams }[] = [];
  const left = ids.map((id) => doc.elements[id]).filter((el): el is Element => !!el && canFuse(doc, el) && el.type === 'Ground');
  const ends = (p: RampParams) => {
    const l = p.line ?? [];
    return { a: l[0], z: l[l.length - 1] };
  };
  const near = (a: P, b: P, tol: number) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= tol;
  while (left.length) {
    const first = left.shift()!;
    let p = { ...resolveParams<RampParams>(doc, first) };
    const chain = [first.id];
    for (let grew = true; grew; ) {
      grew = false;
      for (let k = 0; k < left.length; k++) {
        const o = resolveParams<RampParams>(doc, left[k]);
        const tol = Math.max(p.width ?? PATH_WIDTH, o.width ?? PATH_WIDTH);
        const c = ends(p);
        const e = ends(o);
        let next: RampParams | null = null;
        if (near(c.z, e.a, tol)) next = fusedRamp(p, o);
        else if (near(c.z, e.z, tol)) next = fusedRamp(p, reversedRamp(o));
        else if (near(c.a, e.z, tol)) next = fusedRamp(o, p);
        else if (near(c.a, e.a, tol)) next = fusedRamp(reversedRamp(o), p);
        if (next) {
          // Den första behåller sina inställningar, också när den andra hängs på före.
          p = { ...next, ...settingsOf(p) };
          chain.push(left[k].id);
          left.splice(k, 1);
          grew = true;
          break;
        }
      }
    }
    if (chain.length >= 2) out.push({ ids: chain, params: p });
  }
  return out;
}

/** Rampens parametrar som dockningen skriver (det andra i elementet lämnas). */
const RAMP_KEYS = ['line', 'bulges', 'height', 'endHeight', 'levels', 'width', 'refSide', 'refOffset', 'left', 'right', 'leftBulges', 'rightBulges', 'edge', 'leftEdge', 'rightEdge', 'leftSlope', 'rightSlope', 'crossFall', 'ease', 'easeRadius', 'eases'] as const satisfies readonly (keyof RampParams)[];

/** Rampens inställningar som inte hör till linjen: kanterna, tvärfallet, övergångarna, bredden. */
function settingsOf(p: RampParams): Partial<RampParams> {
  const out: Partial<RampParams> = {};
  for (const k of ['edge', 'leftEdge', 'rightEdge', 'leftSlope', 'rightSlope', 'crossFall', 'ease', 'easeRadius', 'width', 'refSide', 'refOffset'] as const) if (p[k] !== undefined) (out as Record<string, unknown>)[k] = p[k];
  return out;
}

interface Chain {
  ids: Id[];
  points: P[];
  /** Pilhöjd per kant, i kedjans riktning. */
  bulges: number[];
  startCap?: string;
  endCap?: string;
}

const same = (a: P, b: P) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= SAME;

function chainOf(doc: ProjectDoc, el: Element): Chain {
  const q = resolveParams<Shape2DParams>(doc, el);
  const pts = q.points.map((p): P => [p[0], p[1]]);
  return { ids: [el.id], points: pts, bulges: pts.slice(1).map((_, i) => Number(q.bulges?.[i]) || 0), startCap: q.startCap, endCap: q.endCap };
}

function reversed(c: Chain): Chain {
  return { ids: c.ids, points: [...c.points].reverse(), bulges: [...c.bulges].reverse().map((b) => (b ? -b : 0)), startCap: c.endCap, endCap: c.startCap };
}

/** b fogad efter a (a:s slut i b:s början). */
function append(a: Chain, b: Chain): Chain {
  return { ids: [...a.ids, ...b.ids], points: [...a.points, ...b.points.slice(1)], bulges: [...a.bulges, ...b.bulges], startCap: a.startCap, endCap: b.endCap };
}

/** Kedjorna som linjerna bildar, i markeringens ordning; bara kedjor av minst två linjer. */
export function fuseChains(doc: ProjectDoc, ids: readonly Id[]): Chain[] {
  const out: Chain[] = [];
  const left = ids.map((id) => doc.elements[id]).filter((el) => el?.type === 'Shape2D' && canFuse(doc, el));
  while (left.length) {
    const first = left.shift()!;
    const kind = resolveParams<Shape2DParams>(doc, first).shape;
    let c = chainOf(doc, first);
    for (let grew = true; grew; ) {
      grew = false;
      // Sluten: inget mer att foga till.
      if (c.points.length >= 3 && same(c.points[0], c.points[c.points.length - 1])) break;
      for (let k = 0; k < left.length; k++) {
        const el = left[k];
        if (resolveParams<Shape2DParams>(doc, el).shape !== kind) continue;
        const o = chainOf(doc, el);
        const head = c.points[0];
        const tail = c.points[c.points.length - 1];
        const a = o.points[0];
        const z = o.points[o.points.length - 1];
        let next: Chain | null = null;
        if (same(tail, a)) next = append(c, o);
        else if (same(tail, z)) next = append(c, reversed(o));
        else if (same(head, z)) next = append(o, c);
        else if (same(head, a)) next = append(reversed(o), c);
        if (next) {
          c = next;
          left.splice(k, 1);
          grew = true;
          break;
        }
      }
    }
    if (c.ids.length >= 2) out.push(c);
  }
  return out;
}

/**
 * Foga ihop de markerade linjerna. Svarar med id:na som blev kvar, eller
 * null om inget delade en ände.
 */
export function fuseLines(store: DocStore, ids: readonly Id[]): Id[] | null {
  const doc = store.doc;
  const chains = fuseChains(doc, ids);
  const ramps = fuseRampChains(doc, ids);
  if (!chains.length && !ramps.length) return null;
  const kept: Id[] = [];
  const count = chains.reduce((n, c) => n + c.ids.length, 0) + ramps.reduce((n, c) => n + c.ids.length, 0);
  store.transact(ramps.length && !chains.length ? (count > 2 ? 'Docka ramper' : 'Docka två ramper') : count > 2 ? 'Foga ihop linjer' : 'Foga ihop två linjer', (tx) => {
    // Ramperna (0.10.19): den första får den dockade linjen, de andra tas bort.
    for (const c of ramps) {
      const el = tx.doc.elements[c.ids[0]];
      if (!el) continue;
      const params: Record<string, unknown> = { ...el.params };
      for (const k of RAMP_KEYS) {
        if (c.params[k] === undefined) delete params[k];
        else params[k] = c.params[k];
      }
      tx.putElement({ ...el, params });
      for (const id of c.ids.slice(1)) tx.removeElement(id);
      kept.push(el.id);
    }
    for (const c of chains) {
      const el = tx.doc.elements[c.ids[0]];
      if (!el) continue;
      let pts = c.points;
      let bulges = c.bulges;
      const closed = pts.length >= 4 && same(pts[0], pts[pts.length - 1]);
      // Den sista punkten är samma som den första; den sista kanten går tillbaka till början.
      if (closed) pts = pts.slice(0, -1);
      if (!closed) bulges = bulges.slice(0, pts.length - 1);
      while (bulges.length && Math.abs(bulges[bulges.length - 1]) < 0.5) bulges = bulges.slice(0, -1);
      const spline = el.params.shape === 'spline';
      const params: Record<string, unknown> = { ...el.params, points: pts, bulges: spline || !bulges.length ? undefined : bulges.map((b) => (Math.abs(b) < 0.5 ? 0 : b)), closed: closed || undefined };
      if (closed) {
        delete params.startCap;
        delete params.endCap;
      } else {
        params.startCap = c.startCap;
        params.endCap = c.endCap;
      }
      for (const k of Object.keys(params)) if (params[k] === undefined) delete params[k];
      tx.putElement({ ...el, params });
      for (const id of c.ids.slice(1)) tx.removeElement(id);
      kept.push(el.id);
    }
  });
  return kept;
}
