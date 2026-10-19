import { bulgeTangent, bulgeThrough } from '../geometry/arc';
import { wallFrame, type WallFrame } from '../geometry/wallFrame';
import { geometryOf, isArc, movePatch, putWallEnds, transformed, type PlanTransform } from './commands';
import { newId } from './ids';
import type { Element, Id, ProjectDoc } from './model';
import type { DocStore, TxBuilder } from './store';

/**
 * Formändringar av väggar (0.7): det som Modifiera-paletten gör. Allt går
 * genom vanliga transaktioner och ångras i ett steg.
 */

type P = [number, number];
const round = (q: readonly [number, number]): P => [Math.round(q[0]), Math.round(q[1])];
const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Ramen för referenslinjen (inte mittlinjen): s längs linjen som man ritat den. */
export function refFrame(doc: ProjectDoc, el: Element): WallFrame {
  return wallFrame({ ...geometryOf(doc, el), justification: 'center' });
}

/** Flytta dörrar och fönster till den vägg (av flera) de hamnar i, med nytt läge. */
function rehost(tx: TxBuilder, before: ProjectDoc, from: Element, targets: Element[]): void {
  const f0 = wallFrame(geometryOf(before, from));
  const frames = targets.map((t) => ({ t, f: wallFrame(geometryOf(tx.doc, t)) }));
  for (const h of Object.values(before.elements)) {
    if (h.host !== from.id || typeof h.params.at !== 'number') continue;
    const world = f0.at(h.params.at as number, 0);
    let best: { id: Id; at: number; d: number } | null = null;
    for (const { t, f } of frames) {
      const [s, o] = f.project(world);
      const d = Math.abs(o) + Math.max(0, -s, s - f.length);
      if (!best || d < best.d) best = { id: t.id, at: Math.round(s), d };
    }
    if (best) tx.putElement({ ...tx.doc.elements[h.id], host: best.id, params: { ...tx.doc.elements[h.id].params, at: best.at } });
  }
}

/**
 * Dela en vägg i en punkt på referenslinjen (Lägg till punkt). Med `moveTo`
 * flyttas den nya punkten dit, så att väggen blir två raka väggar med ett
 * hörn. Bågväggar delas i två bågar. Svarar med den nya väggens id.
 */
export function splitWall(store: DocStore, wallId: Id, at: readonly [number, number], moveTo?: readonly [number, number]): Id | null {
  const doc = store.doc;
  const el = doc.elements[wallId];
  if (!el || el.type !== 'Wall') return null;
  const f = refFrame(doc, el);
  const [s] = f.project(at);
  if (s < 20 || s > f.length - 20) return null;
  const p = el.params as { start: P; end: P; bulge?: number };
  const mid = round(f.at(s, 0));
  const node = moveTo ? round(moveTo) : mid;
  const id = newId('wa');
  store.transact('Lägg till punkt', (tx) => {
    let first: Element;
    let second: Element;
    if (isArc(el) && !moveTo) {
      // Två bågar på samma cirkel.
      const b1 = bulgeThrough(p.start, mid, f.at(s / 2, 0));
      const b2 = bulgeThrough(mid, p.end, f.at((s + f.length) / 2, 0));
      first = { ...el, params: { ...el.params, end: mid, bulge: b1 } };
      second = { ...structuredClone(el), id, params: { ...structuredClone(el.params), start: mid, bulge: b2 } };
    } else {
      first = { ...el, params: { ...el.params, end: node, bulge: 0 } };
      second = { ...structuredClone(el), id, params: { ...structuredClone(el.params), start: node, bulge: 0 } };
    }
    tx.putElement(first);
    tx.putElement(second);
    rehost(tx, doc, el, [first, second]);
  });
  return id;
}

/** Ny form för en vägg: ändpunkter och pilhöjd. Dörrar och fönster står kvar. */
export function reshapeWall(store: DocStore, wallId: Id, start: readonly [number, number], end: readonly [number, number], bulge: number, label = 'Böj väggen'): void {
  const el = store.doc.elements[wallId];
  if (!el) return;
  store.transact(label, (tx) => putWallEnds(tx, tx.doc.elements[wallId], round(start), round(end), { bulge: Math.round(bulge * 10) / 10 }));
}

/**
 * Båge med tangent: väggen blir en båge som fortsätter i riktningen `tangent`
 * från den fasta änden, och den andra änden flyttas till `to`. Väggar som
 * sitter i den flyttade änden följer med.
 */
