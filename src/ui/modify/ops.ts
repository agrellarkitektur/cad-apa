import { moveOnly } from '../../core/sheets';
import type { Id } from '../../core/model';
import { canScale } from '../../core/arrange';
import { canJoin, canTrim } from '../../core/trimEdit';
import { cornerPartner, cornersAmong, refFrame } from '../../core/wallEdit';
import { isShape, shapeCan, shapeEdgeAt, shapeNodes } from '../../elements/shapeEdit';
import { dist, sub } from '../../geometry/vec';
import type { Vec2 } from '../../repr/primitives';
import type { ViewPointer, ViewTool } from '../../view2d/planView';
import type { IconName } from '../icons';
import { pxToMm, type ToolHost } from '../tools/host';
import { roundMm } from '../tools/snap';

/**
 * Modifiera (0.7, smartmenyn 0.8.5): valen som finns för det markerade och
 * för det man klickat på i det. Vad som erbjuds beror på var man klickar:
 *
 * - på referenslinjen: lägg till punkt, böj, båge med tangent, förskjut …
 * - på en ände: ny vägg, sträck, förläng till
 * - på ett hörn mellan två väggar: avrunda, fasa, ta bort punkt
 * - någon annanstans på objektet: flytta, vrid, spegla, kopiera i rad
 *
 * Valen visas i smartmenyn (src/ui/smartMenu.ts) och i Modifiera-raden
 * (src/ui/app/modifyRail.ts); controller.ts håller reda på vad som pågår och
 * tool.ts kör det.
 */

export type ModifyKind = 'edge' | 'body' | 'point' | 'corner';

export interface ModifyContext {
  kind: ModifyKind;
  /** Det markerade. */
  ids: Id[];
  /** Väggen man klickade på, för kant, ände och hörn. */
  wallId?: Id;
  /** Taket man klickade på, med konturens hörn eller kant (0.7.1). */
  roofId?: Id;
  /** 2D-elementet man klickade på, med punktens eller kantens nummer (0.8 del 2). */
  shapeId?: Id;
  index?: number;
  end?: 'start' | 'end';
  /** Punkten man klickade (på referenslinjen för kanter), mm. */
  at: Vec2;
  /** Om `at` är där man klickade (inte mitten av en markering med ruta). */
  clicked?: boolean;
  /** Var i fönstret man klickade. */
  clientX: number;
  clientY: number;
}

export type OpId =
  | 'wallOn'
  | 'insert'
  | 'curve'
  | 'tangent'
  | 'straighten'
  | 'offset'
  | 'parallel'
  | 'offsetAll'
  | 'stretch'
  | 'extend'
  | 'fillet'
  | 'chamfer'
  | 'merge'
  | 'move'
  | 'rotate'
  | 'mirror'
  | 'multiply'
  | 'roofInsert'
  | 'roofMove'
  | 'roofRemove'
  | 'roofOffset'
  | 'shapeInsert'
  | 'shapeMove'
  | 'shapeRemove'
  | 'shapeOffset'
  | 'trim'
  | 'join'
  | 'split'
  | 'filletAll'
  | 'chamferAll'
  | 'align'
  | 'pick'
  | 'scale'
  | 'extendAll'
  | 'trimAll';

export interface OpDef {
  label: string;
  /** Kort text under ikonen. Hela namnet och förklaringen visas vid hovring. */
  short: string;
  icon: IconName;
  /** Ett värde som kan skrivas in, med enhet och förval. */
  value?: { label: string; unit: 'mm' | '°' | 'st' | '×'; initial: number };
  /** Utförs direkt när man väljer det, utan att klicka i ritningen. */
  instant?: boolean;
  hint: string;
}

