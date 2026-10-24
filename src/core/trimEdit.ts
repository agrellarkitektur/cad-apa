import { isArc, putWallEnds } from "./commands";
import { newId } from "./ids";
import type { Element, Id, ProjectDoc } from "./model";
import type { DocStore } from "./store";
import { openingSpans, refFrame, rehost, splitWall } from "./wallEdit";

/**
 * Trimma, Hörnskarv och Dela (0.8.13): för raka väggar och för 2D-linjer
 * (linje och öppen polylinje). Allt går genom vanliga transaktioner och
 * ångras i ett steg.
 */

type P = [number, number];
type Seg = { a: readonly [number, number]; b: readonly [number, number] };

const round = (q: readonly number[]): P => [Math.round(q[0]), Math.round(q[1])];
const dist = (a: readonly number[], b: readonly number[]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Var sträckan a–b korsar sträckan c–d, som andel av a–b; null om de inte korsas. */
function crossing(
  a: readonly number[],
  b: readonly number[],
  c: readonly number[],
  d: readonly number[],
): number | null {
  const r = [b[0] - a[0], b[1] - a[1]];
  const s = [d[0] - c[0], d[1] - c[1]];
  const den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-9) return null;
  const qa = [c[0] - a[0], c[1] - a[1]];
  const t = (qa[0] * s[1] - qa[1] * s[0]) / den;
  const u = (qa[0] * r[1] - qa[1] * r[0]) / den;
  const eps = 1e-6;
  return t >= -eps && t <= 1 + eps && u >= -eps && u <= 1 + eps ? t : null;
}

/** Längden fram till varje punkt i en öppen linje. */
function cumulative(pts: readonly P[]): number[] {
  const out = [0];
  for (let i = 1; i < pts.length; i++)
    out.push(out[i - 1] + dist(pts[i - 1], pts[i]));
  return out;
}

/** Punkten och läget längs linjen närmast `q`. */
function project(
  pts: readonly P[],
  q: readonly number[],
): { s: number; d: number } {
  const cum = cumulative(pts);
  let best = { s: 0, d: Infinity };
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const l = dist(a, b);
    const t = l
      ? Math.max(
          0,
          Math.min(
            1,
            ((q[0] - a[0]) * (b[0] - a[0]) + (q[1] - a[1]) * (b[1] - a[1])) /
              (l * l),
          ),
        )
      : 0;
    const f = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const d = dist(f, q);
    if (d < best.d) best = { s: cum[i] + l * t, d };
  }
  return best;
}

/** Punkten på linjen vid läget s. */
function pointAt(pts: readonly P[], cum: readonly number[], s: number): P {
  for (let i = 0; i + 1 < pts.length; i++) {
    if (s <= cum[i + 1] || i + 2 === pts.length) {
      const l = cum[i + 1] - cum[i] || 1;
      const t = Math.max(0, Math.min(1, (s - cum[i]) / l));
      return round([
        pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t,
        pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t,
      ]);
    }
  }
  return round(pts[pts.length - 1]);
}

/** Linjen mellan lägena s0 och s1. */
function slice(pts: readonly P[], s0: number, s1: number): P[] {
  const cum = cumulative(pts);
  const out: P[] = [pointAt(pts, cum, s0)];
  for (let i = 1; i + 1 < pts.length; i++)
    if (cum[i] > s0 + 0.5 && cum[i] < s1 - 0.5) out.push(round(pts[i]));
  out.push(pointAt(pts, cum, s1));
  return out;
}

/**
 * Trimma en öppen linje: biten mellan de två skärningarna närmast klicket
 * tas bort (eller från klicket ut till änden, om det inte finns någon
 * skärning på den sidan). Svarar med bitarna som blir kvar och var den
 * borttagna biten började och slutade, eller null om inget korsar linjen.
 */
