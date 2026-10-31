import { moveOnly } from '../../core/sheets';
import type { Id } from '../../core/model';
import { canScale } from '../../core/arrange';
import { movesVertically } from '../../core/levels';
import { canJoin, canTrim } from '../../core/trimEdit';
import { canFuse } from '../../core/joinLines';
import { cornerPartner, cornersAmong, refFrame } from '../../core/wallEdit';
import { hasLevel, hasOwnEase, hasOwnLevel, rampPoint } from './rampOps';
import { allowsArcs, canRoundCorner, edgeIsArc, editedShape, holeShape, holesOf, shapeCan, shapeEdgeAt, shapeNodes, shapeOf, subShapes, type ShapeLike } from '../../elements/shapeEdit';
import { dist } from '../../geometry/vec';
import { resolveParams } from '../../elements/registry';
import type { RoofParams } from '../../elements/roof';
import { ownCut } from '../../elements/roofBody';
import type { Vec2 } from '../../repr/primitives';
import type { ViewPointer, ViewTool } from '../../view2d/planView';
import type { OpId } from './opDefs';
import type { RailId } from './rail';
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

export * from './opDefs';
export * from './rail';

export type ModifyKind = 'edge' | 'body' | 'point' | 'corner';

export interface ModifyContext {
  kind: ModifyKind;
  /** Det markerade. */
  ids: Id[];
  /** Väggen man klickade på, för kant, ände och hörn. */
  wallId?: Id;
  /** 2D-elementet man klickade på, med punktens eller kantens nummer (0.8 del 2); också takfallens, bjälklagens och markytornas kontur. */
  shapeId?: Id;
  /** Med `shapeId` ett bjälklag: håltagningen man klickade på (0.9.4), som ändras som en 2D-form. */
  hole?: number;
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
  /** Förläng rampen från änden (0.10.18): verktyget Mark ritar vidare på den. Svarar false om det inte går. */
  startRampFrom?(ctx: ModifyContext): boolean;
}