export function tangentArc(store: DocStore, wallId: Id, fixed: 'start' | 'end', tangent: readonly [number, number], to: readonly [number, number]): void {
  const doc = store.doc;
  const el = doc.elements[wallId];
  if (!el) return;
  const p = el.params as { start: P; end: P };
  const A = p[fixed];
  const moving = fixed === 'start' ? 'end' : 'start';
  const old = p[moving];
  const C = round(to);
  const b = bulgeTangent(A, C, tangent);
  // Pilhöjden räknas från start mot slut; går bågen åt andra hållet byts tecknet.
  const bulge = fixed === 'start' ? b : -b;
  store.transact('Båge med tangent', (tx) => {
    const start = fixed === 'start' ? A : C;
    const end = fixed === 'start' ? C : A;
    putWallEnds(tx, tx.doc.elements[wallId], start, end, { bulge: Math.round(bulge * 10) / 10 });
    for (const w of Object.values(tx.doc.elements)) {
      if (w.type !== 'Wall' || w.id === wallId || w.storey !== el.storey) continue;
      const q = w.params as { start: P; end: P };
      if (dist(q.start, old) <= 1) putWallEnds(tx, w, C, q.end);
      else if (dist(q.end, old) <= 1) putWallEnds(tx, w, q.start, C);
    }
  });
}

/** Riktningen in i väggen från en ände (bort från änden, längs väggen). */
function awayFrom(doc: ProjectDoc, el: Element, end: 'start' | 'end'): [number, number] {
  const f = refFrame(doc, el);
  const t = f.tangent(end === 'start' ? 0 : f.length);
  return end === 'start' ? [t[0], t[1]] : [-t[0], -t[1]];
}

/** Den andra väggen som har en ände i samma punkt, om det finns precis en. */
export function cornerPartner(doc: ProjectDoc, wallId: Id, end: 'start' | 'end'): { id: Id; end: 'start' | 'end' } | null {
  const el = doc.elements[wallId];
  if (!el) return null;
  const pt = (el.params as { start: P; end: P })[end];
  const found: { id: Id; end: 'start' | 'end' }[] = [];
  for (const w of Object.values(doc.elements)) {
    if (w.type !== 'Wall' || w.id === wallId || w.storey !== el.storey) continue;
    const q = w.params as { start: P; end: P };
    if (dist(q.start, pt) <= 1) found.push({ id: w.id, end: 'start' });
    else if (dist(q.end, pt) <= 1) found.push({ id: w.id, end: 'end' });
  }
  return found.length === 1 ? found[0] : null;
}

/** Tangenten man fortsätter i från en vägg in genom dess ände (för Båge med tangent). */
export function continuingTangent(doc: ProjectDoc, wallId: Id, end: 'start' | 'end'): [number, number] {
  const a = awayFrom(doc, doc.elements[wallId], end);
  return [-a[0], -a[1]];
}

/**
 * Avrunda eller fasa ett hörn mellan två raka väggar. Väggarna kortas till
 * tangentpunkterna och en ny vägg (en båge eller en rak fasvägg) läggs in.
 * `size` är radien (avrundning) eller avståndet från hörnet (fasning).
 */
export function roundCorner(store: DocStore, wallId: Id, end: 'start' | 'end', size: number, kind: 'fillet' | 'chamfer'): Id | null {
  const doc = store.doc;
  const partner = cornerPartner(doc, wallId, end);
  const w1 = doc.elements[wallId];
  if (!partner || !w1 || size <= 0) return null;
  const w2 = doc.elements[partner.id];
  if (isArc(w1) || isArc(w2)) return null;
  const C = (w1.params as { start: P; end: P })[end];
  const d1 = awayFrom(doc, w1, end);
  const d2 = awayFrom(doc, w2, partner.end);
  const cos = Math.max(-1, Math.min(1, d1[0] * d2[0] + d1[1] * d2[1]));
  const theta = Math.acos(cos);
  if (theta < 0.02 || theta > Math.PI - 0.02) return null;
  const t = kind === 'fillet' ? size / Math.tan(theta / 2) : size;
  const len1 = refFrame(doc, w1).length;
  const len2 = refFrame(doc, w2).length;
  if (t >= len1 - 10 || t >= len2 - 10) return null;
  const T1 = round([C[0] + d1[0] * t, C[1] + d1[1] * t]);
  const T2 = round([C[0] + d2[0] * t, C[1] + d2[1] * t]);
  const bulge = kind === 'fillet' ? bulgeTangent(T1, T2, [-d1[0], -d1[1]]) : 0;
  const p1 = w1.params as { start: P; end: P; justification?: string };
  // Den nya väggen går från w1 mot w2. Gick w1 bort från hörnet byter sidorna plats.
  const j = p1.justification ?? 'center';
  const justification = end === 'end' ? j : j === 'left' ? 'right' : j === 'right' ? 'left' : j;
  const id = newId('wa');
  store.transact(kind === 'fillet' ? 'Avrunda hörn' : 'Fasa hörn', (tx) => {
    const a = tx.doc.elements[wallId];
    const pa = a.params as { start: P; end: P };
    putWallEnds(tx, a, end === 'start' ? T1 : pa.start, end === 'end' ? T1 : pa.end);
    const b = tx.doc.elements[partner.id];
    const pb = b.params as { start: P; end: P };
    putWallEnds(tx, b, partner.end === 'start' ? T2 : pb.start, partner.end === 'end' ? T2 : pb.end);
    const params = { ...structuredClone(a.params), start: T1, end: T2, justification, bulge: Math.round(bulge * 10) / 10 } as Record<string, unknown>;
    delete params.toRoof;
    tx.putElement({ ...structuredClone(a), id, params });
  });
  return id;
}