export function trimPath(
  pts: readonly P[],
  cutters: readonly Seg[],
  click: readonly number[],
): { pieces: P[][]; cut: P[]; lo: number; hi: number } | null {
  if (pts.length < 2) return null;
  const cum = cumulative(pts);
  const L = cum[cum.length - 1];
  const cuts: number[] = [];
  for (let i = 0; i + 1 < pts.length; i++)
    for (const c of cutters) {
      const t = crossing(pts[i], pts[i + 1], c.a, c.b);
      if (t === null) continue;
      const s = cum[i] + (cum[i + 1] - cum[i]) * t;
      if (s > 1 && s < L - 1) cuts.push(s);
    }
  if (!cuts.length) return null;
  const sc = project(pts, click).s;
  const lo = Math.max(0, ...cuts.filter((s) => s < sc));
  const hi = Math.min(L, ...cuts.filter((s) => s > sc));
  if (lo <= 0 && hi >= L) return null;
  const pieces: P[][] = [];
  if (lo > 0) pieces.push(slice(pts, 0, lo));
  if (hi < L) pieces.push(slice(pts, hi, L));
  return { pieces, cut: slice(pts, lo, hi), lo, hi };
}

/** Väggarnas referenslinjer på samma våning, utom väggen själv, att trimma mot. */
export function wallCutters(doc: ProjectDoc, el: Element): Seg[] {
  const out: Seg[] = [];
  for (const w of Object.values(doc.elements)) {
    if (w.type !== "Wall" || w.id === el.id || w.storey !== el.storey) continue;
    const q = w.params as { start: P; end: P };
    if (!isArc(w)) {
      out.push({ a: q.start, b: q.end });
      continue;
    }
    const f = refFrame(doc, w);
    const pts = f.trace(0, f.length, 0);
    for (let i = 0; i + 1 < pts.length; i++)
      out.push({ a: pts[i], b: pts[i + 1] });
  }
  return out;
}

export type EditResult =
  { ok: true; ids: Id[] } | { ok: false; reason: string; blocked?: Id[] };

/**
 * Trimma en rak vägg mot de andra väggarnas referenslinjer: biten där man
 * klickade tas bort. Ligger den mitt i väggen blir väggen två väggar.
 */
export function trimWall(
  store: DocStore,
  wallId: Id,
  click: readonly number[],
): EditResult {
  const doc = store.doc;
  const el = doc.elements[wallId];
  if (!el || el.type !== "Wall")
    return { ok: false, reason: "Klicka på en vägg." };
  if (isArc(el))
    return { ok: false, reason: "Bågväggar går inte att trimma än." };
  const p = el.params as { start: P; end: P };
  const r = trimPath([p.start, p.end], wallCutters(doc, el), click);
  if (!r) return { ok: false, reason: "Ingen annan vägg korsar väggen där." };
  const blocked = openingSpans(doc, wallId)
    .filter((o) => o.to > r.lo && o.from < r.hi)
    .map((o) => o.id);
  if (blocked.length) return { ok: false, reason: "trimmas bort", blocked };
  const ids: Id[] = [wallId];
  store.transact("Trimma", (tx) => {
    const [first, second] = r.pieces;
    putWallEnds(tx, tx.doc.elements[wallId], first[0], first[first.length - 1]);
    if (second) {
      const id = newId("wa");
      ids.push(id);
      const copy: Element = {
        ...structuredClone(el),
        id,
        params: {
          ...structuredClone(el.params),
          start: second[0],
          end: second[second.length - 1],
          bulge: 0,
        },
      };
      tx.putElement(copy);
      // Dörrar och fönster till den bit de ligger i.
      rehost(tx, doc, el, [tx.doc.elements[wallId], copy]);
    }
  });
  return { ok: true, ids };
}

/** Den nya linjen när änden närmast skärningen `x` flyttas dit; klicket visar vilken sida som blir kvar. */
function toward(a: P, b: P, x: P, click: readonly number[]): [P, P] {
  const u = [b[0] - a[0], b[1] - a[1]];
  const s = (q: readonly number[]) =>
    (q[0] - a[0]) * u[0] + (q[1] - a[1]) * u[1];
  return s(x) >= s(click) ? [a, x] : [x, b];
}

