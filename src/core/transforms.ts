import { wallFrame } from '../geometry/wallFrame';
import { geometryOf } from './commands';
import { hostedIn } from './elementIndex';
import { newId } from './ids';
import type { Element, Id, ProjectDoc } from './model';
import type { DocStore } from './store';

/**
 * Kopiera, vrida och spegla (utbrutet ur commands.ts i 0.8.27).
 */

type Pt = [number, number];

/** En avbildning av planen: vridning kring en punkt, eller spegling i en lodrät linje. */
export interface PlanTransform {
  map(p: Pt): Pt;
  /** Ny vinkel (grader) för något som pekar åt `deg`. */
  angle(deg: number): number;
  mirror: boolean;
}

function rotation(center: Pt, deg: number): PlanTransform {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return {
    map: ([x, y]) => [Math.round(center[0] + (x - center[0]) * c - (y - center[1]) * s), Math.round(center[1] + (x - center[0]) * s + (y - center[1]) * c)],
    angle: (a) => (((a + deg) % 360) + 360) % 360,
    mirror: false,
  };
}

function mirrorX(center: Pt): PlanTransform {
  return {
    map: ([x, y]) => [Math.round(2 * center[0] - x), y],
    angle: (a) => (((180 - a) % 360) + 360) % 360,
    mirror: true,
  };
}

/** Elementets nya parametrar efter avbildningen, och följdändringar i det som sitter i det. */
export function transformed(doc: ProjectDoc, el: Element, t: PlanTransform, moving: Set<Id>): Element[] {
  const out = transformedParams(doc, el, t, moving);
  // Litterans förskjutningar i planens axlar (0.10.20.1: rummets och stödmurens)
  // vrids och speglas med objektet; väggarnas står i textens egna axlar.
  const tag = (el.params as { tag?: { at?: Pt; to?: Pt } }).tag;
  if (tag && (el.type === 'Space' || el.type === 'Ground') && out[0]?.id === el.id) {
    const o = t.map([0, 0]);
    const vec = (v?: Pt): Pt | undefined => {
      if (!v) return undefined;
      const q = t.map(v);
      return [q[0] - o[0], q[1] - o[1]];
    };
    out[0] = { ...out[0], params: { ...out[0].params, tag: { ...tag, ...(tag.at ? { at: vec(tag.at) } : {}), ...(tag.to ? { to: vec(tag.to) } : {}) } } };
  }
  return out;
}

