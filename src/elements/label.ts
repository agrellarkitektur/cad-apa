import type { Element, Id, ProjectDoc } from '../core/model';
import { litteraText } from '../core/site';
import { textWidth } from '../formats/drawingFont';
import { markerPen } from '../repr/markerPens';
import type { Pen, Primitive, TagHandles, Vec2 } from '../repr/primitives';
import { anchorOf } from './anchor';
import { leaderOf, type TagParams, type TextBox } from './leader';
import { fillTemplate, litteraField } from './littera';
import type { ElementType, PlanContext } from './registry';
import { resolveParams } from './registry';
import { areaOf, formatArea } from './space';
import { roomNumbersFor } from './rooms';

/**
 * Det generella littrat (0.10.20.2): en text som ritas för sig, med fritext
 * och smarttext ur objekten som ledarna pekar på, och en eller flera ledare
 * som delar stammen. Ledarnas punkter sitter fast i objekten (`id` och
 * `local`, objektets axlar i `anchor.ts`) och följer dem; ett borttaget
 * objekt gör ledaren röd. Litteror av samma sort får löpnummer i den ordning
 * de ritats, och sorten går att släcka under Visa.
 */

export type LabelFrame = 'none' | 'underline' | 'rect' | 'circle' | 'hexagon';

export const LABEL_FRAMES: [LabelFrame, string][] = [
  ['none', 'Ingen'],
  ['underline', 'Understrykning'],
  ['rect', 'Rektangel'],
  ['circle', 'Cirkel'],
  ['hexagon', 'Sexhörning'],
];

/** En ledares punkt: fri i planen, eller fast i ett objekt (i objektets axlar). */
export interface LabelTarget {
  /** Punkten i planen när den sattes; gäller när den inte sitter i ett objekt. */
  at: [number, number];
  id?: Id;
  local?: [number, number];
}

export interface LabelParams {
  /** Textens mitt. */
  pos: [number, number];
  /** Fritext med fält inom klammer, en rad per textrad. */
  text: string;
  /** Sorten, t.ex. *Brandcell* eller *Träd*: löpnummer och Visa per sort. */
  sort?: string;
  /** Texthöjd på papperet, mm; utelämnad = stilmallens littera. */
  height?: number;
  /** Vridning i grader moturs. */
  angle?: number;
  frame?: LabelFrame;
  targets: LabelTarget[];
  /** Ledarens sida, ände, anslutning och stam, som de andra litterorna. */
  tag?: TagParams;
  /** Vinkeln mellan stammen och de sneda delarna när ledarna är flera; 0 = fria knäckar. */
  slant?: number;
  /** Olika värden hos objekten skrivs som en lista i stället för *varierar*. */
  list?: boolean;
  /** Eget löpnummer i stället för det räknade. */
  number?: string;
}

/** Visa-nyckeln för en sort. */
export const sortKey = (sort: string | undefined) => `labelsort:${(sort ?? '').trim().toLowerCase()}`;

/** Punkten för en ledare och om objektet den sitter i finns. */
export function targetPoint(doc: ProjectDoc, t: LabelTarget): { at: Vec2; lost: boolean } {
  if (!t.id) return { at: t.at, lost: false };
  const el = doc.elements[t.id];
  if (!el) return { at: t.at, lost: true };
  const a = t.local ? anchorOf(doc, el) : null;
  return { at: a ? a.fromLocal(t.local!) : t.at, lost: false };
}

/** En ledare som pekar på `at`, fast i objektet `id` om det har axlar. */
export function targetAt(doc: ProjectDoc, at: Vec2, id?: Id | null): LabelTarget {
  const p: [number, number] = [Math.round(at[0]), Math.round(at[1])];
  const el = id ? doc.elements[id] : undefined;
  const a = el ? anchorOf(doc, el) : null;
  return el && a ? { at: p, id: el.id, local: a.toLocal(at) } : { at: p };
}

/** Löpnumren per sort, i den ordning litterorna ritats; egna nummer räknas inte. */
export function labelNumbers(doc: ProjectDoc): Map<Id, number> {
  const out = new Map<Id, number>();
  const count = new Map<string, number>();
  for (const el of Object.values(doc.elements)) {
    if (el.type !== 'Label') continue;
    const p = el.params as Partial<LabelParams>;
    if (p.number?.trim()) continue;
    const k = (p.sort ?? '').trim().toLowerCase();
    const n = (count.get(k) ?? 0) + 1;
    count.set(k, n);
    out.set(el.id, n);
  }
  return out;
}

/** Litterans löpnummer som text, med projektets antal siffror. */
export function labelNumber(ctx: Pick<PlanContext, 'doc' | 'memo'>, el: Element<any>): string {
  const own = (el.params as Partial<LabelParams>).number?.trim();
  if (own) return own;
  const n = ctx.memo('label-numbers', () => labelNumbers(ctx.doc)).get(el.id);
  return n ? litteraText(ctx.doc.site, '', n) : '';
}

