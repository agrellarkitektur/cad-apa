import type { StyleSheet } from '../core/graphics';
import type { Id, ProjectDoc } from '../core/model';
import type { Action, ViewStates } from '../core/states';
import { markerFrame, markerName } from '../elements/markers';
import { typeOf, type PlanItem } from '../elements/registry';
import { difference, union, type Rings } from '../geometry/boolean';
import { clipDepth, clipPlane, clipSegAxis, clipSegDepth, featureEdges, visibleSegments, type Seg, type V3 } from '../geometry/hiddenLine';
import { roofPlanes, type RoofParams } from '../elements/roof';
import { slopeSymbol, type RoofSlopeParams } from '../elements/roofSlope';
import type { PlanContext } from '../elements/registry';
import { createContext } from './context';
import { markerPen, withWeight } from './markerPens';
import { solidTriangles } from './mesh';
import { applyStyle, type Pickable } from './plan';
import type { Pen, Primitive, Vec2 } from './primitives';
import { zOn, type EdgePart, type Shape3D, type Solid } from './solids';

/**
 * Fasader och sektioner (0.7). Vyn räknas fram ur samma 3D-former som
 * 3D-vyn: det som syns bortom linjen ritas med dolda linjer borttagna, och i
 * en sektion fylls det som skärs av linjen enligt stilmallen. Resultatet är
 * vanliga ritningsprimitiver i vyns koordinater (x åt höger, y = höjd), så
 * att vyn ritas, markeras och senare läggs på blad som planen.
 */
export interface SectionResult {
  name: string;
  prims: Primitive[];
  pickables: Pickable[];
  /** Hur lång tid uträkningen tog, ms. */
  ms: number;
  /**
   * Automatiska taklutningar (0.8), med id `slope:<tak>:<takfall>`. Markeras
   * en blir den ett eget objekt med de här värdena (`RoofSlope`).
   */
  slopes: Record<string, RoofSlopeParams>;
  /** Snittytorna (0.8), i linjens koordinater (x längs linjen, y höjd), för att fylla snittet i 3D. */
  cutFaces: { material: string; rings: Rings }[];
}

/** Id för en automatisk taklutning, innan den blivit ett eget objekt. */
export function autoSlopeId(roof: Id, face: number): string {
  return `slope:${roof}:${face}`;
}

interface EdgeKey {
  id: string;
  action: Action;
  part?: EdgePart;
  dash?: readonly number[];
}

/**
 * Linjetjocklekar i fasader och sektioner (mm på papper), efter vad linjen
 * är. Hålens omfattning tjockast, karm och båge tunnare, foder och handtag
 * tunna, sammanfogningar och glasmarkering tunnast och grå. Ställs in i
 * penntabellen i 0.8; tills dess gäller de här.
 */
const PART_PEN: Record<EdgePart, Pen> = {
  hole: { weight: 0.35 },
  wall: { weight: 0.25 },
  roof: { weight: 0.25 },
  frame: { weight: 0.25 },
  sash: { weight: 0.25 },
  leaf: { weight: 0.25 },
  sill: { weight: 0.25 },
  lining: { weight: 0.18 },
  handle: { weight: 0.18 },
  joint: { weight: 0.13, color: 'muted' },
  glass: { weight: 0.13, color: 'muted' },
  swing: { weight: 0.13, dash: [3, 1.5] },
};

/** Material som fylls i snitt som väggar; resten ritas med kontur. */
const POCHE = new Set(['wall', 'wall-new', 'roof', 'floor']);