function transformedParams(doc: ProjectDoc, el: Element, t: PlanTransform, moving: Set<Id>): Element[] {
  const p = el.params as Record<string, any>;
  const out: Element[] = [];
  if (p.start && p.end) {
    let start = t.map(p.start);
    let end = t.map(p.end);
    if (t.mirror) {
      // Speglingen vänder sidorna; byt riktning så att insidan blir kvar inne.
      // Pilhöjden behåller sitt tecken: speglingen och bytet tar ut varandra.
      [start, end] = [end, start];
      const len = wallFrame(geometryOf(doc, el)).length;
      for (const h of hostedIn(doc, el.id)) {
        if (!moving.has(h.id)) continue;
        const hp = h.params as Record<string, any>;
        const patch: Record<string, unknown> = {};
        if (typeof hp.at === 'number') patch.at = Math.round(len - hp.at);
        if (hp.hinge) patch.hinge = hp.hinge === 'start' ? 'end' : 'start';
        out.push({ ...h, params: { ...h.params, ...patch } });
      }
    }
    out.unshift({ ...el, params: { ...el.params, start, end } });
    return out;
  }
  if (p.origin && typeof p.width === 'number') {
    const r = ((p.rotation ?? 0) * Math.PI) / 180;
    if (t.mirror) {
      // Det hörn som efter speglingen blir möbelns nedre vänstra.
      const far: Pt = [p.origin[0] + p.width * Math.cos(r), p.origin[1] + p.width * Math.sin(r)];
      return [{ ...el, params: { ...el.params, origin: t.map(far), rotation: (((t.angle(p.rotation ?? 0) + 180) % 360) + 360) % 360 } }];
    }
    return [{ ...el, params: { ...el.params, origin: t.map(p.origin), rotation: t.angle(p.rotation ?? 0) } }];
  }
  if (el.type === 'Stair' && Array.isArray(p.line)) {
    // Trappan (0.11): referenslinjen; speglad byter vänster och höger, och bågarna buktar åt andra hållet.
    const swap = (v: unknown) => (v === 'left' ? 'right' : v === 'right' ? 'left' : v);
    return [
      {
        ...el,
        params: {
          ...el.params,
          line: p.line.map(t.map),
          ...(t.mirror && Array.isArray(p.bulges) ? { bulges: (p.bulges as number[]).map((b) => (b ? -b : 0)) } : {}),
          ...(t.mirror && p.refSide ? { refSide: swap(p.refSide) } : {}),
          ...(t.mirror && p.walkSide ? { walkSide: swap(p.walkSide) } : {}),
        },
      },
    ];
  }
  if (Array.isArray(p.outline) && Array.isArray(p.ref)) {
    // Takfallet (0.10): konturen och referenslinjen. Speglingen byter
    // linjens riktning så att taket stiger åt samma håll; bågarnas pilhöjd
    // byter tecken, referenslinjens behåller det (bytet tar ut speglingen).
    const ref = p.ref.map(t.map);
    // Kanternas egna snitt (0.10.2) är kända på kantens hörn och följer med.
    const cuts = Array.isArray(p.edgeCuts) ? { edgeCuts: p.edgeCuts.map((c: any) => ({ ...c, a: t.map(c.a), b: t.map(c.b) })) } : {};
    return [{ ...el, params: { ...el.params, outline: p.outline.map(t.map), ref: t.mirror ? [ref[1], ref[0]] : ref, ...(t.mirror && Array.isArray(p.bulges) ? { bulges: p.bulges.map((b: number) => -b) } : {}), ...cuts } }];
  }
  if (Array.isArray(p.outline)) {
    // Bjälklagets håltagningar (0.9.1) följer med; speglade bågar buktar åt andra hållet (0.9.4).
    const holes = Array.isArray(p.holes) ? { holes: p.holes.map((h: any) => ({ ...h, points: h.points.map(t.map), ...(t.mirror && h.bulges ? { bulges: h.bulges.map((b: number) => -b) } : {}) })) } : {};
    // Speglade bågar buktar åt andra hållet: markobjektens linje (0.10.19), bjälklagets och markytans kontur (0.10.24).
    const bulges = t.mirror && Array.isArray(p.bulges) ? { bulges: (p.bulges as number[]).map((b) => (b ? -b : 0)) } : {};
    // Markobjektens linje (0.10.5) följer med; speglat faller infarten åt andra sidan.
    // Markobjekt längs en linje (0.10.5): spegling byter vänster och höger (tvärfall, referenslinjens sida); stödmurens höjdpunkter följer med (0.10.9).
    const mirrorSide = t.mirror && (p.refSide === 'left' || p.refSide === 'right') ? { refSide: p.refSide === 'left' ? 'right' : 'left' } : {};
    const mirrorOffset = t.mirror && (p.refSide ?? 'center') === 'center' && typeof p.refOffset === 'number' ? { refOffset: -p.refOffset } : {};
    const line = Array.isArray(p.line)
      ? {
          line: p.line.map(t.map),
          ...(t.mirror && typeof p.crossFall === 'number' ? { crossFall: -p.crossFall } : {}),
          ...mirrorSide,
          ...mirrorOffset,
          ...(Array.isArray(p.crest) ? { crest: p.crest.map((c: { at: [number, number]; h: number }) => ({ ...c, at: t.map(c.at) })) } : {}),
          // Rampens ritade sidor (0.10.18); speglat byter de plats, liksom sidornas kant.
          ...rampSides(p, t),
        }
      : {};
    return [{ ...el, params: { ...el.params, outline: p.outline.map(t.map), ...bulges, ...(p.seed ? { seed: t.map(p.seed) } : {}), ...(p.labelAt ? { labelAt: t.map(p.labelAt) } : {}), ...holes, ...line } }];
  }
  if (Array.isArray(p.points)) {
    const points = p.points.map((q: any) => (Array.isArray(q) ? t.map(q as Pt) : { ...q, at: t.map(q.at) }));
    // Speglade bågar buktar åt andra hållet (2D-formernas pilhöjder, 0.8.24).
    const bulges = t.mirror && Array.isArray(p.bulges) ? { bulges: (p.bulges as number[]).map((b) => (b ? -b : 0)) } : {};
    return [{ ...el, params: { ...el.params, points, angle: t.angle(p.angle ?? 0), offset: t.mirror ? -(p.offset ?? 0) : p.offset, ...bulges } }];
  }
  if (el.type === 'Label' && p.pos) {
    // Det generella littrat (0.10.20.2): texten står kvar upprätt; punkterna i objekt följer objekten.
    return [{ ...el, params: { ...el.params, pos: t.map(p.pos), targets: (p.targets ?? []).map((q: { at: Pt }) => ({ ...q, at: t.map(q.at) })) } }];
  }
  if (p.pos) {
    return [{ ...el, params: { ...el.params, pos: t.map(p.pos), angle: t.mirror ? p.angle : t.angle(p.angle ?? 0) } }];
  }
  return [];
}

