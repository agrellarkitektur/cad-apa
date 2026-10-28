import type { Element, Id, ProjectDoc } from '../../core/model';
import type { DimensionParams, DimPoint } from '../../elements/annotation';
import { refsAt } from '../../elements/features';
import { resolveParams } from '../../elements/registry';
import { holeWidth, wallFrame, type OpeningParams, type WallParams } from '../../elements/wall';
import { cross, dot } from '../../geometry/vec';
import type { Vec2 } from '../../repr/primitives';
import { pickAt } from '../../view2d/pick';
import type { WandAction, WandHit } from './wand';

/** Måttlinjens avstånd från väggens liv, mm på papperet. */
const OUT = 8;

/**
 * Mått (0.10.23): en måttkedja längs väggen man pekar på, på den sida
 * markören står (Tab: den andra sidan). Kedjan går från väggens ände till
 * ände över öppningarnas hål och de anslutande väggarnas liv, och punkterna
 * knyts till linjerna i modellen, så att kedjan följer med när något
 * flyttas. Bågväggar måttsätts inte (inga raka liv att knyta till).
 */
export const dimWall: WandAction = {
  id: 'dim-wall',
  tools: ['dimension'],
  find(ctx) {
    const { app } = ctx;
    if (app.ui.marker || app.ui.worksheet) return [];
    const doc = app.store.doc;
    const picked = pickAt(app.plan.pickables, ctx.at, ctx.tol, app.view.drawingScale);
    let el = picked ? doc.elements[picked] : undefined;
    // En öppning måttsätts med sin vägg.
    if (el && (el.type === 'Door' || el.type === 'Window') && el.host) el = doc.elements[el.host];
    if (!el || el.type !== 'Wall') return [];
    const f = wallFrame(resolveParams<WallParams>(doc, el));
    if (f.arc) return [];
    const near: 1 | -1 = f.project(ctx.at)[1] >= 0 ? 1 : -1;
    const here = sameStorey(doc, el, app.host.activeState());
    const d = OUT * app.view.drawingScale;
    const out: WandHit[] = [];
    for (const side of [near, -near as 1 | -1]) {
      const dim = wallChain(doc, el, here, side, d);
      if (!dim) continue;
      out.push({
        label: `Måttkedja ${side === near ? 'på den här sidan' : 'på andra sidan'}`,
        what: `${dim.points.length - 1} mått`,
        preview: { lines: previewLines(dim) },
        apply: () => app.dimensionTool.create(dim),
      });
    }
    return out;
  },
};

/** Väggarna, dörrarna och fönstren på väggens våning i tillståndet, som måtten knyts till. */
function sameStorey(doc: ProjectDoc, wall: Element, state: Id): Element[] {
  return Object.values(doc.elements).filter((e) => e.storey === wall.storey && !e.space && e.states.includes(state) && (e.type === 'Wall' || e.type === 'Door' || e.type === 'Window'));
}

/**
 * Måttkedjan längs väggens liv på sidan `side` (1 vänster, −1 höger sett
 * från start mot slut), med måttlinjen `d` mm utanför livet.
 */
export function wallChain(doc: ProjectDoc, wall: Element, here: readonly Element[], side: 1 | -1, d: number): DimensionParams | null {
  const f = wallFrame(resolveParams<WallParams>(doc, wall));
  if (f.arc) return null;
  const o = side * f.half;
  /** Lägen längs väggen (mm från början). */
  const at: number[] = [0, f.length];
  for (const e of here) {
    if (e.id === wall.id) continue;
    if (e.type === 'Door' || e.type === 'Window') {
      if (e.host !== wall.id) continue;
      const p = resolveParams<OpeningParams>(doc, e);
      const w = holeWidth(p) / 2;
      at.push(p.at - w, p.at + w);
      continue;
    }
    // En anslutande vägg: en ände inne i (eller mot) väggen, och inte parallell.
    const g = wallFrame(resolveParams<WallParams>(doc, e));
    if (g.arc || Math.abs(cross(f.u, g.u)) < 0.2) continue;
    const reach = f.half + 2 * g.half + 5;
    const touches = [g.at(0, 0), g.at(g.length, 0)].some((q) => {
      const [s, off] = f.project(q);
      return s >= -reach && s <= f.length + reach && Math.abs(off) <= reach;
    });
    if (!touches) continue;
    // Där den anslutande väggens två liv skär livet på den här sidan.
    for (const go of [g.half, -g.half]) {
      const a = g.at(0, go);
      const v = g.u;
      // a + v·t ligger på linjen f.at(s, o): (a + v·t − f.at(0, o))·n = o − o = 0.
      const p0 = f.at(0, o);
      const den = dot(v, f.n);
      if (Math.abs(den) < 1e-9) continue;
      const t = dot([p0[0] - a[0], p0[1] - a[1]], f.n) / den;
      const q: Vec2 = [a[0] + v[0] * t, a[1] + v[1] * t];
      const s = dot([q[0] - p0[0], q[1] - p0[1]], f.u);
      if (s >= -2 * g.half - 5 && s <= f.length + 2 * g.half + 5) at.push(s);
    }
  }
  at.sort((a, b) => a - b);
  const list = at.filter((s, i) => i === 0 || s - at[i - 1] >= 1);
  // Livet slutar där det går in i en anslutande vägg (insidan i ett hörn): bort med mått inne i den.
  const others = here.filter((e) => e.type === 'Wall' && e.id !== wall.id).map((e) => wallFrame(resolveParams<WallParams>(doc, e)));
  const inside = (s0: number, s1: number): boolean => {
    const q = f.at((s0 + s1) / 2, o);
    return others.some((g) => {
      if (g.arc) return false;
      const [s, off] = g.project(q);
      return s > 1 && s < g.length - 1 && Math.abs(off) < g.half - 1;
    });
  };
  while (list.length > 2 && inside(list[list.length - 2], list[list.length - 1])) list.pop();
  while (list.length > 2 && inside(list[0], list[1])) list.shift();
  if (list.length < 2) return null;
  const points: DimPoint[] = list.map((s) => {
    const q = f.at(s, o);
    const r: [number, number] = [Math.round(q[0]), Math.round(q[1])];
    const refs = refsAt(doc, [...here], q, 1);
    return refs.length ? { at: r, refs } : r;
  });
  const angle = (Math.atan2(f.u[1], f.u[0]) * 180) / Math.PI;
  // Måttlinjen åt sidans håll; måttets normal är vänster om riktningen, som väggens.
  return { points, angle: Math.round(angle * 100) / 100, offset: Math.round(side * d) };
}

/** Måttlinjen och hjälplinjerna, för förhandsvisningen. */
function previewLines(d: DimensionParams): { points: Vec2[]; closed: boolean }[] {
  const r = (d.angle * Math.PI) / 180;
  const u: Vec2 = [Math.cos(r), Math.sin(r)];
  const n: Vec2 = [-u[1], u[0]];
  const pts = d.points.map((q) => (Array.isArray(q) ? q : q.at));
  const a = pts[0];
  const line = (q: Vec2): Vec2 => {
    const s = dot([q[0] - a[0], q[1] - a[1]], u);
    return [a[0] + u[0] * s + n[0] * d.offset, a[1] + u[1] * s + n[1] * d.offset];
  };
  return [{ points: [line(pts[0]), line(pts[pts.length - 1])], closed: false }, ...pts.map((q) => ({ points: [q, line(q)], closed: false }))];
}