export const OPS: Record<OpId, OpDef> = {
  wallOn: { label: 'Ny vägg härifrån', short: 'Ny vägg', icon: 'wall', hint: 'Klicka punkt för punkt, eller skriv en längd och tryck Enter. Samma typ och höjd som väggen. Esc avslutar.' },
  insert: { label: 'Lägg till punkt', short: 'Ny punkt', icon: 'insertNode', hint: 'Klicka där den nya punkten ska ligga. Väggen delas i två.' },
  curve: { label: 'Böj', short: 'Böj', icon: 'curveEdge', value: { label: 'Radie', unit: 'mm', initial: 3000 }, hint: 'Klicka en punkt som bågen ska gå igenom, eller skriv radien.' },
  tangent: { label: 'Båge med tangent', short: 'Tangent', icon: 'tangentArc', hint: 'Bågen fortsätter i grannväggens riktning. Klicka var änden ska hamna.' },
  straighten: { label: 'Räta ut', short: 'Räta ut', icon: 'straighten', instant: true, hint: 'Bågen blir rak igen.' },
  offset: { label: 'Förskjut', short: 'Förskjut', icon: 'offset', value: { label: 'Avstånd', unit: 'mm', initial: 100 }, hint: 'Väggen flyttas vinkelrätt; anslutna väggar följer med.' },
  parallel: { label: 'Parallell kopia', short: 'Parallell', icon: 'parallelCopy', value: { label: 'Avstånd', unit: 'mm', initial: 1000 }, hint: 'En kopia på avståndet, åt det håll du pekar.' },
  offsetAll: { label: 'Förskjut alla kanter', short: 'Alla kanter', icon: 'offsetAll', value: { label: 'Avstånd', unit: 'mm', initial: 100 }, hint: 'De markerade väggarna flyttas ut (eller in med minus); hörnen räknas om.' },
  stretch: { label: 'Sträck', short: 'Sträck', icon: 'stretch', value: { label: 'Längd', unit: 'mm', initial: 0 }, hint: 'Klicka var änden ska hamna, eller skriv en ny längd.' },
  extend: { label: 'Förläng till', short: 'Förläng', icon: 'extend', hint: 'Klicka på väggen som änden ska gå fram till.' },
  fillet: { label: 'Avrunda hörn', short: 'Avrunda', icon: 'fillet', value: { label: 'Radie', unit: 'mm', initial: 1000 }, hint: 'Skriv radien och tryck Enter, eller klicka för att använda den.' },
  chamfer: { label: 'Fasa hörn', short: 'Fasa', icon: 'chamfer', value: { label: 'Avstånd', unit: 'mm', initial: 600 }, hint: 'Skriv avståndet från hörnet och tryck Enter, eller klicka.' },
  merge: { label: 'Ta bort punkt', short: 'Ta bort', icon: 'merge', instant: true, hint: 'Två väggar som möts i hörnet blir en.' },
  move: { label: 'Flytta', short: 'Flytta', icon: 'move', hint: 'Klicka var det ska hamna. (Det går också att dra direkt.)' },
  rotate: { label: 'Vrid', short: 'Vrid', icon: 'rotate', value: { label: 'Vinkel', unit: '°', initial: 90 }, hint: 'Klicka en riktning att vrida från och sedan dit, eller skriv vinkeln.' },
  mirror: { label: 'Spegla', short: 'Spegla', icon: 'mirror', hint: 'Speglingslinjen går genom punkten du klickade; klicka linjens riktning.' },
  multiply: { label: 'Kopiera i rad', short: 'I rad', icon: 'multiply', value: { label: 'Antal', unit: 'st', initial: 3 }, hint: 'Klicka avståndet mellan kopiorna.' },
  roofInsert: { label: 'Lägg till punkt', short: 'Ny punkt', icon: 'insertNode', hint: 'Klicka där den nya punkten i takets kontur ska ligga.' },
  roofMove: { label: 'Flytta punkt', short: 'Flytta', icon: 'move', hint: 'Klicka var hörnet ska hamna.' },
  roofRemove: { label: 'Ta bort punkt', short: 'Ta bort', icon: 'merge', instant: true, hint: 'Hörnet tas bort; grannarna binds ihop med en rak kant.' },
  roofOffset: { label: 'Förskjut kant', short: 'Förskjut', icon: 'offset', value: { label: 'Avstånd', unit: 'mm', initial: 300 }, hint: 'Kanten flyttas vinkelrätt, utåt med plus; grannkanterna följer med.' },
  shapeInsert: { label: 'Lägg till punkt', short: 'Ny punkt', icon: 'insertNode', hint: 'Klicka där den nya punkten ska ligga.' },
  shapeMove: { label: 'Flytta punkt', short: 'Flytta', icon: 'move', hint: 'Klicka var punkten ska hamna. (Det går också att dra i den.)' },
  shapeRemove: { label: 'Ta bort punkt', short: 'Ta bort', icon: 'merge', instant: true, hint: 'Punkten tas bort; grannarna binds ihop.' },
  trim: { label: 'Trimma', short: 'Trimma', icon: 'trim', hint: 'Klicka på biten som ska bort. Den kapas där andra väggar eller linjer korsar.' },
  join: { label: 'Hörnskarv', short: 'Hörnskarv', icon: 'cornerJoin', hint: 'Klicka på den andra väggen eller linjen, på den del som ska vara kvar. Båda förlängs eller kortas till ett hörn.' },
  split: { label: 'Dela', short: 'Dela', icon: 'split', hint: 'Klicka där det ska delas. Det blir två, utan något hörn.' },
  filletAll: { label: 'Avrunda alla hörn', short: 'Avrunda alla', icon: 'filletAll', value: { label: 'Radie', unit: 'mm', initial: 1000 }, hint: 'Alla hörn mellan de markerade väggarna. Skriv radien och tryck Enter, eller klicka.' },
  chamferAll: { label: 'Fasa alla hörn', short: 'Fasa alla', icon: 'chamferAll', value: { label: 'Avstånd', unit: 'mm', initial: 600 }, hint: 'Alla hörn mellan de markerade väggarna. Skriv avståndet och tryck Enter, eller klicka.' },
  align: { label: 'Justera och fördela', short: 'Justera', icon: 'align', hint: 'Välj hur de ska ligga, eller klicka en linje, vägg eller kant att lägga dem mot.' },
  pick: { label: 'Hämta och överför', short: 'Pipett', icon: 'eyedropper', hint: 'Klicka på ett objekt av samma slag. Det markerade får dess typ och inställningar, men behåller sin form och sitt läge.' },
  scale: { label: 'Skala', short: 'Skala', icon: 'scale', value: { label: 'Faktor', unit: '×', initial: 2 }, hint: 'Klicka baspunkten, skriv faktorn eller klicka två punkter.' },
  extendAll: { label: 'Förläng alla till', short: 'Förläng alla', icon: 'extend', hint: 'Klicka på väggen eller linjen som de markerade ska förlängas fram till.' },
  trimAll: { label: 'Trimma mot gräns', short: 'Mot gräns', icon: 'trim', hint: 'Klicka på gränsen, sedan på den sida av den som ska bort.' },
  shapeOffset: { label: 'Förskjut kant', short: 'Förskjut', icon: 'offset', value: { label: 'Avstånd', unit: 'mm', initial: 100 }, hint: 'Kanten flyttas vinkelrätt dit du klickar, eller skriv avståndet; grannkanterna följer med.' },
};

