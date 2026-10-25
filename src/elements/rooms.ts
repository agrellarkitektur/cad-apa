import type { Element, Id, ProjectDoc, RoomNumbering } from '../core/model';
import { boxOf, union, type Box, type Rings } from '../geometry/boolean';
import { pointInRings } from '../geometry/vec';
import type { Vec2 } from '../repr/primitives';
import { shapePoints, type FillPattern, type Shape2DParams } from './drawing2d';
import type { PlanContext } from './registry';
import { lastResults } from '../repr/reuse';
import { bareWallUnion, wallFrame, type OpeningParams, type WallParams } from './wall';

/**
 * Rummens konturer ur väggarna: väggarna slås ihop (utan öppningar), och
 * hålen i väggmassan är rummen. Ett rum som skapats genom att klicka i ett
 * hål minns punkten och följer väggarna när de flyttas. 2D-linjer som
 * avgränsar rum (0.8.34) räknas som tunna väggar.
 */
export function roomHoles(walls: { id: string; p: WallParams }[], bounds: { id: string; p: Shape2DParams }[] = []): Vec2[][] {
  // Samma väggar ger samma hål (0.8.3): ett nytt rum eller en flyttad dörr räknar inte om dem.
  return savedHoles([...walls.flatMap((w) => [w.id, w.p]), bounds.length, ...bounds.flatMap((b) => [b.id, b.p])], () => {
    const mass = bareWallUnion(walls);
    const all = bounds.length ? union([...mass, ...bounds.flatMap((b) => boundaryStrips(b.p))]) : mass;
    return all.flatMap((poly) => poly.slice(1));
  });
}
const savedHoles = lastResults<Vec2[][]>();

/** Rumsgränsens bredd i mm (0.8.34): tunn nog att inte märkas i arean. */
export const BOUNDARY_WIDTH = 1;

/**
 * En rumsgräns som tunna rektanglar, en per segment, förlängda lika mycket
 * i båda ändar så att de säkert når väggen eller nästa segment.
 */
export function boundaryStrips(p: Pick<Shape2DParams, 'shape' | 'points' | 'closed' | 'bulges'>): Rings[] {
  const { points, closed } = shapePoints(p);
  const out: Rings[] = [];
  const h = BOUNDARY_WIDTH / 2;
  const n = closed ? points.length : points.length - 1;
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 1e-6) continue;
    const d: Vec2 = [((b[0] - a[0]) / len) * BOUNDARY_WIDTH, ((b[1] - a[1]) / len) * BOUNDARY_WIDTH];
    const m: Vec2 = [(-d[1] * h) / BOUNDARY_WIDTH, (d[0] * h) / BOUNDARY_WIDTH];
    const s: Vec2 = [a[0] - d[0], a[1] - d[1]];
    const e: Vec2 = [b[0] + d[0], b[1] + d[1]];
    out.push([[[s[0] + m[0], s[1] + m[1]], [e[0] + m[0], e[1] + m[1]], [e[0] - m[0], e[1] - m[1]], [s[0] - m[0], s[1] - m[1]]]]);
  }
  return out;
}

/** 2D-formerna som avgränsar rum (0.8.34), i modellen (inte på blad). */
export function isRoomBoundary(el: Element): boolean {
  return el.type === 'Shape2D' && !el.space && !!(el.params as { boundsRooms?: boolean }).boundsRooms;
}

/** Det minsta hålet som innehåller punkten. */
export function holeAt(holes: readonly Vec2[][], pt: Vec2): Vec2[] | null {
  let best: Vec2[] | null = null;
  let bestArea = Infinity;
  for (const { ring: h, box, area: a } of ringsOf(holes)) {
    if (outsideBox(pt, box) || !pointInRings(pt, [h])) continue;
    if (a < bestArea) {
      best = h;
      bestArea = a;
    }
  }
  return best;
}

/** Konturer med omslutande rektangel och area, räknade en gång per lista (0.8.1). */
type RingInfo = { ring: Vec2[]; box: Box; area: number };
const ringInfo = new WeakMap<readonly Vec2[][], RingInfo[]>();