export function buildSection(doc: ProjectDoc, markerId: Id, view: ViewStates, style: StyleSheet = doc.graphics): SectionResult | null {
  const t0 = performance.now();
  const marker = doc.elements[markerId];
  if (!marker || (marker.type !== 'Section' && marker.type !== 'Elevation')) return null;
  const fr = markerFrame(doc, marker);
  const isSection = marker.type === 'Section';
  const storey = doc.storeys.find((s) => s.id === marker.storey);
  const z0 = storey?.elevation ?? 0;
  const O = fr.start;
  const r = fr.right;
  const v = fr.view;
  const toView = (x: number, y: number, z: number): V3 => [(x - O[0]) * r[0] + (y - O[1]) * r[1], z + z0, (x - O[0]) * v[0] + (y - O[1]) * v[1]];
  const depthMax = fr.depth;
  // Sektionen ritas bara så långt som linjen går.
  const uMax = Math.hypot(fr.end[0] - fr.start[0], fr.end[1] - fr.start[1]);

  // Formerna, med åtgärd. Det som rivs byggs för sig, så att det inte
  // påverkar skarvarna i det som står kvar.
  // Modellen på våningen; 2D-elementen i fasaden eller sektionen ritas för sig (se buildPlan med `place`).
  const { ctx, visible } = createContext(doc, marker.storey, { ...view, place: undefined, viewId: undefined }, style, (t) => !!(t.model3d || t.model3dBatch));
  const groups = new Map<string, PlanItem[]>();
  for (const item of visible) {
    const key = `${item.el.type}|${item.action === 'demolished' ? 'd' : 'k'}`;
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  const shapes: { s: Shape3D; demolished: boolean }[] = [];
  for (const [key, items] of groups) {
    const t = typeOf(items[0].el.type)!;
    const made = t.model3dBatch ? t.model3dBatch(items, ctx) : items.flatMap(({ el }) => t.model3d!(el, ctx));
    for (const s of made) shapes.push({ s, demolished: key.endsWith('|d') });
  }
  const actionOfId = (id: string): Action => {
    const el = doc.elements[id];
    return el ? ctx.actionOf(el) : 'plain';
  };

  const occluders: number[][] = [];
  const segs: Seg<EdgeKey>[] = [];
  const pushSeg = (a: V3, b: V3, key: EdgeKey) => {
    const c = clipSegDepth(a, b, 0, depthMax);
    const u = c && clipSegAxis(c[0], c[1], 0, 0, uMax);
    if (u) segs.push({ a: u[0], b: u[1], key });
  };
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const { s, demolished } of shapes) {
    const key: EdgeKey = { id: s.id, action: actionOfId(s.id), ...(s.kind === 'edges' ? { part: s.part, dash: s.dash } : {}) };
    if (s.kind === 'edges') {
      for (const q of s.segments) pushSeg(toView(q[0], q[1], q[2]), toView(q[3], q[4], q[5]), key);
      continue;
    }
    const plan = solidTriangles(s);
    const tris: number[] = [];
    for (let i = 0; i + 8 < plan.length; i += 9) {
      const a = toView(plan[i], plan[i + 1], plan[i + 2]);
      const b = toView(plan[i + 3], plan[i + 4], plan[i + 5]);
      const c = toView(plan[i + 6], plan[i + 7], plan[i + 8]);
      tris.push(...a, ...b, ...c);
      minZ = Math.min(minZ, a[1], b[1], c[1]);
      maxZ = Math.max(maxZ, a[1], b[1], c[1]);
    }
    // Kanter: skarpa veck och öppna kanter, och konturer av böjda ytor.
    for (const [a, b] of featureEdges(tris, { onlySilhouettes: !!s.noEdges })) pushSeg(a, b, key);
    // Det som rivs skymmer inget: det finns inte kvar.
    if (demolished) continue;
    const clipped: number[] = [];
    for (let i = 0; i + 8 < tris.length; i += 9) {
      const poly = clipPlane(
        clipPlane(
          clipDepth(
            [
              [tris[i], tris[i + 1], tris[i + 2]],
              [tris[i + 3], tris[i + 4], tris[i + 5]],
              [tris[i + 6], tris[i + 7], tris[i + 8]],
            ],
            0,
            depthMax,
          ),
          (p) => p[0],
        ),
        (p) => uMax - p[0],
      );
      for (let k = 1; k + 1 < poly.length; k++) clipped.push(...poly[0], ...poly[k], ...poly[k + 1]);
    }
    occluders.push(clipped);
  }

  // Konturer av böjda väggar: där väggmassans kontur i plan vänder sig bort
  // från betraktaren utan att vika (en båge, eller en båge som övergår i en
  // vägg längs blickriktningen) blir det en lodrät konturlinje.
  for (const seg of wallSilhouettes(shapes, v)) pushSeg(toView(seg.x, seg.y, seg.z0), toView(seg.x, seg.y, seg.z1), { id: seg.id, action: actionOfId(seg.id) });

  const visibleLines = visibleSegments(segs, occluders);

  // Snittytor där linjen skär formerna.
  const cuts = new Map<string, { action: Action; poche: boolean; ids: Set<string>; rings: Rings[] }>();
  const cutFaces: { material: string; rings: Rings }[] = [];
  // Varje objekts egen snittyta, för markering. Snitten ritas sammanslagna
  // (väggar och tak i ett), men den sammanslagna ytan får inte göra att ett
  // klick på en vägg markerar taket och alla väggar som möter det (0.8.2).
  const ownCuts = new Map<string, Rings[]>();
  if (isSection) {
    for (const { s, demolished } of shapes) {
      if (s.kind === 'edges' || demolished) continue;
      const polys = cutSolid(s, O, r, v, z0, uMax);
      if (!polys.length) continue;
      for (const rings of polys) cutFaces.push({ material: s.material, rings });
      const mine = ownCuts.get(s.id) ?? [];
      mine.push(...polys);
      ownCuts.set(s.id, mine);
      const action = actionOfId(s.id);
      const poche = POCHE.has(s.material);
      const k = `${action}|${poche ? 'p' : 'o'}|${poche ? '' : s.id}`;
      let g = cuts.get(k);
      if (!g) cuts.set(k, (g = { action, poche, ids: new Set(), rings: [] }));
      g.ids.add(s.id);
      g.rings.push(...polys);
    }
  }

  const prims: Primitive[] = [];
  const byId = new Map<string, Primitive[]>();
  const own = (id: string, p: Primitive) => {
    const list = byId.get(id) ?? [];
    list.push(p);
    byId.set(id, list);
  };
  let minU = Infinity;
  let maxU = -Infinity;
  const slopes: Record<string, RoofSlopeParams> = {};
  for (const l of visibleLines) {
    const pen: Pen = l.key.part ? { ...PART_PEN[l.key.part], ...(style.pens?.[l.key.part] as Pen | undefined), ...(l.key.dash ? { dash: l.key.dash } : {}) } : { weight: 0.18 };
    const raw: Primitive = { kind: 'line', a: l.a, b: l.b, pen, origin: { objectId: l.key.id, objectType: doc.elements[l.key.id]?.type, part: l.key.part ?? 'vy' } };
    const p = applyStyle(raw, style.actions[ctx.styleKeyOf(l.key.action)], l.key.action, style);
    prims.push(p);
    own(l.key.id, p);
    minU = Math.min(minU, l.a[0], l.b[0]);
    maxU = Math.max(maxU, l.a[0], l.b[0]);
  }
  for (const g of cuts.values()) {
    const merged = g.poche ? union(g.rings) : g.rings;
    const first = [...g.ids][0];
    for (const rings of merged) {
      const raw: Primitive = g.poche
        ? { kind: 'region', role: 'cut', rings, fill: { kind: 'solid', color: 'ink' }, outline: { weight: 0.35 }, origin: { objectId: first, part: 'snitt' } }
        : { kind: 'region', role: 'cut', rings, fill: { kind: 'none' }, outline: { weight: 0.25 }, ownFill: true, origin: { objectId: first, part: 'snitt' } };
      const p = applyStyle(raw, style.actions[ctx.styleKeyOf(g.action)], g.action, style);
      prims.push(p);
      for (const ring of rings) for (const q of ring) {
        minU = Math.min(minU, q[0]);
        maxU = Math.max(maxU, q[0]);
      }
    }
  }

  if (Number.isFinite(minU) && Number.isFinite(minZ)) {
    // Marklinje under byggnaden, och nivåer för golv och högsta punkt.
    const ground = Math.min(minZ, z0);
    prims.push({ kind: 'line', a: [minU - 1500, ground], b: [maxU + 1500, ground], pen: { weight: 0.7 }, origin: { part: 'mark' } });
    // Taklutningen, där takfallet syns i sin rätta vinkel. Takfall som har
    // en taklutning som eget objekt i den här vyn hoppas över; objektet ritar sig själv.
    if (!view.hide?.includes('roofSlope')) {
      const taken = new Set(
        Object.values(doc.elements)
          .filter((e) => e.type === 'RoofSlope' && e.space === markerId)
          .map((e) => autoSlopeId((e.params as unknown as RoofSlopeParams).roof, (e.params as unknown as RoofSlopeParams).face)),
      );
      for (const pl of roofSlopes(ctx, toView)) {
        const id = autoSlopeId(pl.roof, pl.face);
        if (taken.has(id)) continue;
        slopes[id] = pl;
        const sty = view.detail === 'sketch' ? 'text' : 'arc';
        const slope = ctx.params<RoofParams>(doc.elements[pl.roof]).slope;
        for (const p of slopeSymbol(pl.at, pl.toward, slope, pl.len, sty, style.labels.heights.dimension, { objectId: id, objectType: 'RoofSlope', part: 'taklutning' }, ctx.scale, markerPen(style, 'roofSlope'))) {
          prims.push(p);
          own(id, p);
        }
      }
    }
    // Nivåkoter: golv, takfot och nock (0.8). Takfoten är takets undersida vid kanten.
    const levels = new Map<number, string>([[z0, '']]);
    for (const el of ctx.visible('Roof')) {
      if (ctx.actionOf(el) === 'demolished') continue;
      const eave = Math.round(z0 + ctx.params<RoofParams>(el).eave);
      if (eave > z0 && !levels.has(eave)) levels.set(eave, 'takfot');
    }
    const top = Math.round(maxZ);
    if (!levels.has(top)) levels.set(top, ctx.visible('Roof').length ? 'nock' : '');
    for (const [z, label] of levels) prims.push(...levelMark(maxU + 12 * ctx.scale, z, style.labels.heights.dimension, label, ctx.scale, markerPen(style, 'level')));
  }

  const pickables: Pickable[] = [...new Set([...byId.keys(), ...ownCuts.keys()])].map((id) => {
    const list = byId.get(id) ?? [];
    return {
      id,
      priority: typeOf(doc.elements[id]?.type ?? '')?.drawOrder ?? 0,
      regions: [...list.flatMap((p) => (p.kind === 'region' ? [p.rings as Vec2[][]] : [])), ...((ownCuts.get(id) ?? []) as Vec2[][][])],
      prims: list.filter((p) => p.kind !== 'region'),
    };
  });
  return { name: markerName(doc, marker), prims, pickables, ms: performance.now() - t0, slopes, cutFaces };
}