/** Ett fält ur ett objekt som ledaren pekar på. */
function objectField(ctx: PlanContext, el: Element<any>, name: string): string {
  const p = resolveParams<Record<string, any>>(ctx.doc, el);
  const def = el.definition ? ctx.doc.definitions[el.definition] : undefined;
  const mm = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? String(Math.round(v)) : '');
  switch (name.toLowerCase()) {
    case 'id':
      return el.name?.trim() || def?.name || '';
    case 'namn':
      return el.name?.trim() ?? '';
    case 'nummer':
      if (el.type === 'Space') return p.number ?? roomNumbersFor(ctx).get(el.id) ?? '';
      break;
    case 'area': {
      const ring = Array.isArray(p.outline) ? (p.outline as Vec2[]) : null;
      return ring && ring.length > 2 ? formatArea(areaOf(ring)) : '';
    }
    case 'bredd':
      return mm(p.width ?? p.thickness);
    case 'höjd':
    case 'hojd':
      return mm(p.height);
    case 'längd':
    case 'langd':
      return p.start && p.end ? mm(Math.hypot(p.end[0] - p.start[0], p.end[1] - p.start[1])) : '';
  }
  return litteraField(ctx, el, name);
}

/** Litterans rader med fälten ifyllda ur objekten (*varierar* eller en lista när de skiljer sig). */
export function labelLines(ctx: PlanContext, el: Element<any>): string[] {
  const p = ctx.params<LabelParams>(el);
  const objects = (p.targets ?? []).map((t) => (t.id ? ctx.doc.elements[t.id] : undefined)).filter((e): e is Element => !!e);
  const unique = [...new Map(objects.map((e) => [e.id, e])).values()];
  const value = (name: string): string => {
    const n = name.toLowerCase();
    if (n === 'löpnummer' || n === 'lopnummer' || n === 'nr') return labelNumber(ctx, el);
    if (n === 'sort') return p.sort?.trim() ?? '';
    const values = [...new Set(unique.map((e) => objectField(ctx, e, name)).filter((v) => v !== ''))];
    if (values.length < 2) return values[0] ?? '';
    return p.list ? values.sort((a, b) => a.localeCompare(b, 'sv', { numeric: true })).join(', ') : 'varierar';
  };
  return fillTemplate(String(p.text ?? ''), value).map((r) => r.text);
}

/** Röd ledare till ett objekt som tagits bort. */
const LOST_PEN: Pen = { weight: 0.25, color: '#d9480f' };

interface Layout {
  rows: { text: string; at: Vec2 }[];
  box: TextBox;
  frame: Vec2[] | null;
  underline: [Vec2, Vec2] | null;
  height: number;
  align: 'start' | 'middle';
  angle: number;
}

/** Textens rader, ruta och ram. */
function layout(ctx: PlanContext, el: Element<any>): Layout {
  const p = ctx.params<LabelParams>(el);
  const s = ctx.scale;
  const h = p.height && p.height > 0 ? p.height : ctx.style.labels.heights.littera;
  const lines = labelLines(ctx, el);
  const shown = lines.length ? lines : ['…'];
  const a = ((p.angle ?? 0) * Math.PI) / 180;
  const along: Vec2 = [Math.cos(a), Math.sin(a)];
  const up: Vec2 = [-Math.sin(a), Math.cos(a)];
  const step = 1.45 * h * s;
  const hw = (Math.max(...shown.map((t) => textWidth(t, h))) * s) / 2;
  const total = h * s + (shown.length - 1) * step;
  const hh = total / 2 + 0.25 * h * s;
  const c = p.pos;
  const at = (x: number, y: number): Vec2 => [c[0] + along[0] * x + up[0] * y, c[1] + along[1] * x + up[1] * y];
  const left = ctx.style.labels.align === 'left';
  const rows = shown.map((text, k) => ({ text, at: at(left ? -hw : 0, total / 2 - h * s - k * step + 0.1 * h * s) }));
  const pad = 1 * s;
  const frame = p.frame ?? 'none';
  let box: TextBox = { center: c, halfW: hw, halfH: hh, along, up };
  let ring: Vec2[] | null = null;
  if (frame === 'rect') {
    const x = hw + pad;
    const y = hh + pad * 0.6;
    ring = [at(-x, -y), at(x, -y), at(x, y), at(-x, y)];
    box = { ...box, halfW: x, halfH: y };
  } else if (frame === 'circle') {
    const r = Math.hypot(hw, hh) + pad * 0.5;
    ring = Array.from({ length: 48 }, (_, i) => at(r * Math.cos((i * Math.PI) / 24), r * Math.sin((i * Math.PI) / 24)));
    box = { ...box, halfW: r, halfH: r };
  } else if (frame === 'hexagon') {
    const y = hh + pad * 0.6;
    const x = hw + pad * 0.4;
    const t = y / Math.sqrt(3);
    ring = [at(-x, y), at(x, y), at(x + t, 0), at(x, -y), at(-x, -y), at(-x - t, 0)];
    box = { ...box, halfW: x + t, halfH: y };
  }
  const style = ctx.style.labels.leaders.Label;
  const under = (p.tag?.attach ?? style.attach) === 'underline' && (p.targets?.length ?? 0) > 0;
  const underline: [Vec2, Vec2] | null = frame === 'underline' && !under ? [at(-hw - 0.5 * s, -hh - 0.5 * s), at(hw + 0.5 * s, -hh - 0.5 * s)] : null;
  return { rows, box, frame: ring, underline, height: h, align: left ? 'start' : 'middle', angle: a };
}