/** Skärningen mellan två oändliga linjer, eller null om de är parallella. */
function meet(
  a: readonly number[],
  b: readonly number[],
  c: readonly number[],
  d: readonly number[],
): P | null {
  const r = [b[0] - a[0], b[1] - a[1]];
  const s = [d[0] - c[0], d[1] - c[1]];
  const den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den;
  return round([a[0] + r[0] * t, a[1] + r[1] * t]);
}

/**
 * Hörnskarv: två raka väggar förlängs eller kortas till ett rent hörn där
 * referenslinjerna möts. Klicken visar vilken del av varje vägg som blir kvar.
 */
export function joinWalls(
  store: DocStore,
  aId: Id,
  aClick: readonly number[],
  bId: Id,
  bClick: readonly number[],
): EditResult {
  const doc = store.doc;
  const a = doc.elements[aId];
  const b = doc.elements[bId];
  if (!a || !b || a.type !== "Wall" || b.type !== "Wall" || aId === bId)
    return { ok: false, reason: "Klicka på en annan vägg." };
  if (isArc(a) || isArc(b))
    return { ok: false, reason: "Bågväggar går inte att skarva än." };
  const pa = a.params as { start: P; end: P };
  const pb = b.params as { start: P; end: P };
  const x = meet(pa.start, pa.end, pb.start, pb.end);
  if (!x) return { ok: false, reason: "Väggarna är parallella." };
  const na = toward(pa.start, pa.end, x, aClick);
  const nb = toward(pb.start, pb.end, x, bClick);
  if (dist(na[0], na[1]) < 10 || dist(nb[0], nb[1]) < 10)
    return { ok: false, reason: "Väggen blir för kort." };
  // Dörrar och fönster måste rymmas i de nya väggarna.
  const outside = (el: Element, n: [P, P]) => {
    const p = el.params as { start: P; end: P };
    const u = [p.end[0] - p.start[0], p.end[1] - p.start[1]];
    const l = Math.hypot(u[0], u[1]) || 1;
    const s = (q: P) =>
      ((q[0] - p.start[0]) * u[0] + (q[1] - p.start[1]) * u[1]) / l;
    const lo = s(n[0]);
    const hi = s(n[1]);
    return openingSpans(doc, el.id)
      .filter((o) => o.from < lo || o.to > hi)
      .map((o) => o.id);
  };
  const blocked = [...outside(a, na), ...outside(b, nb)];
  if (blocked.length) return { ok: false, reason: "hamnar utanför", blocked };
  store.transact("Hörnskarv", (tx) => {
    putWallEnds(tx, tx.doc.elements[aId], na[0], na[1]);
    putWallEnds(tx, tx.doc.elements[bId], nb[0], nb[1]);
  });
  return { ok: true, ids: [aId, bId] };
}

/** Dela en vägg i en punkt, utan att lägga till ett hörn. */
export function splitWallAt(
  store: DocStore,
  wallId: Id,
  at: readonly [number, number],
): EditResult {
  const id = splitWall(store, wallId, at);
  return id
    ? { ok: true, ids: [wallId, id] }
    : { ok: false, reason: "Klicka en bit in på väggen, inte vid en ände." };
}

// ---------- 2D-linjer ----------

/** Om 2D-linjen är en linje eller en öppen polylinje, som går att trimma och dela. */
export function isOpenLine(el: Element | undefined): boolean {
  if (!el || el.type !== "Line2D") return false;
  const shape = (el.params.shape as string) ?? "line";
  return shape === "line" || (shape === "polyline" && !el.params.closed);
}

export const linePoints = (el: Element): P[] =>
  ((el.params.points as P[]) ?? []).map((q) => [q[0], q[1]]);

/** Väggens referenslinje eller 2D-linjens punkter. */
export function pathOf(el: Element): P[] {
  if (el.type === "Wall") {
    const q = el.params as { start: P; end: P };
    return [q.start, q.end];
  }
  return linePoints(el);
}

/** Ny 2D-linje med samma utseende och andra punkter. */
function lineCopy(el: Element, pts: P[]): Element {
  return {
    ...structuredClone(el),
    id: newId("li"),
    params: {
      ...structuredClone(el.params),
      shape: pts.length > 2 ? "polyline" : "line",
      points: pts,
    },
  };
}