/**
 * Var taklutningen sätts ut i en fasad eller sektion. Bara takfall som syns
 * i sin rätta lutning får den (man ser dem från gaveln), med symbolen en bit
 * upp på takfallets kant närmast betraktaren.
 */
function roofSlopes(ctx: PlanContext, toView: (x: number, y: number, z: number) => V3): RoofSlopeParams[] {
  const out: RoofSlopeParams[] = [];
  for (const el of ctx.visible('Roof')) {
    if (ctx.actionOf(el) === 'demolished') continue;
    const p = ctx.params<RoofParams>(el);
    roofPlanes(p).forEach((rp, face) => {
      const pts = rp.rings[0].map((q) => toView(q[0], q[1], zOn(rp.top, q[0], q[1])));
      if (pts.length < 3) return;
      // Takfallets kant närmast betraktaren, från takfot till nock.
      const dmin = Math.min(...pts.map((q) => q[2]));
      const near = pts.filter((q) => q[2] < dmin + 1);
      if (near.length < 2) return;
      const low = near.reduce((a, q) => (q[1] < a[1] ? q : a));
      const high = near.reduce((a, q) => (q[1] > a[1] ? q : a));
      const du = high[0] - low[0];
      const dz = high[1] - low[1];
      if (Math.abs(du) < 100 || dz < 10) return;
      const apparent = (Math.atan2(dz, Math.abs(du)) * 180) / Math.PI;
      if (Math.abs(apparent - p.slope) > 0.5) return;
      const t = 0.55;
      out.push({
        roof: el.id,
        face,
        at: [Math.round(low[0] + du * t), Math.round(low[1] + dz * t)],
        toward: low[0] > high[0] ? 1 : -1,
        len: Math.round(Math.max(600, Math.abs(du) * 0.35)),
        style: 'auto',
      });
    });
  }
  return out;
}

