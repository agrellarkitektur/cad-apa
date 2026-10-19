import type { ActionKey, Color, FillDef } from '../core/graphics';

/**
 * Ritningsprimitiver: det gemensamma 2D-formatet som skärmen, PDF-exporten och
 * DXF-exporten ritar ifrån. Allt anges i modellkoordinater (mm, y uppåt).
 *
 * Objekt i modellen (väggar, dörrar …) översätts till primitiver av
 * planreglerna. Ingen vy eller export ska behöva känna till objekttyperna.
 */

export type Vec2 = readonly [x: number, y: number];

/**
 * Pennfärg: en ritningsfärg ur stilmallen, eller "muted"/"accent" för
 * hjälpgrafik på skärmen (möbler, markering).
 */
export type PenColor = Color | 'muted' | 'accent';

export interface Pen {
  /** Linjebredd på papper i mm (0,13 · 0,18 · 0,25 · 0,35 · 0,5 · 0,7). */
  weight: number;
  color?: PenColor;
  /** Streckmönster på papper i mm, t.ex. [2, 1] för streckad linje. */
  dash?: readonly number[];
  /** Täckning 0–1, för tonade underlag (0.8). Utelämnad = hel. */
  opacity?: number;
}

/** Varifrån en primitiv kommer. Lagerreglerna läser detta vid export. */
export interface Origin {
  objectId?: string;
  objectType?: string;
  /** Vilken del av objektet, t.ex. "snitt", "dörrblad", "slagbåge". */
  part?: string;
}

interface Base {
  origin?: Origin;
}

export interface LinePrim extends Base {
  kind: 'line';
  a: Vec2;
  b: Vec2;
  pen: Pen;
}

export interface PolylinePrim extends Base {
  kind: 'polyline';
  points: readonly Vec2[];
  closed: boolean;
  pen: Pen;
}

/**
 * En yta med eventuella hål, som en vägg i snitt. Första ringen är
 * ytterkonturen, de följande är hål. "cut" betyder att ytan är snittad och
 * får fyllning och kontur från stilmallen.
 */
export interface RegionPrim extends Base {
  kind: 'region';
  rings: readonly (readonly Vec2[])[];
  role: 'cut';
  fill: FillDef;
  outline: Pen | null;
  /**
   * Rita ytan som en annan åtgärd än elementets egen, t.ex. ett igensatt
   * dörrhål som är nytt väggmaterial i en befintlig vägg.
   */
  styleAs?: ActionKey;
  /** Ytan ritas utan kontur, bara med fyllning. */
  noOutline?: boolean;
  /** Ytan behåller sin egen fyllning och kontur (symboler som pilar), oavsett stilmall. */
  ownFill?: boolean;
}

export interface ArcPrim extends Base {
  kind: 'arc';
  center: Vec2;
  radius: number;
  /** Vinklar i radianer, moturs från x-axeln. */
  start: number;
  end: number;
  pen: Pen;
}

export interface TextPrim extends Base {
  kind: 'text';
  at: Vec2;
  text: string;
  /** Texthöjd på papper i mm. */
  height: number;
  align?: 'start' | 'middle' | 'end';
  /** Vridning i radianer moturs; texten läses alltid från vänster eller nedifrån. */
  angle?: number;
  /** Fet stil, t.ex. rumsnamn. */
  bold?: boolean;
  pen: Pen;
}

/**
 * En bild (0.8): ett underlag som en PDF-sida eller ett foto. Bilden fyller
 * parallellogrammen från `corner` (nedre vänstra hörnet) längs `u` (bredden)
 * och `v` (höjden). Själva bilden hämtas med `source` när den ritas, så att
 * primitiverna förblir små.
 */
export interface ImagePrim extends Base {
  kind: 'image';
  corner: Vec2;
  u: Vec2;
  v: Vec2;
  /** Vilken fil och (för PDF) vilken sida. */
  source: { asset: string; page?: number };
  /** Täckning 0–1. */
  opacity: number;
  /** I gråskala. */
  gray?: boolean;
  /** Bara det som ligger inom rektangeln ritas, t.ex. vyns ram på ett blad (0.8 del 3). */
  clip?: Bounds;
}

export type Primitive = LinePrim | PolylinePrim | RegionPrim | ArcPrim | TextPrim | ImagePrim;

/** Bildens fyra hörn: nedre vänstra, nedre högra, övre högra, övre vänstra. */
export function imageCorners(p: Pick<ImagePrim, 'corner' | 'u' | 'v'>): Vec2[] {
  const c = p.corner;
  return [c, [c[0] + p.u[0], c[1] + p.u[1]], [c[0] + p.u[0] + p.v[0], c[1] + p.u[1] + p.v[1]], [c[0] + p.v[0], c[1] + p.v[1]]];
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Ungefärlig omslutande rektangel. Text räknas bara med sin insättningspunkt. */
export function boundsOf(prims: readonly Primitive[]): Bounds | null {
  let b: Bounds | null = null;
  const add = (p: Vec2) => {
    if (!b) b = { minX: p[0], minY: p[1], maxX: p[0], maxY: p[1] };
    else {
      b.minX = Math.min(b.minX, p[0]);
      b.minY = Math.min(b.minY, p[1]);
      b.maxX = Math.max(b.maxX, p[0]);
      b.maxY = Math.max(b.maxY, p[1]);
    }
  };
  for (const p of prims) {
    switch (p.kind) {
      case 'line':
        add(p.a);
        add(p.b);
        break;
      case 'polyline':
        p.points.forEach(add);
        break;
      case 'region':
        p.rings.forEach((r) => r.forEach(add));
        break;
      case 'arc':
        add([p.center[0] - p.radius, p.center[1] - p.radius]);
        add([p.center[0] + p.radius, p.center[1] + p.radius]);
        break;
      case 'text':
        add(p.at);
        break;
      case 'image':
        imageCorners(p).forEach(add);
        break;
    }
  }
  return b;
}