const COMMON: OpId[] = ['move', 'rotate', 'mirror', 'multiply'];

/** Det som smartmenyn, Modifiera-raden och verktyget behöver från appen. */
export interface ModifyHost extends ToolHost {
  /** Starta verktyget för ett val (det ersätter Markera tills det är klart). */
  startModify(tool: ViewTool): void;
  /** Valet är klart eller avbrutet: tillbaka till Markera. */
  endModify(): void;
  /**
   * Ny vägg härifrån (0.8.4): väggverktyget börjar i väggens ände, med samma
   * typ. Svarar false om det inte går.
   */
  startWallFrom?(ctx: ModifyContext): boolean;
  /** Avbryt väggen som började i änden, när ett annat val görs eller menyn stängs. */
  stopWall?(): void;
}

/** Valen för ett klick, i den ordning de visas, med ett streck före de allmänna. */
export function opsFor(host: ToolHost & Partial<Pick<ModifyHost, 'startWallFrom'>>, ctx: ModifyContext): OpId[][] {
  const doc = host.store.doc;
  // Vyer, skalstockar och stämplar på ett blad (0.8.9, 0.8.12) går bara att flytta, också tillsammans med det som är ritat på bladet.
  if (ctx.ids.some((id) => moveOnly(doc, id))) return [['move']];
  const wall = ctx.wallId ? doc.elements[ctx.wallId] : undefined;
  const walls = ctx.ids.filter((id) => doc.elements[id]?.type === 'Wall');
  const cuts = editOps(host, ctx.ids);
  const withCuts = (groups: OpId[][]): OpId[][] => (cuts.length ? [...groups.slice(0, -1), cuts, groups[groups.length - 1]] : groups);
  if (ctx.shapeId) {
    const el = doc.elements[ctx.shapeId];
    const can = el ? shapeCan(el) : { insert: false, remove: false, offset: false };
    const own: OpId[] =
      ctx.kind === 'edge'
        ? [...(can.insert ? (['shapeInsert'] as OpId[]) : []), ...(can.offset ? (['shapeOffset'] as OpId[]) : [])]
        : ['shapeMove', ...(can.remove ? (['shapeRemove'] as OpId[]) : [])];
    return withCuts(own.length ? [own, COMMON] : [COMMON]);
  }
  if (ctx.roofId) {
    if (ctx.kind === 'edge') return [['roofInsert', 'roofOffset'], COMMON];
    if (ctx.kind === 'point') return [['roofMove', 'roofRemove'], COMMON];
  }
  switch (ctx.kind) {
    case 'edge': {
      const arc = wall && Math.abs(Number(wall.params.bulge ?? 0)) >= 0.5;
      const own: OpId[] = ['insert', 'curve', 'tangent'];
      if (arc) own.push('straighten');
      own.push('offset', 'parallel');
      if (walls.length >= 2) own.push('offsetAll');
      return withCuts([own, COMMON]);
    }
    case 'point':
      return [[...(wall && host.startWallFrom ? (['wallOn'] as OpId[]) : []), 'stretch', 'extend'], COMMON];
    case 'corner':
      return [[...(wall && host.startWallFrom ? (['wallOn'] as OpId[]) : []), 'stretch', 'fillet', 'chamfer', 'merge', ...(walls.length >= 2 ? (['offsetAll'] as OpId[]) : [])], COMMON];
    default: {
      // Flera väggar: förskjut alla kanter direkt från markeringen (0.8.5),
      // och avrunda eller fasa alla hörn mellan dem (0.8.13).
      const own: OpId[] = walls.length >= 2 ? ['offsetAll'] : [];
      if (walls.length >= 2 && cornersAmong(doc, walls).length) own.push('filletAll', 'chamferAll');
      const groups = withCuts(own.length ? [own, COMMON] : [COMMON]);
      const more = arrangeOps(host, ctx.ids);
      return more.length ? [...groups, more] : groups;
    }
  }
}