/** Lodräta konturlinjer för väggmassan sedd i riktningen v. */
function wallSilhouettes(shapes: { s: Shape3D; demolished: boolean }[], v: Vec2): { id: string; x: number; y: number; z0: number; z1: number }[] {
  const walls = shapes.filter((x): x is { s: Solid; demolished: boolean } => x.s.kind !== 'edges' && !x.demolished && (x.s.material === 'wall' || x.s.material === 'wall-new'));
  if (!walls.length) return [];
  const out: { id: string; x: number; y: number; z0: number; z1: number }[] = [];
  const bend = Math.sin((9 * Math.PI) / 180);
  for (const poly of union(walls.map((w) => w.s.rings as Rings))) {
    for (const ring of poly) {
      const n = ring.length;
      for (let i = 0; i < n; i++) {
        const a = ring[(i - 1 + n) % n];
        const q = ring[i];
        const b = ring[(i + 1) % n];
        const d1: Vec2 = [q[0] - a[0], q[1] - a[1]];
        const d2: Vec2 = [b[0] - q[0], b[1] - q[1]];
        const l1 = Math.hypot(d1[0], d1[1]);
        const l2 = Math.hypot(d2[0], d2[1]);
        if (l1 < 1e-6 || l2 < 1e-6) continue;
        // Riktiga hörn har egna kantlinjer.
        if (Math.abs(d1[0] * d2[1] - d1[1] * d2[0]) > bend * l1 * l2) continue;
        const c1 = (d1[0] * v[1] - d1[1] * v[0]) / l1;
        const c2 = (d2[0] * v[1] - d2[1] * v[0]) / l2;
        const zero = 1e-3;
        if (!(c1 * c2 < 0 || Math.abs(c1) < zero || Math.abs(c2) < zero)) continue;
        // Höjden från den vägg vars kontur punkten ligger på.
        let best: { id: string; z0: number; z1: number } | null = null;
        for (const w of walls) {
          if (!w.s.rings.some((r) => r.some((p) => Math.abs(p[0] - q[0]) < 0.6 && Math.abs(p[1] - q[1]) < 0.6))) continue;
          const z1 = w.s.top ? zOn(w.s.top, q[0], q[1]) : w.s.z1;
          const z0 = w.s.bottom ? zOn(w.s.bottom, q[0], q[1]) : w.s.z0;
          if (!best || z1 > best.z1) best = { id: w.s.id, z0, z1 };
        }
        if (best) out.push({ id: best.id, x: q[0], y: q[1], z0: best.z0, z1: best.z1 });
      }
    }
  }
  return out;
}

