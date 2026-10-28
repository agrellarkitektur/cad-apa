import { along, flatPoints, lineLength, offsetArcLine, PATH_WIDTH, reversedBulges, tidyBulges } from './groundLines';
import { rampLevels } from './rampProfile';
import { rampSideLines, refPoints, type EasePoint, type RampParams } from './groundRamp';

type P = readonly [number, number];

/**
 * Ändringar i rampens referenslinje (0.10.18–0.10.19, för sig sedan
 * 0.10.21.1): höjderna och övergångarna när punkterna ändrats, förlängning i
 * en ände, rampen baklänges och två ramper dockade (Foga ihop).
 */

/**
 * Punkternas höjder (och övergångar) när referenslinjens punkter ändrats:
 * med lika många punkter följer de punkternas nummer (en punkt som flyttats
 * behåller sin höjd); annars punkterna som ligger kvar där de låg, och en
 * punkt som försvunnit (ett avrundat hörn) ger sin höjd till den nya
 * punkten närmast.
 */
export function remapLevels(before: readonly P[], after: readonly P[], levels: (number | null)[] | undefined): (number | null)[] | undefined {
  if (!levels?.some((v) => typeof v === 'number')) return undefined;
  return tidyLevels(remapPerPoint(before, after, levels, (v) => typeof v === 'number'));
}

/** Som `remapLevels`, för övergångarna i punkterna; ändarna följer också med. */
export function remapEases(before: readonly P[], after: readonly P[], eases: (EasePoint | null)[] | undefined): (EasePoint | null)[] | undefined {
  if (!eases?.some(Boolean)) return undefined;
  return tidyEases(remapPerPoint(before, after, eases, Boolean, true));
}

function remapPerPoint<T>(before: readonly P[], after: readonly P[], values: readonly (T | null)[], has: (v: T | null | undefined) => boolean, ends = false): (T | null)[] {
  const out: (T | null)[] = after.map(() => null);
  const inner = (i: number, n: number) => ends || (i > 0 && i < n - 1);
  if (before.length === after.length) {
    for (let i = 0; i < after.length; i++) if (inner(i, after.length)) out[i] = has(values[i]) ? values[i]! : null;
    return out;
  }
  const taken = new Set<number>();
  for (let i = 0; i < before.length; i++) {
    const v = values[i];
    if (!has(v) || !inner(i, before.length)) continue;
    const k = after.findIndex((q, j) => inner(j, after.length) && !taken.has(j) && Math.hypot(q[0] - before[i][0], q[1] - before[i][1]) < 1);
    if (k >= 0) {
      out[k] = v!;
      taken.add(k);
    }
  }
  // Punkter som försvann (ett avrundat eller fasat hörn): höjden till den
  // nya punkten närmast, om den inte redan har en. En borttagen punkt ger
  // inget till grannarna, som fanns förut.
  const existed = (q: P) => before.some((b) => Math.hypot(q[0] - b[0], q[1] - b[1]) < 1);
  for (let i = 0; i < before.length; i++) {
    const v = values[i];
    if (!has(v) || !inner(i, before.length)) continue;
    if (after.some((q, j) => inner(j, after.length) && Math.hypot(q[0] - before[i][0], q[1] - before[i][1]) < 1)) continue;
    let best = -1;
    let bd = Infinity;
    after.forEach((q, j) => {
      if (!inner(j, after.length) || taken.has(j) || has(out[j]) || existed(q)) return;
      const d = Math.hypot(q[0] - before[i][0], q[1] - before[i][1]);
      if (d < bd) {
        bd = d;
        best = j;
      }
    });
    if (best >= 0) {
      out[best] = v!;
      taken.add(best);
    }
  }
  return out;
}

/** Höjderna som parameter: utan tomma platser sist, utelämnade när ingen punkt har en. */
export function tidyLevels(levels: (number | null)[]): (number | null)[] | undefined {
  const out = [...levels];
  while (out.length && typeof out[out.length - 1] !== 'number') out.pop();
  return out.some((v) => typeof v === 'number') ? out : undefined;
}

/** Övergångarna som parameter: utan tomma platser sist, utelämnade när ingen punkt har en egen. */
export function tidyEases(eases: (EasePoint | null | undefined)[]): (EasePoint | null)[] | undefined {
  const out = eases.map((e) => e ?? null);
  while (out.length && !out[out.length - 1]) out.pop();
  return out.some(Boolean) ? out : undefined;
}

/**
 * Rampen förlängd (0.10.18) med nya punkter i början eller slutet. Den
 * gamla änden behåller sin höjd som en punkt med höjd, och den nya änden
 * får höjden som rampens sista (eller första) sträcka ger, så att lutningen
 * fortsätter (avrundad till 10 mm). Ritade sidor förlängs lika långt från referenslinjen som de
 * låg vid den gamla änden. Bågarna sitter kvar på sina kanter, och de nya
 * kanterna kan ha bågar (`addedBulges`, en per ny punkt, 0.10.19).
 */