/** Slå ihop två väggar som möts i en punkt till en (Ta bort punkt). */
export function mergeAtCorner(store: DocStore, wallId: Id, end: 'start' | 'end'): boolean {
  const doc = store.doc;
  const partner = cornerPartner(doc, wallId, end);
  const w1 = doc.elements[wallId];
  if (!partner || !w1) return false;
  const w2 = doc.elements[partner.id];
  const p2 = w2.params as { start: P; end: P };
  const far2 = partner.end === 'start' ? p2.end : p2.start;
  const p1 = w1.params as { start: P; end: P };
  store.transact('Ta bort punkt', (tx) => {
    const next = { ...w1, params: { ...w1.params, start: end === 'start' ? far2 : p1.start, end: end === 'end' ? far2 : p1.end, bulge: 0 } };
    putWallEnds(tx, w1, next.params.start as P, next.params.end as P, { bulge: 0 });
    rehost(tx, doc, w2, [tx.doc.elements[wallId]]);
    tx.removeElement(partner.id);
  });
  return true;
}

/**
 * Förläng eller korta en väggände till en annan väggs referenslinje
 * (Förläng till). Väggen får en T-skarv mot den andra.
 */
export function extendTo(store: DocStore, wallId: Id, end: 'start' | 'end', targetId: Id): boolean {
  const doc = store.doc;
  const w = doc.elements[wallId];
  const t = doc.elements[targetId];
  if (!w || !t || w.type !== 'Wall' || t.type !== 'Wall' || isArc(w) || isArc(t)) return false;
  const p = w.params as { start: P; end: P };
  const q = t.params as { start: P; end: P };
  const fixed = end === 'start' ? p.end : p.start;
  const r: P = [p[end][0] - fixed[0], p[end][1] - fixed[1]];
  const s: P = [q.end[0] - q.start[0], q.end[1] - q.start[1]];
  const den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-9) return false;
  const k = ((q.start[0] - fixed[0]) * s[1] - (q.start[1] - fixed[1]) * s[0]) / den;
  if (k <= 0) return false;
  const hit = round([fixed[0] + r[0] * k, fixed[1] + r[1] * k]);
  store.transact('Förläng till', (tx) => putWallEnds(tx, tx.doc.elements[wallId], end === 'start' ? hit : p.start, end === 'end' ? hit : p.end));
  return true;
}

/**
 * Förskjut alla kanter: de markerade raka väggarna flyttas vinkelrätt ut
 * (positivt avstånd) eller in från sin gemensamma mitt, och hörnen mellan dem
 * räknas om. Ändar på andra väggar i hörnen följer med.
 */
export function offsetGeometry(doc: ProjectDoc, ids: readonly Id[], distance: number): Map<Id, { start: P; end: P }> {
  const walls = ids.map((id) => doc.elements[id]).filter((e): e is Element => !!e && e.type === 'Wall' && !isArc(e));
  const out = new Map<Id, { start: P; end: P }>();
  if (!walls.length) return out;
  const mids = walls.map((w) => {
    const p = w.params as { start: P; end: P };
    return [(p.start[0] + p.end[0]) / 2, (p.start[1] + p.end[1]) / 2];
  });
  const c = [mids.reduce((s, m) => s + m[0], 0) / mids.length, mids.reduce((s, m) => s + m[1], 0) / mids.length];
  const lines = new Map<Id, { a: P; d: P; o: P }>();
  walls.forEach((w, i) => {
    const p = w.params as { start: P; end: P };
    const len = dist(p.start, p.end) || 1;
    const d: P = [(p.end[0] - p.start[0]) / len, (p.end[1] - p.start[1]) / len];
    let n: P = [-d[1], d[0]];
    // Utåt: bort från mitten. En ensam vägg flyttas åt vänster.
    if (walls.length > 1 && (mids[i][0] - c[0]) * n[0] + (mids[i][1] - c[1]) * n[1] < 0) n = [-n[0], -n[1]];
    const o: P = [n[0] * distance, n[1] * distance];
    lines.set(w.id, { a: [p.start[0] + o[0], p.start[1] + o[1]], d, o });
  });
  for (const w of walls) {
    const p = w.params as { start: P; end: P };
    const L = lines.get(w.id)!;
    const endFor = (pt: P): P => {
      for (const v of walls) {
        if (v.id === w.id) continue;
        const q = v.params as { start: P; end: P };
        if (dist(q.start, pt) > 1 && dist(q.end, pt) > 1) continue;
        const M = lines.get(v.id)!;
        const den = L.d[0] * M.d[1] - L.d[1] * M.d[0];
        if (Math.abs(den) < 1e-9) continue;
        const k = ((M.a[0] - L.a[0]) * M.d[1] - (M.a[1] - L.a[1]) * M.d[0]) / den;
        return round([L.a[0] + L.d[0] * k, L.a[1] + L.d[1] * k]);
      }
      return round([pt[0] + L.o[0], pt[1] + L.o[1]]);
    };
    out.set(w.id, { start: endFor(p.start), end: endFor(p.end) });
  }
  return out;
}