/** Justera, Pipett, Skala och Förläng/Trimma för flera (0.8.14), för det markerade som helhet. */
function arrangeOps(host: ToolHost, ids: readonly Id[]): OpId[] {
  const els = ids.map((id) => host.store.doc.elements[id]).filter(Boolean);
  const out: OpId[] = [];
  if (els.some((e) => !e.locked)) out.push('align', 'pick');
  if (els.some((e) => canScale(e))) out.push('scale');
  if (els.filter((e) => canTrim(e)).length >= 2) out.push('extendAll', 'trimAll');
  return out;
}

/** Trimma, Hörnskarv och Dela för det markerade (0.8.13), när det går. */
function editOps(host: ToolHost, ids: readonly Id[]): OpId[] {
  const els = ids.map((id) => host.store.doc.elements[id]);
  const out: OpId[] = [];
  if (els.some((e) => canTrim(e))) out.push('trim');
  if (els.some((e) => canJoin(e))) out.push('join');
  if (els.some((e) => canTrim(e))) out.push('split');
  return out;
}

/**
 * Vad ett klick på det markerade träffade: en ände, ett hörn, referenslinjen
 * eller något annat. Null om det inte är något som Modifiera gäller.
 */
export function modifyContextAt(host: ToolHost, p: ViewPointer, clientX: number, clientY: number, hitId: Id | null): ModifyContext | null {
  const doc = host.store.doc;
  const ids = host.selection.list();
  if (!ids.length) return null;
  const tol = pxToMm(host, p.pointerType === 'touch' ? 16 : 9);
  // Ändar på markerade väggar.
  for (const id of ids) {
    const el = doc.elements[id];
    if (el?.type !== 'Wall') continue;
    const q = el.params as { start: Vec2; end: Vec2 };
    for (const end of ['start', 'end'] as const) {
      if (dist(q[end], p.model) <= tol) {
        const kind: ModifyKind = cornerPartner(doc, id, end) ? 'corner' : 'point';
        return { kind, ids, wallId: id, end, at: q[end], clientX, clientY };
      }
    }
  }
  // Punkter och kanter i markerade 2D-element (0.8 del 2).
  const shown = new Set(host.plan().pickables.map((pk) => pk.id));
  for (const id of ids) {
    const el = doc.elements[id];
    if (!isShape(el) || !shown.has(id)) continue;
    const pts = shapeNodes(el);
    for (let i = 0; i < pts.length; i++) if (dist(pts[i], p.model) <= tol) return { kind: 'point', ids, shapeId: id, index: i, at: pts[i], clientX, clientY };
  }
  for (const id of ids) {
    const el = doc.elements[id];
    if (!isShape(el) || !shown.has(id)) continue;
    const e = shapeEdgeAt(el, p.model, tol);
    if (e) return { kind: 'edge', ids, shapeId: id, index: e.index, at: e.at, clientX, clientY };
  }
  // Hörn och kanter i markerade taks kontur.
  for (const id of ids) {
    const el = doc.elements[id];
    if (el?.type !== 'Roof') continue;
    const o = el.params.outline as Vec2[];
    for (let i = 0; i < o.length; i++) if (dist(o[i], p.model) <= tol) return { kind: 'point', ids, roofId: id, index: i, at: o[i], clientX, clientY };
    for (let i = 0; i < o.length; i++) {
      const a = o[i];
      const b = o[(i + 1) % o.length];
      const u = sub(b, a);
      const l2 = u[0] * u[0] + u[1] * u[1];
      const t = l2 ? ((p.model[0] - a[0]) * u[0] + (p.model[1] - a[1]) * u[1]) / l2 : -1;
      if (t <= 0 || t >= 1) continue;
      const q: Vec2 = [a[0] + u[0] * t, a[1] + u[1] * t];
      if (dist(q, p.model) <= tol) return { kind: 'edge', ids, roofId: id, index: i, at: roundMm(q), clientX, clientY };
    }
  }
  if (!hitId || !host.selection.has(hitId)) return null;
  const el = doc.elements[hitId];
  if (el?.type === 'Wall') {
    const f = refFrame(doc, el);
    const [s, o] = f.project(p.model);
    if (Math.abs(o) <= tol && s >= 0 && s <= f.length) {
      const at = f.at(s, 0);
      return { kind: 'edge', ids, wallId: hitId, at: [at[0], at[1]], clientX, clientY };
    }
  }
  return { kind: 'body', ids, wallId: el?.type === 'Wall' ? hitId : undefined, at: roundMm(p.model), clicked: true, clientX, clientY };
}