/** En nivåkota: ett streck, en triangel som pekar ned på det och höjden i meter. */
function levelMark(x: number, z: number, height: number, label: string, s: number, pen: Pen): Primitive[] {
  // s: ritningsskalan, för storleken på papper.
  const tri = 1.8 * s;
  const origin = { part: 'nivå' };
  const m = z / 1000;
  const text = `${m === 0 ? '±' : m > 0 ? '+' : '−'}${Math.abs(m).toLocaleString('sv-SE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`;
  return [
    { kind: 'line', a: [x - 6 * s, z], b: [x + 10 * s, z], pen, origin },
    {
      kind: 'region',
      role: 'cut',
      rings: [
        [
          [x, z],
          [x - tri * 0.6, z + tri],
          [x + tri * 0.6, z + tri],
        ],
      ],
      fill: { kind: 'none' },
      outline: pen,
      ownFill: true,
      origin,
    },
    { kind: 'text', at: [x + tri, z + tri * 0.35], text: label ? `${text} ${label}` : text, height, pen: withWeight(pen, 0.18), origin },
  ];
}

/**
 * Formens snitt med det lodräta planet genom linjen, i vyns koordinater
 * (x längs linjen, y = höjd). Formen är en lodrät extrudering, så snittet
 * är för varje bit av linjen inne i formen en fyrhörning mellan under- och
 * ovansidan, minus de urtag (öppningar) som linjen går igenom.
 */