function ringsOf(rings: readonly Vec2[][]): RingInfo[] {
  let info = ringInfo.get(rings);
  if (!info) ringInfo.set(rings, (info = rings.map((ring) => ({ ring, box: boxOf([ring]), area: Math.abs(signedArea(ring)) }))));
  return info;
}

/**
 * Säkert utanför konturen: utanför rektangeln i höjdled, eller mer än 1 mm
 * utanför den i sidled. `pointInRings` ger då alltid false, så provet kan
 * hoppas över utan att svaret ändras.
 */
function outsideBox(p: Vec2, b: Box): boolean {
  return p[1] < b[1] || p[1] > b[3] || p[0] < b[0] - 1 || p[0] > b[2] + 1;
}

/** Hålen för väggarna som syns i en vy. */
export function roomHolesFor(ctx: PlanContext): Vec2[][] {
  return ctx.memo('room-holes', () =>
    roomHoles(
      ctx.visible('Wall').map((el) => ({ id: el.id, p: ctx.params<WallParams>(el) })),
      ctx.roomBounds().map((el) => ({ id: el.id, p: ctx.params<Shape2DParams>(el) })),
    ),
  );
}

export interface SpaceParams {
  /** Konturen, sparad när rummet skapades eller ritades för hand. */
  outline: [number, number][];
  /** Punkten man klickade i. Finns den räknas konturen om från väggarna. */
  seed?: [number, number];
  /** Rumsnummer när numreringen är låst. */
  number?: string;
  /**
   * Rumsstämpelns mittpunkt när den dragits dit (0.8.17). Saknas den står
   * stämpeln i rummets mitt. Utanför rummet får den en pil in i rummet.
   */
  labelAt?: [number, number];
  /** Takhöjd i mm, visas som TH i rumsetiketten. */
  ceilingHeight?: number;
  /**
   * Fyllningen (0.8.25), med samma inställningar som 2D-formernas: mönster,
   * färg, vinkel, avstånd och opacitet (`opacity`). Bakom väggarna.
   */
  fill?: FillPattern;
  /** En egen fyllningstyp (0.8.36), som 2D-formernas. */
  fillType?: string;
  fillTypeAngle?: number;
  fillTypeScale?: number;
  fillColor?: string;
  fillAngle?: number;
  fillSpacing?: number;
  opacity?: number;
  /** Skrafferingens bakgrund och dess opacitet (0.8.29), som 2D-formernas. */
  fillBackground?: string;
  fillBackgroundOpacity?: number;
}

/** Rummets kontur i vyn: ur väggarna om det har en punkt, annars den sparade. */
export function spaceOutline(ctx: PlanContext, el: Element<SpaceParams>): Vec2[] {
  const p = ctx.params<SpaceParams>(el);
  if (p.seed) {
    const h = holeAt(roomHolesFor(ctx), p.seed);
    if (h) return h;
  }
  return p.outline;
}

export function numberingOf(doc: ProjectDoc): RoomNumbering {
  return { digits: 4, building: '1', locked: false, ...(doc.project.roomNumbering ?? {}) };
}

/**
 * Rumsnummer för rummen i vyn. Numreringen går i vänstervarv: från entrén
 * följer man vänster vägg genom huset, som i en labyrint, och rummen får
 * nummer i den ordning man kommer in i dem. Rum som inte nås genom någon
 * dörr numreras efteråt, uppifrån och från vänster. Låst numrering behåller
 * de sparade numren.
 */
export function roomNumbersFor(ctx: PlanContext): Map<Id, string> {
  return ctx.memo('room-numbers', () => {
    const numbering = numberingOf(ctx.doc);
    return numberList(ctx, walkOrder(ctx).rooms, prefixFor(ctx), '', numbering.locked);
  });
}