/** Sorten är släckt under Visa, eller all littera i en äldre vy. */
function hiddenSort(ctx: PlanContext, sort: string | undefined): boolean {
  const hide = ctx.view.hide;
  return !!hide && (hide.includes('littera') || (!!sort?.trim() && hide.includes(sortKey(sort))));
}

export const labelType: ElementType<LabelParams> = {
  type: 'Label',
  label: 'Littera',
  labelPlural: 'Littera',
  drawOrder: 62,
  compares: false,
  defaults: () => ({ pos: [0, 0], text: '{typ}', targets: [] }),
  pickShape(el, ctx) {
    if (hiddenSort(ctx, ctx.params<LabelParams>(el).sort)) return [];
    const { box } = layout(ctx, el);
    const c = (x: number, y: number): Vec2 => [box.center[0] + box.along[0] * x + box.up[0] * y, box.center[1] + box.along[1] * x + box.up[1] * y];
    return [[[c(-box.halfW, -box.halfH), c(box.halfW, -box.halfH), c(box.halfW, box.halfH), c(-box.halfW, box.halfH)]]];
  },
  plan(el, ctx) {
    const p = ctx.params<LabelParams>(el);
    if (hiddenSort(ctx, p.sort)) return [];
    const s = ctx.scale;
    const lay = layout(ctx, el);
    const style = ctx.style.labels.leaders.Label;
    const tag = p.tag ?? {};
    const pen = markerPen(ctx.style, 'litteraLeader');
    const points = (p.targets ?? []).map((t) => targetPoint(ctx.doc, t));
    const many = points.length > 1;
    const slant = p.slant ?? 45;
    const geo = leaderOf(
      lay.box,
      points.map((q) => ({ at: q.at, ...(q.lost ? { pen: LOST_PEN } : {}) })),
      {
        side: tag.side,
        end: tag.end ?? style.end,
        attach: tag.attach ?? style.attach,
        stub: tag.stub ?? style.stub,
        // Flera ledare blir parallella med en gemensam vinkel (fria med 0).
        angle: many && slant > 0 ? slant : undefined,
        gap: lay.frame ? 0 : 1,
        scale: s,
        pen,
      },
    );
    const handles: TagHandles[] = points.length
      ? points.map((q, i) => ({ param: 'label', index: i, text: p.pos, target: q.at, stubStart: geo?.start ?? null, stubEnd: i === 0 ? geo?.stubEnd ?? null : null, dir: geo?.dir ?? null }))
      : [{ param: 'label', index: 0, text: p.pos, target: null, stubStart: null, stubEnd: null, dir: null }];
    const origin = (i: number) => ({ objectId: el.id, objectType: 'Label', part: i < 0 ? 'littera' : 'ledare', tag: handles[Math.max(0, i)] });
    const base = origin(-1);
    const out: Primitive[] = lay.rows.map((r) => ({ kind: 'text', at: r.at, text: r.text, height: lay.height, align: lay.align, angle: lay.angle || undefined, pen: { weight: 0.18 }, origin: base }));
    const framePen: Pen = { weight: 0.18 };
    if (lay.frame) out.push({ kind: 'polyline', points: lay.frame, closed: true, pen: framePen, origin: base });
    if (lay.underline) out.push({ kind: 'line', a: lay.underline[0], b: lay.underline[1], pen: framePen, origin: base });
    geo?.prims.forEach((q, k) => out.push({ ...q, origin: origin(geo.owner[k]) }));
    return out;
  },
};

/** Sorterna bland projektets litteror, i den ordning de först förekommer. */
export function labelSorts(doc: ProjectDoc): string[] {
  const out = new Map<string, string>();
  for (const el of Object.values(doc.elements)) {
    if (el.type !== 'Label') continue;
    const sort = String((el.params as Partial<LabelParams>).sort ?? '').trim();
    if (sort && !out.has(sort.toLowerCase())) out.set(sort.toLowerCase(), sort);
  }
  return [...out.values()];
}