export function cutSolid(s: Solid, O: Vec2, r: Vec2, v: Vec2, z0 = 0, uMax = Infinity): Rings[] {
  const inside = intervalsOnLine(s.rings, O, r, v)
    .map(([a, b]): [number, number] => [Math.max(0, a), Math.min(uMax, b)])
    .filter(([a, b]) => b > a);
  if (!inside.length) return [];
  const at = (u: number): Vec2 => [O[0] + r[0] * u, O[1] + r[1] * u];
  const zb = (u: number) => (s.bottom ? zOn(s.bottom, ...at(u)) : s.z0) + z0;
  const zt = (u: number) => (s.top ? zOn(s.top, ...at(u)) : s.z1) + z0;
  const out: Rings[] = [];
  for (const [u0, u1] of inside) {
    if (u1 - u0 < 0.5) continue;
    const quad: Rings = [
      [
        [u0, zb(u0)],
        [u1, zb(u1)],
        [u1, zt(u1)],
        [u0, zt(u0)],
      ],
    ];
    const holes: Rings[] = [];
    for (const c of s.cuts ?? []) {
      for (const [c0, c1] of intervalsOnLine(c.rings, O, r, v)) {
        const a = Math.max(c0, u0);
        const b = Math.min(c1, u1);
        if (b - a < 0.5) continue;
        holes.push([
          [
            [a, c.z0 + z0],
            [b, c.z0 + z0],
            [b, c.z1 + z0],
            [a, c.z1 + z0],
          ],
        ]);
      }
    }
    out.push(...(holes.length ? difference(quad, holes) : [quad]));
  }
  return out;
}

/** Var linjen O + r·u går inne i formen (jämn–udda), som intervall i u. */
function intervalsOnLine(rings: readonly (readonly Vec2[])[], O: Vec2, r: Vec2, v: Vec2): [number, number][] {
  const us: number[] = [];
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i];
      const q = ring[(i + 1) % ring.length];
      const dp = (p[0] - O[0]) * v[0] + (p[1] - O[1]) * v[1];
      const dq = (q[0] - O[0]) * v[0] + (q[1] - O[1]) * v[1];
      if (dp > 0 === dq > 0) continue;
      const t = dp / (dp - dq);
      const up = (p[0] - O[0]) * r[0] + (p[1] - O[1]) * r[1];
      const uq = (q[0] - O[0]) * r[0] + (q[1] - O[1]) * r[1];
      us.push(up + (uq - up) * t);
    }
  }
  us.sort((a, b) => a - b);
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < us.length; i += 2) out.push([us[i], us[i + 1]]);
  return out;
}