/**
 * Dörrarnas individuella nummer, D + samma siffror som rummen: D1203 är
 * tredje dörren på plan 2 i byggnad 1. Dörrarna numreras i den ordning man
 * passerar dem i vänstervarvet. Ett nummer skrivet på dörren går före.
 */
export function doorNumbersFor(ctx: PlanContext): Map<Id, string> {
  return ctx.memo('door-numbers', () =>
    numberList(ctx, walkOrder(ctx).doors, prefixFor(ctx), 'D', !!ctx.doc.project.doorNumbering?.locked),
  );
}

function prefixFor(ctx: PlanContext): string {
  const numbering = numberingOf(ctx.doc);
  const storeys = [...ctx.doc.storeys].sort((a, b) => a.elevation - b.elevation);
  const any = ctx.visible()[0];
  const plan = String(Math.max(0, storeys.findIndex((s) => s.id === any?.storey)) + 1);
  return numbering.digits === 4 ? `${numbering.building}${plan}` : plan;
}

/** Löpnummer i ordningen; låst numrering behåller sparade nummer och ger nya nästa lediga. */
function numberList(ctx: PlanContext, order: Id[], prefix: string, letter: string, locked: boolean): Map<Id, string> {
  const out = new Map<Id, string>();
  const make = (i: number) => `${letter}${prefix}${String(i).padStart(2, '0')}`;
  if (!locked) {
    order.forEach((id, i) => out.set(id, make(i + 1)));
    return out;
  }
  const stored = new Map<Id, string>();
  for (const id of order) {
    const n = (ctx.doc.elements[id]?.params as { number?: string } | undefined)?.number;
    if (n) stored.set(id, n);
  }
  const head = `${letter}${prefix}`;
  let next = Math.max(0, ...[...stored.values()].filter((n) => n.startsWith(head)).map((n) => Number(n.slice(head.length)) || 0)) + 1;
  for (const id of order) out.set(id, stored.get(id) ?? make(next++));
  return out;
}

/** Vänstervarvet genom planen, en gång per ritning. */
function walkOrder(ctx: PlanContext): { rooms: Id[]; doors: Id[] } {
  return ctx.memo('walk-order', () => computeOrder(ctx, ctx.visible('Space')));
}

interface Room {
  id: Id;
  ring: Vec2[];
  perimeter: number;
}

interface Door {
  id: Id;
  point: Vec2;
  width: number;
  main: boolean;
  rooms: [Id | null, Id | null];
}