/** Parametrarna för en del av en linje. */
const piece = (el: Element, pts: P[]) => ({
  ...el,
  params: {
    ...el.params,
    shape: pts.length > 2 ? "polyline" : "line",
    points: pts,
  },
});

/** Trimma en 2D-linje mot linjerna i `cutters` (väggar, liv, andra 2D-linjer och underlag). */
export function trimLine(
  store: DocStore,
  id: Id,
  cutters: readonly Seg[],
  click: readonly number[],
): EditResult {
  const el = store.doc.elements[id];
  if (!isOpenLine(el))
    return {
      ok: false,
      reason: "Bara linjer och öppna polylinjer går att trimma.",
    };
  const r = trimPath(linePoints(el), cutters, click);
  if (!r) return { ok: false, reason: "Ingenting korsar linjen där." };
  const ids: Id[] = [id];
  store.transact("Trimma", (tx) => {
    const [first, second] = r.pieces;
    tx.putElement(piece(tx.doc.elements[id], first));
    if (second) {
      const copy = lineCopy(el, second);
      ids.push(copy.id);
      tx.putElement(copy);
    }
  });
  return { ok: true, ids };
}

/** Hörnskarv för två raka 2D-linjer. */
export function joinLines(
  store: DocStore,
  aId: Id,
  aClick: readonly number[],
  bId: Id,
  bClick: readonly number[],
): EditResult {
  const doc = store.doc;
  const a = doc.elements[aId];
  const b = doc.elements[bId];
  const straight = (el: Element | undefined) =>
    !!el &&
    el.type === "Line2D" &&
    ((el.params.shape as string) ?? "line") === "line";
  if (!straight(a) || !straight(b) || aId === bId)
    return { ok: false, reason: "Klicka på en annan rak linje." };
  const [a0, a1] = linePoints(a);
  const [b0, b1] = linePoints(b);
  const x = meet(a0, a1, b0, b1);
  if (!x) return { ok: false, reason: "Linjerna är parallella." };
  const na = toward(a0, a1, x, aClick);
  const nb = toward(b0, b1, x, bClick);
  if (dist(na[0], na[1]) < 1 || dist(nb[0], nb[1]) < 1)
    return { ok: false, reason: "Linjen blir för kort." };
  store.transact("Hörnskarv", (tx) => {
    tx.putElement(piece(tx.doc.elements[aId], na));
    tx.putElement(piece(tx.doc.elements[bId], nb));
  });
  return { ok: true, ids: [aId, bId] };
}

/** Dela en 2D-linje i en punkt: två linjer med samma utseende. */
export function splitLine(
  store: DocStore,
  id: Id,
  at: readonly number[],
): EditResult {
  const el = store.doc.elements[id];
  if (!isOpenLine(el))
    return {
      ok: false,
      reason: "Bara linjer och öppna polylinjer går att dela.",
    };
  const pts = linePoints(el);
  const L = cumulative(pts).at(-1)!;
  const { s } = project(pts, at);
  if (s < 1 || s > L - 1)
    return {
      ok: false,
      reason: "Klicka en bit in på linjen, inte vid en ände.",
    };
  const copy = lineCopy(el, slice(pts, s, L));
  store.transact("Dela", (tx) => {
    tx.putElement(piece(tx.doc.elements[id], slice(pts, 0, s)));
    tx.putElement(copy);
  });
  return { ok: true, ids: [id, copy.id] };
}

/** Om ett element går att trimma eller dela (vägg eller öppen 2D-linje). */
export function canTrim(el: Element | undefined): boolean {
  return !!el && ((el.type === "Wall" && !isArc(el)) || isOpenLine(el));
}

/** Om ett element går att hörnskarva (rak vägg eller rak 2D-linje). */
export function canJoin(el: Element | undefined): boolean {
  return (
    !!el &&
    ((el.type === "Wall" && !isArc(el)) ||
      (el.type === "Line2D" &&
        ((el.params.shape as string) ?? "line") === "line"))
  );
}