/** Valen för ett klick, i den ordning de visas, med ett streck före de allmänna. */
export function opsFor(host: ToolHost & Partial<Pick<ModifyHost, 'startWallFrom' | 'startRampFrom'>>, ctx: ModifyContext): OpId[][] {
  const doc = host.store.doc;
  // Vyer, skalstockar och stämplar på ett blad (0.8.9, 0.8.12) går bara att flytta, också tillsammans med det som är ritat på bladet.
  if (ctx.ids.some((id) => moveOnly(doc, id))) return [['move']];
  const wall = ctx.wallId ? doc.elements[ctx.wallId] : undefined;
  const walls = ctx.ids.filter((id) => doc.elements[id]?.type === 'Wall');
  const cuts = editOps(host, ctx.ids);
  const withCuts = (groups: OpId[][]): OpId[][] => (cuts.length ? [...groups.slice(0, -1), cuts, groups[groups.length - 1]] : groups);
  if (ctx.shapeId) {
    const el = editedShape(doc, ctx.shapeId, ctx.hole);
    // Spiraltrappans linje (0.11.5) är bara mitten och början: punkterna flyttas, inget mer.
    const spiral = !!doc.elements[ctx.shapeId]?.params.spiral;
    const can = el && !spiral ? shapeCan(el) : { insert: false, remove: false, offset: false, bend: false };
    const arc = !!el && ctx.kind === 'edge' && edgeIsArc(el, ctx.index!);
    const own: OpId[] =
      ctx.kind === 'edge'
        ? [
            ...(can.insert ? (['shapeInsert'] as OpId[]) : []),
            ...(can.bend ? (['shapeBend'] as OpId[]) : []),
            ...(arc ? (['shapeStraighten'] as OpId[]) : []),
            // En båge förskjuts också (0.10.17): den behåller sin vinkel.
            ...(can.offset ? (['shapeOffset'] as OpId[]) : []),
          ]
        : ['shapeMove', ...(can.remove ? (['shapeRemove'] as OpId[]) : []), ...(el && canRoundCorner(el, ctx.index!) ? ((allowsArcs(el) ? ['shapeFillet', 'shapeChamfer'] : ['shapeChamfer']) as OpId[]) : [])];
    // Stödmurens höjdpunkter (0.10.9) på referenslinjen.
    const host0 = doc.elements[ctx.shapeId];
    if (host0?.type === 'Ground' && host0.params.kind === 'wall') own.push('crestPoint');
    // Trappans referenslinje (0.11): vilplan härifrån, och kilsteg eller vilplan i en sväng.
    if (host0?.type === 'Stair' && !spiral && ctx.kind !== 'edge' && ctx.index !== undefined) {
      const n = ((host0.params.line as unknown[]) ?? []).length;
      const flat = ((host0.params.landings as number[] | undefined) ?? []).includes(ctx.index);
      const turn = ((host0.params.turnLandings as number[] | undefined) ?? []).includes(ctx.index);
      if (ctx.index < n - 1) own.push(flat ? 'stairSteps' : 'stairLanding');
      if (ctx.index > 0 && ctx.index < n - 1) own.push(turn ? 'stairWinders' : 'stairTurnLanding');
    }
    // Räcket längs trappans kant (0.11.1).
    if (host0?.type === 'Stair' && ctx.ids.length === 1) own.push('stairRailing', 'stairRailings');
    // Grinden (0.11.3): facket där man klickade.
    if (host0?.type === 'Railing' && ctx.ids.length === 1 && ctx.kind === 'edge') own.push('railGate');
    // Rampens referenslinje (0.10.18): höjden i punkten, och förläng från en ände.
    const rp = rampPoint(doc, ctx);
    if (rp) {
      own.push('pathLevel');
      if (hasOwnLevel(doc, ctx)) own.push('pathLevelClear');
      if (rp.end && host.startRampFrom) own.push('pathExtend');
      // Övergången i en punkt med höjd (0.10.19).
      if (hasLevel(doc, ctx)) {
        own.push('pathEase', 'pathEaseSharp');
        if (hasOwnEase(doc, ctx)) own.push('pathEaseClear');
      }
    }
    // En håltagning (0.9.4) flyttas och tas bort för sig; det allmänna gäller hela bjälklaget.
    // Vrida och spegla hålet för sig (0.10.17).
    if (ctx.hole !== undefined && host0?.type === 'Slab') return [own, ['holeMove', 'holeRotate', 'holeMirror', 'holeRemove']];
    // Ett takfall (0.10) kapas mot ett annat.
    // Takfotens snitt (0.10.2) för en kant.
    if (doc.elements[ctx.shapeId]?.type === 'Roof') {
      const cuts: OpId[] = ctx.kind === 'edge' ? ['roofCutPerp', 'roofCutPlumb', 'roofCutAngle', ...(ownCut(resolveParams<RoofParams>(doc, doc.elements[ctx.shapeId]), ctx.index!) !== undefined ? (['roofCutAuto'] as OpId[]) : [])] : [];
      return cuts.length ? [own, cuts, ['roofTrim'], COMMON] : [own, ['roofTrim'], COMMON];
    }
    return withCuts(own.length ? [own, COMMON] : [COMMON]);
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
      if (ctx.ids.some((id) => doc.elements[id]?.type === 'Roof')) own.push('roofTrim');
      // Räcket längs trappans kant (0.11.1).
      if (ctx.ids.length === 1 && doc.elements[ctx.ids[0]]?.type === 'Stair') own.push('stairRailing', 'stairRailings');
      // Grinden (0.11.3) i ett räcke.
      if (ctx.ids.length === 1 && doc.elements[ctx.ids[0]]?.type === 'Railing') own.push('railGate');
      // Flytta i höjd (0.10.13) för väggar, bjälklag, möbler och tak.
      if (ctx.ids.some((id) => movesVertically(doc.elements[id]) && !doc.elements[id].locked)) own.push('moveZ');
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
  // Foga ihop (0.10.17): minst två öppna linjer.
  if (els.filter((e) => canFuse(host.store.doc, e)).length >= 2) out.push('shapeFuse');
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
  // Takfallens (0.10), bjälklagens och markytornas (0.10.24) kontur som en 2D-form.
  for (const id of ids) {
    const el = shapeOf(doc.elements[id]);
    if (!el || !shown.has(id)) continue;
    const pts = shapeNodes(el);
    for (let i = 0; i < pts.length; i++) if (dist(pts[i], p.model) <= tol) return { kind: 'point', ids, shapeId: id, index: i, at: pts[i], clientX, clientY };
  }
  for (const id of ids) {
    const el = shapeOf(doc.elements[id]);
    if (!el || !shown.has(id)) continue;
    const e = shapeEdgeAt(el, p.model, tol);
    if (e) return { kind: 'edge', ids, shapeId: id, index: e.index, at: e.at, clientX, clientY };
  }
  // Hörn och kanter i håltagningarna i markerade bjälklag (0.9.4), och rampens sidor (0.10.18).
  const holes = ids.flatMap((id) => (shown.has(id) ? subShapes(doc.elements[id]).map(({ hole, shape }) => ({ id, hole, shape })) : []));
  for (const { id, hole, shape } of holes) {
    const pts = shapeNodes(shape);
    for (let i = 0; i < pts.length; i++) if (dist(pts[i], p.model) <= tol) return { kind: 'point', ids, shapeId: id, hole, index: i, at: pts[i], clientX, clientY };
  }
  for (const { id, hole, shape } of holes) {
    const e = shapeEdgeAt(shape, p.model, tol);
    if (e) return { kind: 'edge', ids, shapeId: id, hole, index: e.index, at: e.at, clientX, clientY };
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
  for (const op of editOps(host, ids)) on.add(op === 'shapeFuse' ? 'fuse' : (op as RailId));
  for (const op of arrangeOps(host, ids)) on.add(op === 'extendAll' ? 'extend' : op === 'trimAll' ? 'trim' : (op as RailId));
  // 2D-formerna, konturerna (takfall 0.10, bjälklag och markyta 0.10.24) och håltagningarna i bjälklagen (0.9.4).
  const shapes: ShapeLike[] = els.flatMap((el) => {
    const own = shapeOf(el);
    return [...(own ? [own] : []), ...holesOf(el).map(holeShape)];
  });
  for (const el of shapes) {
    const can = shapeCan(el);
    on.add('pointMove');
    if (can.insert) on.add('insert');
    if (can.remove) on.add('remove');
    if (can.offset) on.add('offset');
    if (can.bend) on.add('curve');
    if (can.bend && ((el.params.bulges as number[] | undefined) ?? []).some((b) => Math.abs(b) >= 0.5)) on.add('straighten');
    if (shapeNodes(el).some((_, i) => canRoundCorner(el, i))) {
      if (allowsArcs(el)) on.add('fillet');
      on.add('chamfer');
    }
  }
  return on;
}