function applyTransform(store: DocStore, ids: Id[], t: PlanTransform, label: string): void {
  const moving = new Set(ids);
  // Dörrar och fönster följer sina väggar.
  for (const e of Object.values(store.doc.elements)) if (e.host && moving.has(e.host)) moving.add(e.id);
  store.transact(label, (tx) => {
    for (const id of ids) {
      const el = tx.doc.elements[id];
      if (!el || el.host) continue;
      for (const e of transformed(tx.doc, el, t, moving)) tx.putElement(e);
    }
  });
}

/** Vrid det markerade 90° moturs kring en punkt. */
export function rotateElements(store: DocStore, ids: Id[], center: Pt, deg = 90): void {
  applyTransform(store, ids, rotation(center, deg), `Vrid ${deg}°`);
}

/** Spegla det markerade i en lodrät linje genom en punkt. */
export function mirrorElements(store: DocStore, ids: Id[], center: Pt): void {
  applyTransform(store, ids, mirrorX(center), 'Spegla');
}

/**
 * Kopiera element på samma plats. Dörrar och fönster följer med om deras
 * vägg kopieras. Kopiorna finns i samma tillstånd som originalen och får nya
 * id; numren tas bort så att de numreras om.
 */
export function copyElements(store: DocStore, ids: Id[]): Id[] {
  const doc = store.doc;
  const map = new Map<Id, Id>();
  const pick = new Set(ids.filter((id) => doc.elements[id] && !doc.elements[id].host));
  for (const e of Object.values(doc.elements)) if (e.host && pick.has(e.host)) pick.add(e.id);
  for (const id of pick) map.set(id, newId(doc.elements[id].type.slice(0, 2).toLowerCase()));
  store.transact(pick.size === 1 ? 'Kopiera' : `Kopiera ${pick.size} objekt`, (tx) => {
    for (const id of pick) {
      const el = doc.elements[id];
      const params = { ...el.params } as Record<string, unknown>;
      delete params.number;
      tx.putElement({ ...structuredClone(el), id: map.get(id)!, host: el.host ? map.get(el.host) : undefined, params: structuredClone(params) });
    }
  });
  return ids.map((id) => map.get(id)).filter((x): x is Id => !!x);
}

/** Rampens ritade sidor och sidornas kant efter en transformation (0.10.18): speglat byter vänster och höger plats. */
function rampSides(p: Record<string, any>, t: { map: (q: Pt) => Pt; mirror: boolean }): Record<string, unknown> {
  if (!Array.isArray(p.left) && !Array.isArray(p.right) && p.leftEdge === undefined && p.rightEdge === undefined && p.leftSlope === undefined && p.rightSlope === undefined) return {};
  const m = (q: unknown) => (Array.isArray(q) ? (q as Pt[]).map(t.map) : undefined);
  if (!t.mirror) return { left: m(p.left), right: m(p.right) };
  // Sidornas bågar (0.10.19) byter sida och buktar åt andra hållet.
  const b = (q: unknown) => (Array.isArray(q) ? (q as number[]).map((v) => -v) : undefined);
  return { left: m(p.right), right: m(p.left), leftBulges: b(p.rightBulges), rightBulges: b(p.leftBulges), leftEdge: p.rightEdge, rightEdge: p.leftEdge, leftSlope: p.rightSlope, rightSlope: p.leftSlope };
}