// ---------- Modifiera-raden (0.8.5) ----------

/** En knapp i Modifiera-raden: ett verb, som kan vara flera val (för vägg, tak och 2D). */
export type RailId =
  | 'move'
  | 'rotate'
  | 'mirror'
  | 'multiply'
  | 'offset'
  | 'parallel'
  | 'offsetAll'
  | 'wallOn'
  | 'stretch'
  | 'extend'
  | 'insert'
  | 'pointMove'
  | 'remove'
  | 'curve'
  | 'tangent'
  | 'straighten'
  | 'fillet'
  | 'chamfer'
  | 'trim'
  | 'join'
  | 'split'
  | 'align'
  | 'pick'
  | 'scale';

export interface RailDef {
  id: RailId;
  label: string;
  icon: IconName;
  ops: OpId[];
  /** Vad man ska klicka på när verktyget behöver en ände, ett hörn eller en kant. */
  ask?: string;
  /** Kortkommandot: Shift och bokstaven (0.8.13). */
  key: string;
}

/** Modifiera-radens knappar i grupper, i den ordning de visas. */
export const RAIL: RailDef[][] = [
  [
    { id: 'move', label: 'Flytta', icon: 'move', ops: ['move'], key: 'M' },
    { id: 'rotate', label: 'Vrid', icon: 'rotate', ops: ['rotate'], key: 'R' },
    { id: 'mirror', label: 'Spegla', icon: 'mirror', ops: ['mirror'], key: 'S' },
    { id: 'multiply', label: 'Kopiera i rad', icon: 'multiply', ops: ['multiply'], key: 'U' },
  ],
  [
    { id: 'offset', label: 'Förskjut', icon: 'offset', ops: ['offset', 'roofOffset', 'shapeOffset'], ask: 'Klicka på referenslinjen eller kanten som ska förskjutas.', key: 'O' },
    { id: 'parallel', label: 'Parallell kopia', icon: 'parallelCopy', ops: ['parallel'], ask: 'Klicka på referenslinjen för väggen som ska kopieras.', key: 'P' },
    { id: 'offsetAll', label: 'Förskjut alla kanter', icon: 'offsetAll', ops: ['offsetAll'], key: 'A' },
  ],
  [
    { id: 'wallOn', label: 'Ny vägg härifrån', icon: 'wall', ops: ['wallOn'], ask: 'Klicka på änden där den nya väggen ska börja.', key: 'W' },
    { id: 'stretch', label: 'Sträck', icon: 'stretch', ops: ['stretch'], ask: 'Klicka på änden som ska sträckas.', key: 'E' },
    { id: 'extend', label: 'Förläng till', icon: 'extend', ops: ['extend', 'extendAll'], ask: 'Klicka på änden som ska förlängas.', key: 'X' },
    { id: 'trim', label: 'Trimma', icon: 'trim', ops: ['trim', 'trimAll'], key: 'T' },
    { id: 'join', label: 'Hörnskarv', icon: 'cornerJoin', ops: ['join'], key: 'J' },
  ],
  [
    { id: 'insert', label: 'Lägg till punkt', icon: 'insertNode', ops: ['insert', 'roofInsert', 'shapeInsert'], ask: 'Klicka på referenslinjen eller kanten där punkten ska läggas till.', key: 'I' },
    { id: 'pointMove', label: 'Flytta punkt', icon: 'movePoint', ops: ['roofMove', 'shapeMove'], ask: 'Klicka på punkten som ska flyttas.', key: 'K' },
    { id: 'remove', label: 'Ta bort punkt', icon: 'merge', ops: ['merge', 'roofRemove', 'shapeRemove'], ask: 'Klicka på hörnet eller punkten som ska tas bort.', key: 'Q' },
    { id: 'split', label: 'Dela', icon: 'split', ops: ['split'], key: 'D' },
  ],
  [
    { id: 'curve', label: 'Böj', icon: 'curveEdge', ops: ['curve'], ask: 'Klicka på referenslinjen för väggen som ska böjas.', key: 'B' },
    { id: 'tangent', label: 'Båge med tangent', icon: 'tangentArc', ops: ['tangent'], ask: 'Klicka på referenslinjen för väggen som ska bli en båge.', key: 'G' },
    { id: 'straighten', label: 'Räta ut', icon: 'straighten', ops: ['straighten'], ask: 'Klicka på referenslinjen för bågen som ska rätas ut.', key: 'L' },
  ],
  [
    { id: 'fillet', label: 'Avrunda hörn', icon: 'fillet', ops: ['fillet', 'filletAll'], ask: 'Klicka på hörnet som ska avrundas.', key: 'F' },
    { id: 'chamfer', label: 'Fasa hörn', icon: 'chamfer', ops: ['chamfer', 'chamferAll'], ask: 'Klicka på hörnet som ska fasas.', key: 'C' },
  ],
  [
    { id: 'align', label: 'Justera och fördela', icon: 'align', ops: ['align'], key: 'N' },
    { id: 'pick', label: 'Hämta och överför', icon: 'eyedropper', ops: ['pick'], key: 'H' },
    { id: 'scale', label: 'Skala', icon: 'scale', ops: ['scale'], key: 'Y' },
  ],
];

