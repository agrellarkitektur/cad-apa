import type { Color, FillDef, StyleSheet } from '../core/graphics';
import type { ProjectDoc, ViewDef } from '../core/model';
import type { ViewStates } from '../core/states';
import { resolveSource, type UnderlayHost } from '../core/underlaySources';
import { UNDERLAY_COLOR, UNDERLAY_OPACITY, type ViewUnderlay } from '../core/viewUnderlays';
import { buildPlan } from './plan';
import type { Pen, PenColor, Primitive, Vec2 } from './primitives';

/**
 * Underlag i vyn (0.10.35): källans primitiver, ritade med underlagets
 * utseende. De får ursprunget `ViewUnderlay` (del `under` eller `över`),
 * utan objektets id, så att de inte går att markera, inte räknas i
 * teckenförklaringen och klipps mot vyns ram på bladet som underlagen.
 */

export const VIEW_UNDERLAY = 'ViewUnderlay';

/** Om primitiven hör till ett underlag i vyn. */
export const isViewUnderlay = (p: Primitive) => p.origin?.objectType === VIEW_UNDERLAY;

/** Ett underlag i vyn som ritas över ritningen. */
export const isOverUnderlay = (p: Primitive) => isViewUnderlay(p) && p.origin?.part === 'över';

/** Underlag (fil eller i vyn): det som inte räknas i vyns ram och klipps mot den på bladet. */
export const isBackdrop = (p: Primitive) => p.origin?.objectType === 'Underlay' || isViewUnderlay(p);

export interface UnderlayBase {
  host: UnderlayHost;
  /** Vyns inställningar: tillståndet, skalan och detaljnivån gäller också underlaget. */
  states: ViewStates;
  style: StyleSheet;
  /** En annan vy som underlag, utan sina egna underlag. */
  viewPrims: (v: ViewDef) => Primitive[];
}

/** Underlagen ritade, i två högar: under och över ritningen. */
export function viewUnderlayPrims(doc: ProjectDoc, list: readonly ViewUnderlay[] | undefined, base: UnderlayBase): { under: Primitive[]; over: Primitive[] } {
  const under: Primitive[] = [];
  const over: Primitive[] = [];
  for (const u of list ?? []) {
    const raw = sourcePrims(doc, u.source, base);
    if (raw.length) (u.above ? over : under).push(...lookPrims(raw, u));
  }
  return { under, over };
}

/** Källans primitiver som de ritas i sin egen vy, eller inga. */
export function sourcePrims(doc: ProjectDoc, source: string, base: UnderlayBase): Primitive[] {
  const r = resolveSource(doc, base.host, source);
  if (!r) return [];
  const vs: ViewStates = { ...base.states, viewId: undefined, place: undefined, viewTags: [], category: undefined, legend: undefined, smart: undefined, showHidden: false };
  switch (r.kind) {
    case 'storey':
      // Som kalkeringen förut: vyns inställningar, utan fasad- och sektionsmarkörerna och norrpilen.
      return buildPlan(doc, r.storey, { ...vs, hide: [...(base.states.hide ?? []), 'Section', 'Elevation', 'North'] }, base.style).prims;
    case 'worksheet':
      return buildPlan(doc, base.host.storey, { ...vs, place: r.id }, base.style).prims;
    case 'view': {
      const v = doc.views.find((x) => x.id === r.id);
      return v ? base.viewPrims(v) : [];
    }
    case 'ortho': {
      const p = orthoPrim(doc);
      return p ? [p] : [];
    }
  }
}