function computeOrder(ctx: PlanContext, spaces: Element[]): { rooms: Id[]; doors: Id[] } {
  // Konturerna medurs, så att längden längs konturen går åt höger hand.
  const rooms: Room[] = spaces
    .map((el) => {
      let ring = spaceOutline(ctx, el as unknown as Element<SpaceParams>).map((q) => [q[0], q[1]] as Vec2);
      if (signedArea(ring) > 0) ring = [...ring].reverse();
      return { id: el.id, ring, perimeter: perimeterOf(ring) };
    })
    .filter((r) => r.ring.length >= 3);
  const info = ringsOf(rooms.map((r) => r.ring));
  const roomAt = (pt: Vec2): Id | null => {
    let best = -1;
    rooms.forEach((_, i) => {
      if (!outsideBox(pt, info[i].box) && pointInRings(pt, [rooms[i].ring]) && (best < 0 || info[i].area < info[best].area)) best = i;
    });
    return best < 0 ? null : rooms[best].id;
  };

  // Dörrarna och vilka rum de förbinder (null = ute).
  const doors: Door[] = [];
  for (const d of ctx.visible('Door')) {
    // Dörrar som rivs varken förbinder rum eller numreras.
    if (ctx.actionOf(d) === 'demolished') continue;
    const host = d.host ? ctx.doc.elements[d.host] : undefined;
    if (!host) continue;
    const f = wallFrame(ctx.params<WallParams>(host));
    const p = ctx.params<OpeningParams & { mainEntrance?: boolean }>(d);
    const probe = f.half + 150;
    const a = roomAt(f.at(p.at, probe));
    const b = roomAt(f.at(p.at, -probe));
    doors.push({ id: d.id, point: f.at(p.at, 0), width: p.width, main: !!p.mainEntrance, rooms: [a, b] });
  }

  const order: Id[] = [];
  const doorOrder: Id[] = [];
  const passed = new Set<Id>();
  const pass = (id: Id) => {
    if (!passed.has(id)) {
      passed.add(id);
      doorOrder.push(id);
    }
  };
  const seen = new Set<Id>();
  const byId = new Map(rooms.map((r) => [r.id, r]));
  // Dörrarna i varje rum, i dörrarnas ordning.
  const doorsIn = new Map<Id, Door[]>();
  for (const d of doors)
    for (const r of new Set(d.rooms)) {
      if (!r) continue;
      const list = doorsIn.get(r);
      if (list) list.push(d);
      else doorsIn.set(r, [d]);
    }

  const visit = (roomId: Id, entry: Vec2, via: Id | null) => {
    if (seen.has(roomId)) return;
    seen.add(roomId);
    order.push(roomId);
    const room = byId.get(roomId)!;
    const s0 = paramOn(room.ring, entry);
    const exits = (doorsIn.get(roomId) ?? [])
      .filter((d) => d.id !== via)
      .map((d) => ({ d, s: (paramOn(room.ring, d.point) - s0 + room.perimeter) % room.perimeter }))
      .sort((a, b) => a.s - b.s);
    for (const { d } of exits) {
      pass(d.id);
      const other = d.rooms[0] === roomId ? d.rooms[1] : d.rooms[0];
      if (other) visit(other, d.point, d.id);
    }
  };

  // Entrén: dörren som är markerad som huvudentré, annars den bredaste
  // ytterdörren, och den längst ned (söderut) om flera.
  const entrances = doors
    .filter((d) => d.rooms.includes(null) && d.rooms[0] !== d.rooms[1])
    .sort((a, b) => Number(b.main) - Number(a.main) || b.width - a.width || a.point[1] - b.point[1] || a.point[0] - b.point[0]);
  for (const e of entrances) {
    const inside = e.rooms[0] ?? e.rooms[1];
    pass(e.id);
    if (inside) visit(inside, e.point, e.id);
  }
  // Övriga rum, uppifrån och från vänster.
  const rest = rooms
    .filter((r) => !seen.has(r.id))
    .map((r) => ({ r, c: centroidOf(r.ring) }))
    .sort((a, b) => b.c[1] - a.c[1] || a.c[0] - b.c[0]);
  for (const { r } of rest) visit(r.id, r.ring[0], null);
  // Dörrar som inte passerades (t.ex. utan rum på någon sida), uppifrån och från vänster.
  doors
    .filter((d) => !passed.has(d.id))
    .sort((a, b) => b.point[1] - a.point[1] || a.point[0] - b.point[0])
    .forEach((d) => pass(d.id));
  return { rooms: order, doors: doorOrder };
}

export function signedArea(ring: readonly Vec2[]): number {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

function perimeterOf(ring: readonly Vec2[]): number {
  let l = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    l += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return l || 1;
}

/** Var längs konturen (mm från första hörnet) som ligger närmast punkten. */
function paramOn(ring: readonly Vec2[], pt: Vec2): number {
  let best = Infinity;
  let at = 0;
  let acc = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) continue;
    const t = Math.max(0, Math.min(1, ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / (len * len)));
    const d = Math.hypot(a[0] + dx * t - pt[0], a[1] + dy * t - pt[1]);
    if (d < best) {
      best = d;
      at = acc + t * len;
    }
    acc += len;
  }
  return at;
}

export function centroidOf(pts: readonly Vec2[]): Vec2 {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    const k = x1 * y2 - x2 * y1;
    a += k;
    cx += (x1 + x2) * k;
    cy += (y1 + y2) * k;
  }
  if (Math.abs(a) < 1e-9) return pts[0];
  return [cx / (3 * a), cy / (3 * a)];
}
