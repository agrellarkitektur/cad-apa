import { evenDash, type FillFamily, type HatchLine } from '../core/fillTypes';
import type { FillDef } from '../core/graphics';
import type { Asset, Id, ProjectDoc } from '../core/model';
import { parseDxf, type DxfDrawing } from '../formats/dxf';
import { DXF_CAP_HEIGHT } from '../formats/dxfText';
import type { Primitive, Vec2 } from '../repr/primitives';
import type { ElementType } from './registry';

/**
 * Underlag (0.8 del 2): en PDF-sida, en bild eller en DXF-ritning som man
 * ritar över. Filen ligger i projektets `assets`; elementet säger var den
 * ligger, i vilken skala och hur tonad. Ett underlag ritas på en yta som
 * andra 2D-element (våningens plan, ett arbetsblad, en fasad eller en
 * sektion) och kan visas i utvalda vyer.
 *
 * Koordinaterna i filen (bildpunkter, PDF-punkter eller DXF:ens enheter)
 * räknas om till mm med `scale`, vrids `angle` grader moturs och läggs med
 * nedre vänstra hörnet i `pos`.
 */
export interface UnderlayParams {
  asset: Id;
  kind: 'image' | 'pdf' | 'dxf';
  /** PDF: sidan, från 1. */
  page?: number;
  /** Nedre vänstra hörnet i modellen, mm. */
  pos: [number, number];
  /** Vridning i grader, moturs. */
  angle: number;
  /** Millimeter i modellen per enhet i filen. */
  scale: number;
  /** Bredd och höjd i filens enheter. */
  size: [number, number];
  /** DXF: punkten i filen som hamnar i `pos` (ritningens nedre vänstra hörn). */
  ref?: [number, number];
  /** Hur mycket som syns, 0–100 %. */
  opacity: number;
  /** I gråskala (bilder och PDF). */
  gray?: boolean;
  /** DXF: lager som är släckta. */
  layersOff?: string[];
}

export const UNDERLAY_KIND_LABEL: Record<UnderlayParams['kind'], string> = { image: 'Bild', pdf: 'PDF', dxf: 'DXF' };

/** Avbildningen från filens koordinater till modellen. */
export function underlayTransform(p: Pick<UnderlayParams, 'pos' | 'angle' | 'scale' | 'ref'>): (q: readonly [number, number]) => Vec2 {
  const r = (p.angle * Math.PI) / 180;
  const c = Math.cos(r) * p.scale;
  const s = Math.sin(r) * p.scale;
  const o = p.ref ?? [0, 0];
  return (q) => {
    const x = q[0] - o[0];
    const y = q[1] - o[1];
    return [p.pos[0] + c * x - s * y, p.pos[1] + s * x + c * y];
  };
}

/** Tillbaka från modellen till filens koordinater. */
export function underlayInverse(p: Pick<UnderlayParams, 'pos' | 'angle' | 'scale' | 'ref'>): (q: Vec2) => [number, number] {
  const r = (p.angle * Math.PI) / 180;
  const c = Math.cos(r) / p.scale;
  const s = Math.sin(r) / p.scale;
  const o = p.ref ?? [0, 0];
  return (q) => {
    const x = q[0] - p.pos[0];
    const y = q[1] - p.pos[1];
    return [o[0] + c * x + s * y, o[1] - s * x + c * y];
  };
}

/** Underlagets hörn i modellen: nedre vänstra, nedre högra, övre högra, övre vänstra. */
export function underlayCorners(p: UnderlayParams): Vec2[] {
  const t = underlayTransform(p);
  const o = p.ref ?? [0, 0];
  const [w, h] = p.size;
  return [t([o[0], o[1]]), t([o[0] + w, o[1]]), t([o[0] + w, o[1] + h]), t([o[0], o[1] + h])];
}