/** Ortofotot i planens koordinater (mm), som en bild. */
export function orthoPrim(doc: Pick<ProjectDoc, 'site'>): Primitive | null {
  const site = doc.site;
  const o = site?.ortho;
  if (!site || !o) return null;
  const v = (site.rotation * Math.PI) / 180;
  const c = Math.cos(v);
  const s = Math.sin(v);
  // Zonen: X = ox + (c·x − s·y)/1000, Y = oy + (s·x + c·y)/1000, så planen x = 1000·(c·dX + s·dY), y = 1000·(−s·dX + c·dY).
  const plan = (X: number, Y: number): Vec2 => {
    const dx = X - site.origin[0];
    const dy = Y - site.origin[1];
    return [1000 * (c * dx + s * dy), 1000 * (-s * dx + c * dy)];
  };
  const w = o.W * o.s;
  const h = o.H * o.s;
  const bl = plan(o.x0, o.y1 - h);
  const br = plan(o.x0 + w, o.y1 - h);
  const tl = plan(o.x0, o.y1);
  return {
    kind: 'image',
    corner: bl,
    u: [br[0] - bl[0], br[1] - bl[1]],
    v: [tl[0] - bl[0], tl[1] - bl[1]],
    source: { asset: o.asset },
    opacity: 1,
  };
}

/** Gråtonen för en färg (`#rrggbb`), med samma ljushet. */
export function grayOf(hex: string): `#${string}` {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return '#808080';
  const n = parseInt(m[1], 16);
  const l = Math.round(0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255));
  const x = l.toString(16).padStart(2, '0');
  return `#${x}${x}${x}`;
}

/** Primitiverna med underlagets utseende: täckning, färg, bara konturer, och över ritningen utan vita fyllningar. */
export function lookPrims(prims: readonly Primitive[], u: ViewUnderlay): Primitive[] {
  const o = (u.opacity ?? UNDERLAY_OPACITY) / 100;
  const look = u.look ?? 'tinted';
  const tint = (u.color ?? UNDERLAY_COLOR) as Color;
  const color = (c: PenColor): PenColor => {
    if (c === 'paper') return c;
    if (look === 'color') return tint;
    if (look === 'gray') return c === 'ink' || c === 'muted' ? c : c === 'accent' ? 'muted' : grayOf(c);
    return c;
  };
  const pen = (p: Pen): Pen => ({ ...p, color: color(p.color ?? 'ink'), opacity: (p.opacity ?? 1) * o });
  const isPaper = (c: Color | null | undefined) => c === 'paper' || c === '#ffffff';
  const fill = (f: FillDef): FillDef => {
    if (f.kind === 'none') return f;
    if (u.above && f.kind === 'solid' && isPaper(f.color)) return { kind: 'none' };
    const bg = f.kind !== 'solid' && f.background && !(u.above && isPaper(f.background)) ? { background: color(f.background) as Color, backgroundOpacity: (f.backgroundOpacity ?? 1) * o } : f.kind !== 'solid' ? { background: null } : {};
    return { ...f, color: color(f.color) as Color, opacity: (f.opacity ?? 1) * o, ...bg } as FillDef;
  };
  const origin = { objectType: VIEW_UNDERLAY, part: u.above ? 'över' : 'under' };
  const out: Primitive[] = [];
  for (const p of prims) {
    // Inte klickbara (de ligger inte bland det som går att markera), men snäppningen läser dem.
    const base = { origin };
    switch (p.kind) {
      case 'line':
      case 'polyline':
      case 'arc':
      case 'text': {
        const { under: _u, ...rest } = p;
        out.push({ ...rest, ...base, pen: pen(p.pen) } as Primitive);
        break;
      }
      case 'region': {
        const { under: _u, ...rest } = p;
        if (look === 'outline') {
          const line = p.outline ?? { weight: 0.13 };
          out.push({ ...rest, ...base, fill: { kind: 'none' }, outline: pen(line), noOutline: false, ownFill: true });
        } else out.push({ ...rest, ...base, fill: fill(p.fill), outline: p.outline ? pen(p.outline) : null, ownFill: true });
        break;
      }
      case 'image': {
        const { under: _u, ...rest } = p;
        out.push({ ...rest, ...base, opacity: p.opacity * o, ...(look === 'tinted' ? {} : { gray: true }) });
        break;
      }
    }
  }
  return out;
}

/** Den del av en vy som underlagen ritas ur, för vyns egna inställningar. */
export function underlayHostOf(v: Pick<ViewDef, 'id' | 'storey' | 'marker' | 'worksheet'>): UnderlayHost {
  return { storey: v.storey, plan: !v.marker && !v.worksheet, viewId: v.id };
}