export function extendRamp(p: RampParams, atStart: boolean, added: readonly P[], addedBulges?: readonly number[]): Partial<RampParams> {
  const ref = ((p.line ?? []) as P[]).map((q): [number, number] => [q[0], q[1]]);
  if (ref.length < 2 || !added.length) return {};
  const pts = added.map((q): [number, number] => [Math.round(q[0]), Math.round(q[1])]);
  const tail = atStart ? [ref[0], ...pts] : [ref[ref.length - 1], ...pts];
  const tailBulges = Array.from({ length: pts.length }, (_, i) => Number(addedBulges?.[i]) || 0);
  const levels = rampLevels(p);
  // Höjden fortsätter med lutningen i rampens sista sträcka (första, från början).
  const run = atStart ? levels.slice(0, 2) : levels.slice(-2);
  const grade = run.length === 2 && run[1].s - run[0].s > 1 ? (run[1].h - run[0].h) / (run[1].s - run[0].s) : 0;
  const more = lineLength(flatPoints(tail, tailBulges));
  const oldEnd = atStart ? (p.height ?? 0) : (p.endHeight ?? p.height ?? 0);
  // Från början räknas lutningen bakåt, så höjden ändras åt andra hållet.
  const newH = Math.round((atStart ? oldEnd - grade * more : oldEnd + grade * more) / 10) * 10;
  const line = atStart ? [...[...pts].reverse(), ...ref] : [...ref, ...pts];
  const old = [...(p.levels ?? [])];
  while (old.length < ref.length) old.push(null);
  const lv = atStart ? [...pts.map(() => null), ...old] : [...old.slice(0, ref.length), ...pts.map(() => null)];
  const oldIdx = atStart ? pts.length : ref.length - 1;
  lv[oldIdx] = oldEnd;
  const oldEases = [...(p.eases ?? [])];
  while (oldEases.length < ref.length) oldEases.push(null);
  const es = atStart ? [...pts.map(() => null), ...oldEases] : [...oldEases.slice(0, ref.length), ...pts.map(() => null)];
  const patch: Partial<RampParams> = atStart ? { line, height: newH, levels: tidyLevels(lv) } : { line, endHeight: newH, levels: tidyLevels(lv) };
  if (p.eases) patch.eases = tidyEases(es);
  const bulges = joinedBulges(p.bulges, ref.length, tailBulges, atStart);
  if (bulges || p.bulges) patch.bulges = bulges;
  const flatRef = refPoints(p);
  for (const side of ['left', 'right'] as const) {
    const own = p[side];
    if (!own || own.length < 2) continue;
    const end = atStart ? own[0] : own[own.length - 1];
    // Sett längs den nya biten, som går bakåt från början.
    const lat = along(flatRef, end[0], end[1]).lat * (atStart ? -1 : 1);
    const off = offsetArcLine(tail, tailBulges, lat);
    const ext = off.points.slice(1).map((q): [number, number] => [Math.round(q[0]), Math.round(q[1])]);
    patch[side] = atStart ? [...ext.reverse(), ...own] : [...own, ...ext];
    const key = side === 'left' ? 'leftBulges' : 'rightBulges';
    const sb = joinedBulges(p[key], own.length, Array.from({ length: ext.length }, (_, i) => Number(off.bulges?.[i]) || 0), atStart);
    if (sb || p[key]) patch[key] = sb;
  }
  return patch;
}

/** Pilhöjderna för linjen med en bit (`tailBulges`, kanterna från den gamla änden utåt) lagd till i början eller slutet. */
function joinedBulges(bulges: readonly number[] | undefined, n: number, tailBulges: readonly number[], atStart: boolean): number[] | undefined {
  const full = Array.from({ length: n - 1 }, (_, i) => Number(bulges?.[i]) || 0);
  // I början ligger den nya biten baklänges: kanterna i omvänd ordning och åt andra hållet.
  const tail = atStart ? [...tailBulges].reverse().map((b) => -b) : [...tailBulges];
  const all = atStart ? [...tail, ...full] : [...full, ...tail];
  return tidyBulges(all, all.length + 1);
}

/**
 * Rampen baklänges (0.10.19): referenslinjen och sidorna vänds, början och
 * slutet byter plats, vänster och höger byter sida och tvärfallet vänder.
 */