/** Filens innehåll som text (DXF), UTF-8 eller annars Windows-1252 som äldre DXF. */
export function assetText(a: Pick<Asset, 'data'>): string {
  const bin = atob(a.data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

/** Lästa DXF-filer, så att de bara läses en gång. */
const dxfCache = new Map<Id, { data: string; drawing: DxfDrawing }>();

/** DXF-ritningen i en fil, läst en gång. */
export function dxfOf(doc: ProjectDoc, asset: Id): DxfDrawing | null {
  const a = doc.assets[asset];
  if (!a) return null;
  const hit = dxfCache.get(asset);
  if (hit && hit.data === a.data) return hit.drawing;
  try {
    const drawing = parseDxf(assetText(a));
    dxfCache.set(asset, { data: a.data, drawing });
    return drawing;
  } catch {
    return null;
  }
}

/** De senast ritade DXF-underlagen, så att samma ritning inte räknas om vid varje ändring. */
const primCache = new Map<string, Primitive[]>();

/**
 * DXF-skrafferingens linjefamiljer på papper (0.8.36): baspunkten genom
 * underlagets läge, vridning och skala, och måtten genom ritningens skala,
 * så att också streckade mönster (tegel) ritas som i filen.
 */
function underlayLines(fams: readonly FillFamily[], t: (q: Vec2) => Vec2, p: UnderlayParams, drawingScale: number): HatchLine[] {
  const k = p.scale / drawingScale;
  return fams.map((f) => {
    const a = ((f.angle + p.angle) * Math.PI) / 180;
    const b = t([f.x, f.y]);
    const dash = evenDash(f.dash);
    return {
      angle: f.angle + p.angle,
      spacing: f.spacing * k,
      ...(f.shift ? { shift: f.shift * k } : {}),
      ...(dash ? { dash: dash.map((d) => d * k) } : {}),
      phase: [(b[0] * Math.cos(a) + b[1] * Math.sin(a)) / drawingScale, (-b[0] * Math.sin(a) + b[1] * Math.cos(a)) / drawingScale],
    };
  });
}

function dxfPrims(doc: ProjectDoc, id: Id, p: UnderlayParams, drawingScale: number): Primitive[] {
  const d = dxfOf(doc, p.asset);
  if (!d) return [];
  const key = JSON.stringify([id, doc.assets[p.asset]?.data.length, p.pos, p.angle, p.scale, p.ref, p.opacity, p.layersOff ?? [], drawingScale]);
  const hit = primCache.get(key);
  if (hit) return hit;
  const t = underlayTransform(p);
  const off = new Set(p.layersOff ?? []);
  const opacity = Math.max(0.05, Math.min(1, p.opacity / 100));
  const pen = { weight: 0.13, opacity };
  const origin = { objectId: id, objectType: 'Underlay', part: 'underlag' };
  const out: Primitive[] = [];
  for (const it of d.items) {
    if (off.has(it.layer)) continue;
    if (it.kind === 'poly') out.push({ kind: 'polyline', points: it.pts.map(t), closed: it.closed, pen, origin });
    else if (it.kind === 'fill') {
      // Skraffering (0.8.3): solid fyllning som en ton, mönster som en yta per
      // linjefamilj. Avståndet räknas om till papper, som skrafferingar ritas.
      const rings = it.rings.map((r) => r.map(t));
      const fills: FillDef[] = it.solid
        ? [{ kind: 'solid', color: 'ink', opacity: opacity * 0.35 }]
        : [{ kind: 'pattern', color: 'ink', weight: 0.1, opacity, lines: underlayLines(it.lines, t, p, drawingScale) }];
      for (const fill of fills) out.push({ kind: 'region', role: 'cut', rings, fill, outline: null, ownFill: true, noOutline: true, origin });
    } else
      out.push({
        kind: 'text',
        at: t(it.at),
        text: it.text,
        // DXF mäter versalhöjden, appen teckenstorleken (versalerna är
        // ungefär 0,72 av den i Arial och Helvetica). På papper i mm genom
        // ritningsskalan.
        height: (it.height / DXF_CAP_HEIGHT) * (p.scale / drawingScale),
        angle: ((it.angle + p.angle) * Math.PI) / 180,
        align: it.align,
        pen,
        origin,
      });
  }
  if (primCache.size > 40) primCache.delete(primCache.keys().next().value!);
  primCache.set(key, out);
  return out;
}

/** Det man snäpper mot i ett underlag (0.8.16): sträckor, och punkter som sträckor med `point`. */
export interface UnderlaySnap {
  id: Id;
  a: Vec2;
  b: Vec2;
  curve?: boolean;
  point?: 'endpoint' | 'midpoint' | 'center' | 'quadrant';
  on?: string;
}

const snapCache = new Map<string, UnderlaySnap[]>();

/**
 * Det man snäpper mot i ett underlag (0.8.16). DXF: linjernas ändar och
 * mittpunkter, bågarnas ändar, mitt och centrum, cirklarnas centrum och
 * kvadrantpunkter, och linjerna själva (bågarna som korta bitar, utan
 * punkter i skarvarna). Släckta lager räknas inte. Bild och PDF: kanterna,
 * så att hörnen och sidornas mitt går att snäppa till.
 */
export function underlaySnaps(doc: ProjectDoc, id: Id, p: UnderlayParams): UnderlaySnap[] {
  if (p.kind !== 'dxf') {
    const c = underlayCorners(p);
    return c.map((a, i) => ({ id, a, b: c[(i + 1) % 4], on: 'På kanten' }));
  }
  const d = dxfOf(doc, p.asset);
  if (!d) return [];
  const key = JSON.stringify([id, doc.assets[p.asset]?.data.length, p.pos, p.angle, p.scale, p.ref, p.layersOff ?? []]);
  const hit = snapCache.get(key);
  if (hit) return hit;
  const t = underlayTransform(p);
  const off = new Set(p.layersOff ?? []);
  const out: UnderlaySnap[] = [];
  const on = 'På linjen';
  for (const it of d.items) {
    if (it.kind !== 'poly' || off.has(it.layer)) continue;
    const pts = it.pts.map(t);
    const n = pts.length;
    const corners = it.corners ? new Set(it.corners) : null;
    for (let i = 0; i + 1 < n + (it.closed ? 1 : 0); i++) {
      const j = (i + 1) % n;
      // Rak, om båda punkterna är hörn och inga punkter längs en båge ligger mellan.
      const straight = !corners || (corners.has(i) && corners.has(j) && (j === i + 1 || (j === 0 && i === n - 1)) && !it.curve);
      out.push(straight ? { id, a: pts[i], b: pts[j], on } : { id, a: pts[i], b: pts[j], curve: true, on });
    }
    if (corners) for (const i of corners) out.push({ id, a: pts[i], b: pts[i], point: 'endpoint' });
    if (it.curve) {
      const c = t(it.curve.c);
      out.push({ id, a: c, b: c, point: 'center' });
      if (it.curve.mid) {
        const m = t(it.curve.mid);
        out.push({ id, a: m, b: m, point: 'midpoint' });
      }
      for (const q of it.curve.quadrants ?? []) {
        const m = t(q);
        out.push({ id, a: m, b: m, point: 'quadrant' });
      }
    }
  }
  if (snapCache.size > 20) snapCache.delete(snapCache.keys().next().value!);
  snapCache.set(key, out);
  return out;
}

export const underlayType: ElementType<UnderlayParams> = {
  type: 'Underlay',
  planReads: [],
  label: 'Underlag',
  labelPlural: 'Underlag',
  // Underst, under fyllningar och allt annat.
  drawOrder: 1,
  compares: false,
  // Finns i alla tillstånd: underlaget hör till ritningen, inte till byggnaden.
  global: true,
  defaults: () => ({ asset: '', kind: 'image', pos: [0, 0], angle: 0, scale: 1, size: [1, 1], opacity: 60 }),
  plan(el, ctx) {
    const p = ctx.params<UnderlayParams>(el);
    if (p.kind === 'dxf') return dxfPrims(ctx.doc, el.id, p, ctx.scale);
    const [bl, br, , tl] = underlayCorners(p);
    return [
      {
        kind: 'image',
        corner: bl,
        u: [br[0] - bl[0], br[1] - bl[1]],
        v: [tl[0] - bl[0], tl[1] - bl[1]],
        source: { asset: p.asset, ...(p.kind === 'pdf' ? { page: p.page ?? 1 } : {}) },
        opacity: Math.max(0.05, Math.min(1, p.opacity / 100)),
        ...(p.gray ? { gray: true } : {}),
        origin: { objectId: el.id, objectType: 'Underlay', part: 'underlag' },
      },
    ];
  },
};
