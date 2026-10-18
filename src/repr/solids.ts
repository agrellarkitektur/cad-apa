import type { Vec2 } from './primitives';

/**
 * 3D-formatet: lodräta extruderingar av plana former, i modellens mm med z
 * uppåt. Räcker för väggar, öppningar, golv och enkla möbler, och kan läsas
 * av 3D-vyn och senare av IFC-exporten utan att någon av dem känner till
 * elementtyperna.
 */
export type Material3D = 'wall' | 'wall-new' | 'glass' | 'door' | 'frame' | 'furniture' | 'fixture' | 'floor';

export interface Solid {
  kind?: 'solid';
  /** Elementet formen kommer från, för markering. */
  id: string;
  /** Ytterkontur först, sedan hål. */
  rings: Vec2[][];
  z0: number;
  z1: number;
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

/** Kantlinjer i 3D: par av punkter (mm, z uppåt). */
export interface Edges3D {
  kind: 'edges';
  id: string;
  segments: [x1: number, y1: number, z1: number, x2: number, y2: number, z2: number][];
}

export type Shape3D = Solid | Edges3D;