export function reversedRamp(p: RampParams): RampParams {
  const ref = (p.line ?? []) as [number, number][];
  const n = ref.length;
  const h0 = p.height ?? 0;
  const h1 = p.endHeight ?? h0;
  const lv = Array.from({ length: n }, (_, i) => p.levels?.[i] ?? null).reverse();
  const es = Array.from({ length: n }, (_, i) => p.eases?.[i] ?? null).reverse();
  const out: RampParams = {
    ...p,
    line: [...ref].reverse(),
    bulges: reversedBulges(p.bulges, n),
    height: h1,
    endHeight: h0,
    levels: tidyLevels(lv),
    eases: tidyEases(es),
    left: p.right ? [...p.right].reverse() : undefined,
    right: p.left ? [...p.left].reverse() : undefined,
    leftBulges: p.right ? reversedBulges(p.rightBulges, p.right.length) : undefined,
    rightBulges: p.left ? reversedBulges(p.leftBulges, p.left.length) : undefined,
    leftEdge: p.rightEdge,
    rightEdge: p.leftEdge,
    crossFall: typeof p.crossFall === 'number' ? -p.crossFall : undefined,
    refSide: p.refSide === 'left' ? 'right' : p.refSide === 'right' ? 'left' : p.refSide,
    refOffset: (p.refSide ?? 'center') === 'center' && typeof p.refOffset === 'number' ? -p.refOffset : p.refOffset,
  };
  for (const k of Object.keys(out) as (keyof RampParams)[]) if (out[k] === undefined) delete out[k];
  return out;
}

/**
 * Två ramper dockade (0.10.19): `a`:s slut möter `b`:s början, och `b`
 * fortsätter från `a`:s sista punkt (som får sin höjd som en punkt med höjd;
 * `b`:s första punkt faller bort). Sidorna: ritade om någon av dem är det
 * eller om bredderna skiljer, annars följer de referenslinjen som förut.
 * Inställningarna (kanterna, tvärfallet, övergångarna) är `a`:s.
 */
export function fusedRamp(a: RampParams, b: RampParams): RampParams {
  const ra = (a.line ?? []) as [number, number][];
  const rb = (b.line ?? []) as [number, number][];
  const na = ra.length;
  const line = [...ra, ...rb.slice(1)];
  const n = line.length;
  const ba = Array.from({ length: na - 1 }, (_, i) => Number(a.bulges?.[i]) || 0);
  const bb = Array.from({ length: rb.length - 1 }, (_, i) => Number(b.bulges?.[i]) || 0);
  const lv: (number | null)[] = Array.from({ length: n }, () => null);
  for (let i = 1; i < na - 1; i++) lv[i] = a.levels?.[i] ?? null;
  lv[na - 1] = a.endHeight ?? a.height ?? 0;
  for (let i = 1; i < rb.length - 1; i++) lv[na - 1 + i] = b.levels?.[i] ?? null;
  const es: (EasePoint | null)[] = Array.from({ length: n }, () => null);
  for (let i = 0; i < na; i++) es[i] = a.eases?.[i] ?? null;
  for (let i = 1; i < rb.length; i++) es[na - 1 + i] = b.eases?.[i] ?? null;
  const sameWidth = (a.width ?? PATH_WIDTH) === (b.width ?? PATH_WIDTH) && (a.refSide ?? 'center') === (b.refSide ?? 'center') && (a.refOffset ?? 0) === (b.refOffset ?? 0);
  const drawn = !!(a.left || a.right || b.left || b.right) || !sameWidth;
  const out: RampParams = {
    ...a,
    line,
    bulges: tidyBulges([...ba, ...bb], n),
    endHeight: b.endHeight ?? b.height ?? 0,
    levels: tidyLevels(lv),
    eases: tidyEases(es),
  };
  if (drawn) {
    const sa = rampSideLines(a);
    const sb = rampSideLines(b);
    for (const side of ['left', 'right'] as const) {
      const pa = sa[side].points;
      const pb = sb[side].points;
      // Ligger sidornas ändar i samma punkt behövs den bara en gång.
      const skip = pa.length && pb.length && Math.hypot(pa[pa.length - 1][0] - pb[0][0], pa[pa.length - 1][1] - pb[0][1]) < 1 ? 1 : 0;
      const pts = [...pa, ...pb.slice(skip)].map((q): [number, number] => [Math.round(q[0]), Math.round(q[1])]);
      const fa = Array.from({ length: pa.length - 1 }, (_, i) => Number(sa[side].bulges?.[i]) || 0);
      const fb = Array.from({ length: pb.length - 1 }, (_, i) => Number(sb[side].bulges?.[i]) || 0);
      out[side] = pts;
      const key = side === 'left' ? 'leftBulges' : 'rightBulges';
      out[key] = tidyBulges([...fa, ...(skip ? [] : [0]), ...fb], pts.length);
    }
  }
  for (const k of Object.keys(out) as (keyof RampParams)[]) if (out[k] === undefined) delete out[k];
  return out;
}

