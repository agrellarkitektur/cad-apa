import type { Vec2 } from './primitives';

/**
 * 3D-formatet: lodräta extruderingar av plana former, i modellens mm med z
 * uppåt. Ovan- och undersidan kan vara sneda plan (tak). Räcker för väggar, öppningar, golv och enkla möbler, och kan läsas
 * av 3D-vyn och senare av IFC-exporten utan att någon av dem känner till
 * elementtyperna.
 */
export type Material3D = 'wall' | 'wall-new' | 'glass' | 'door' | 'frame' | 'furniture' | 'fixture' | 'floor' | 'slab' | 'roof' | 'site' | 'tree' | 'ground';

/**
 * Ett plan i höjdled: z = a·x + b·y + c (mm). Används för sneda ovan- och
 * undersidor, som tak och väggar som kapas av taket (format 4).
 */
export type Plane = readonly [a: number, b: number, c: number];

export const zOn = (pl: Plane, x: number, y: number): number => pl[0] * x + pl[1] * y + pl[2];

export interface Solid {
  kind?: 'solid';
  /** Elementet formen kommer från, för markering. */
  id: string;
  /** Ytterkontur först, sedan hål. */
  rings: Vec2[][];
  z0: number;
  z1: number;
  /** Sned ovansida i stället för z1. z1 är då formens högsta punkt. */
  top?: Plane;
  /** Sned undersida i stället för z0. z0 är då formens lägsta punkt. */
  bottom?: Plane;
  material: Material3D;
  /**
   * Rita inga kantlinjer för formen. Väggar sätter det och levererar egna
   * kantlinjer, så att skarvar mellan bitarna runt öppningar inte syns.
   */
  noEdges?: boolean;
  /**
   * Genomgående urtag, t.ex. öppningar i en vägg: plan form och höjder.
   * Formen byggs då som en hel kropp med hål, se solidTriangles.
   */
  cuts?: Cut3D[];
}

export interface Cut3D {
  rings: Vec2[][];
  z0: number;
  z1: number;
}

/**
 * Vad en kantlinje är, för linjetjockleken i fasader och sektioner (0.7.1):
 * hålets omfattning ritas tjockast, karm och båge tunnare, sammanfogningar
 * och glasmarkering tunnast och grå.
 */
export type EdgePart = 'wall' | 'hole' | 'roof' | 'frame' | 'sash' | 'leaf' | 'lining' | 'handle' | 'sill' | 'joint' | 'glass' | 'swing';

/** Kantlinjer i 3D: par av punkter (mm, z uppåt). */
export interface Edges3D {
  kind: 'edges';
  id: string;
  segments: [x1: number, y1: number, z1: number, x2: number, y2: number, z2: number][];
  part?: EdgePart;
  /** Streckning på papper (mm), t.ex. öppningssätt. */
  dash?: readonly number[];
  /** Bara i ritningar (fasad, sektion), inte i 3D-vyn: glasmarkering, öppningssätt. */
  drawingOnly?: boolean;
}

export type Shape3D = Solid | Edges3D;

/** En 3D-form flyttad `dz` i höjd: höjderna, urtagen och de sneda planen (0.9). */
export function liftShape(s: Shape3D, dz: number): Shape3D {
  if (!dz) return s;
  if (s.kind === 'edges') return { ...s, segments: s.segments.map(([a, b, c, d, e, f]) => [a, b, c + dz, d, e, f + dz] as Edges3D['segments'][number]) };
  const lift = (pl: Plane): Plane => [pl[0], pl[1], pl[2] + dz];
  return {
    ...s,
    z0: s.z0 + dz,
    z1: s.z1 + dz,
    ...(s.top ? { top: lift(s.top) } : {}),
    ...(s.bottom ? { bottom: lift(s.bottom) } : {}),
    ...(s.cuts ? { cuts: s.cuts.map((c) => ({ ...c, z0: c.z0 + dz, z1: c.z1 + dz })) } : {}),
  };
}


/**
 * Objektets nivå mot våningen (0.10.13): hur mycket över (eller med minus
 * under) våningens golv det ligger, mm. För en vägg gäller den foten, för
 * ett bjälklag ovansidan och för en möbel undersidan. Utelämnad = 0.
 */
export function levelOf(p: { level?: unknown }): number {
  return typeof p.level === 'number' && Number.isFinite(p.level) ? p.level : 0;
}