export function offsetWalls(store: DocStore, ids: readonly Id[], distance: number): void {
  const doc = store.doc;
  const next = offsetGeometry(doc, ids, distance);
  if (!next.size) return;
  store.transact('Förskjut alla kanter', (tx) => {
    // Gamla och nya hörn, för väggar utanför markeringen som sitter i dem.
    const moved: { from: P; to: P }[] = [];
    for (const [id, g] of next) {
      const el = tx.doc.elements[id];
      const p = el.params as { start: P; end: P };
      moved.push({ from: p.start, to: g.start }, { from: p.end, to: g.end });
      putWallEnds(tx, el, g.start, g.end);
    }
    for (const w of Object.values(tx.doc.elements)) {
      if (w.type !== 'Wall' || next.has(w.id)) continue;
      const q = w.params as { start: P; end: P };
      const s = moved.find((m) => dist(m.from, q.start) <= 1);
      const e = moved.find((m) => dist(m.from, q.end) <= 1);
      if (s || e) putWallEnds(tx, w, s ? s.to : q.start, e ? e.to : q.end);
    }
  });
}

/**
 * Kopiera i rad: `count` kopior, var och en `step` längre bort än den
 * förra. Med count 1 blir det en parallell kopia.
 */
export function multiplyElements(store: DocStore, ids: readonly Id[], step: readonly [number, number], count: number, label?: string): Id[] {
  const doc = store.doc;
  const pick = new Set(ids.filter((id) => doc.elements[id] && !doc.elements[id].host));
  for (const e of Object.values(doc.elements)) if (e.host && pick.has(e.host)) pick.add(e.id);
  const made: Id[] = [];
  const n = Math.max(1, Math.min(200, Math.round(count)));
  store.transact(label ?? (n === 1 ? 'Kopiera' : `Kopiera i rad (${n})`), (tx) => {
    for (let k = 1; k <= n; k++) {
      const map = new Map<Id, Id>();
      for (const id of pick) map.set(id, newId(doc.elements[id].type.slice(0, 2).toLowerCase()));
      const d: [number, number] = [step[0] * k, step[1] * k];
      for (const id of pick) {
        const el = doc.elements[id];
        const params = structuredClone(el.params) as Record<string, unknown>;
        delete params.number;
        const copy: Element = { ...structuredClone(el), id: map.get(id)!, host: el.host ? map.get(el.host) : undefined, params };
        // Dörrar och fönster följer sin kopierade vägg och flyttas inte själva.
        const patch = el.host && pick.has(el.host) ? null : movePatch(doc, copy, d);
        tx.putElement(patch ? { ...copy, params: { ...copy.params, ...patch } } : copy);
        if (ids.includes(id)) made.push(copy.id);
      }
    }
  });
  return made;
}

/** Spegla det markerade i en linje genom a och b. */
export function mirrorAbout(store: DocStore, ids: readonly Id[], a: readonly [number, number], b: readonly [number, number]): void {
  const len = dist(a, b);
  if (len < 1) return;
  const ux = (b[0] - a[0]) / len;
  const uy = (b[1] - a[1]) / len;
  const axis = (Math.atan2(uy, ux) * 180) / Math.PI;
  const t: PlanTransform = {
    map: ([x, y]) => {
      const rx = x - a[0];
      const ry = y - a[1];
      const along = rx * ux + ry * uy;
      return [Math.round(a[0] + 2 * along * ux - rx), Math.round(a[1] + 2 * along * uy - ry)];
    },
    angle: (deg) => (((2 * axis - deg) % 360) + 360) % 360,
    mirror: true,
  };
  const moving = new Set(ids);
  for (const e of Object.values(store.doc.elements)) if (e.host && moving.has(e.host)) moving.add(e.id);
  store.transact('Spegla', (tx) => {
    for (const id of ids) {
      const el = tx.doc.elements[id];
      if (!el || el.host) continue;
      for (const e of transformed(tx.doc, el, t, moving)) tx.putElement(e);
    }
  });
}