export const RAIL_ITEMS: RailDef[] = RAIL.flat();

/** Knappen i raden som ett val hör till. */
export function railOf(op: OpId): RailDef | undefined {
  return RAIL_ITEMS.find((r) => r.ops.includes(op));
}

/**
 * Knapparna som går att använda för det markerade, någonstans i det: de tänds
 * svagt i raden. Räknas bara på det markerade, inte på hela våningen.
 */
export function railFor(host: ToolHost, ids: readonly Id[]): Set<RailId> {
  const doc = host.store.doc;
  const on = new Set<RailId>();
  if (ids.some((id) => moveOnly(doc, id))) return new Set<RailId>(['move']);
  const els = ids.map((id) => doc.elements[id]).filter(Boolean);
  if (!els.length) return on;
  for (const id of ['move', 'rotate', 'mirror', 'multiply'] as const) on.add(id);
  const walls = els.filter((e) => e.type === 'Wall');
  if (walls.length) {
    for (const id of ['wallOn', 'stretch', 'extend', 'insert', 'curve', 'tangent', 'offset', 'parallel'] as const) on.add(id);
    if (walls.length >= 2) on.add('offsetAll');
    if (walls.some((w) => Math.abs(Number(w.params.bulge ?? 0)) >= 0.5)) on.add('straighten');
    if (walls.some((w) => cornerPartner(doc, w.id, 'start') || cornerPartner(doc, w.id, 'end'))) {
      on.add('fillet');
      on.add('chamfer');
      on.add('remove');
    }
  }
  if (els.some((e) => e.type === 'Roof')) for (const id of ['insert', 'pointMove', 'remove', 'offset'] as const) on.add(id);
  for (const op of editOps(host, ids)) on.add(op as RailId);
  for (const op of arrangeOps(host, ids)) on.add(op === 'extendAll' ? 'extend' : op === 'trimAll' ? 'trim' : (op as RailId));
  for (const el of els) {
    if (!isShape(el)) continue;
    const can = shapeCan(el);
    on.add('pointMove');
    if (can.insert) on.add('insert');
    if (can.remove) on.add('remove');
    if (can.offset) on.add('offset');
  }
  return on;
}
