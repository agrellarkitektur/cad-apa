import type { Color, FillDef, Material, StyleSheet } from '../core/graphics';
import { fillTypeOf, hatchAsLines, patternLines, resolveFill, type HatchLine } from '../core/fillTypes';
import type { Primitive, Vec2 } from '../repr/primitives';

/**
 * Fyllningen (ur `drawing2d.ts` i granskningen efter 0.10.15): parametrarna,
 * materialet och primitiverna, gemensamma för 2D-former, rum,
 * markobjekt och slänter. Allt exporteras vidare från `drawing2d.ts`.
 */

/**
 * Fyllningens mönster. `mask` (0.8.30) är en yta utan egen färg: den döljer
 * det som ligger under och syns som ritningens bakgrund (papperet i PDF:en).
 */
export type FillPattern = 'solid' | 'hatch' | 'cross' | 'mask' | 'type';

/** Fyllningens inställningar, samma för 2D-former och rum (0.8.25). */
export interface FillParams {
  /** Fyllningens mönster; utelämnad = ingen fyllning. `type` = en egen fyllningstyp (0.8.36). */
  fill?: FillPattern;
  /**
   * Den egna fyllningstypens nyckel i stilmallen (0.8.36), med vridning i
   * grader och skala (utelämnade = 0 och 1). En typ som inte finns ritas
   * som en skraffering.
   */
  fillType?: string;
  fillTypeAngle?: number;
  fillTypeScale?: number;
  /** Fyllningens färg som #rrggbb; utelämnad = grå. */
  fillColor?: string;
  /** Skrafferingens vinkel i grader och avstånd på papper i mm. */
  fillAngle: number;
  fillSpacing: number;
  /** Linjens opacitet i procent (0.8.22); utelämnad = 100. */
  opacity?: number;
  /**
   * Fyllningens opacitet i procent (0.8.22). Utelämnad = samma som linjen,
   * så att en ändring av `opacity` gäller båda tills de skiljs åt.
   */
  fillOpacity?: number;
  /**
   * Skrafferingens bakgrund (0.8.29) som #rrggbb, eller `paper` för en mask
   * (0.8.30, förvalet): ritningens bakgrund, utan egen färg. Utelämnad =
   * ingen. En hel yta under strecken, med egen opacitet i procent
   * (utelämnad = 100). Bara skraffering och korsskraffering; en hel
   * fyllning har redan sin färg.
   */
  fillBackground?: string;
  fillBackgroundOpacity?: number;
  /**
   * Mönstrets penna på papper i mm (0.10.14); utelämnad = fyllningstypens
   * egen eller `FILL_WEIGHT`.
   */
  fillWeight?: number;
  /**
   * Mönstrets mått i verkligheten (mm i modellen) i stället för på papper
   * (0.10.14). Utelämnad = skrafferingen på papper och fyllningstypen som
   * typen säger.
   */
  fillModel?: boolean;
  /**
   * Materialet (0.10.28, ersätter den sparade fyllningen från 0.10.14): dess
   * nyckel i stilmallen. Fyllningens fält i objektet är en kopia av
   * materialets plan, så att det ser likadant ut om materialet tas bort.
   */
  material?: string;
  /** Opaciteten överstyrd för objektet (0.10.28), procent; utelämnad = materialets. */
  materialOpacity?: number;
  /** Mönstret vridet för objektet (0.10.28), grader utöver materialets; utelämnad = 0. */
  materialAngle?: number;
}

/** Fyllningens fält, utom kopplingen: det ett material bestämmer i planen (0.10.14, 0.10.28). */
export const FILL_FIELDS = ['fill', 'fillType', 'fillTypeAngle', 'fillTypeScale', 'fillColor', 'fillAngle', 'fillSpacing', 'fillOpacity', 'fillBackground', 'fillBackgroundOpacity', 'fillWeight', 'fillModel'] as const;

/** Vykategorin som ett material ritas efter (0.10.28): Platsens kategorier; utelämnad = planen. */
export type FillCategory = 'situation' | 'grading' | 'illustration' | undefined;

/** Materialet som objektet är kopplat till, eller undefined när det inte finns i stilmallen. */
export function materialOf(p: Pick<FillParams, 'material'>, style: StyleSheet | undefined): Material | undefined {
  return p.material ? style?.materials?.find((m) => m.id === p.material) : undefined;
}

/**
 * Materialets fyllning i vykategorin (0.10.28): i illustrationsplanen dess
 * färg (när den har en), annars planens fyllning.
 */
export function materialFill(m: Material, category?: FillCategory): Partial<FillParams> {
  if (category === 'illustration' && m.illustration) return { fill: 'solid', fillColor: m.illustration.color, fillOpacity: m.illustration.opacity ?? 100 };
  return m.plan as Partial<FillParams>;
}

/**
 * Fyllningen som den gäller: materialets i vykategorin när objektet är
 * kopplat till ett som finns i stilmallen (0.10.28), med objektets egen
 * opacitet och vridning, annars objektets egen. Linjens opacitet följer
 * inte med materialet.
 */
export function effectiveFill<P extends Partial<FillParams>>(p: P, style: StyleSheet | undefined, category?: FillCategory): P {
  const m = materialOf(p, style);
  if (!m) return p;
  const rep = materialFill(m, category) as Record<string, unknown>;
  const out = { ...p } as Record<string, unknown>;
  for (const k of FILL_FIELDS) {
    if (rep[k] === undefined) delete out[k];
    else out[k] = rep[k];
  }
  if (out.fillOpacity === undefined) out.fillOpacity = 100;
  if (p.materialOpacity !== undefined && Number.isFinite(p.materialOpacity)) out.fillOpacity = p.materialOpacity;
  const turn = p.materialAngle ?? 0;
  if (turn && out.fill === 'type') out.fillTypeAngle = (Number(out.fillTypeAngle) || 0) + turn;
  else if (turn && (out.fill === 'hatch' || out.fill === 'cross')) out.fillAngle = (Number.isFinite(out.fillAngle) ? Number(out.fillAngle) : 45) + turn;
  return out as P;
}

/** Mönstrets penna när varken objektet eller fyllningstypen har en egen, mm på papper. */
export const FILL_WEIGHT = 0.13;

/** Fyllningar med streck och därmed bakgrund: skraffering, korsskraffering och egna typer. */
export function hasBackground(fill: FillPattern | undefined): boolean {
  return fill === 'hatch' || fill === 'cross' || fill === 'type';
}

/** Bakgrundens förval (0.8.30): en mask, ritningens bakgrund utan egen färg. */
export const FILL_BACKGROUND = 'paper';

/** Färgen som föreslås när bakgrunden får en egen färg (0.8.29). */
export const BACKGROUND_COLOR = '#ffffff';

/**
 * Fyllningens ytor för konturen `rings` (0.8.25): en hel fyllning eller en
 * eller två skrafferingar. `under` = bakom väggarna.
 */
export function fillPrims(rings: readonly (readonly Vec2[])[], own: FillParams, origin: Primitive['origin'] | undefined, under: boolean, style?: StyleSheet, scale = 1, category?: FillCategory): Primitive[] {
  const p = effectiveFill(own, style, category);
  if (!p.fill) return [];
  const fills: FillDef[] = [];
  // Bakgrunden under skrafferingen (0.8.29), med egen opacitet.
  const back = hasBackground(p.fill) && p.fillBackground ? backgroundOpacity(p) : 0;
  if (back > 0) fills.push({ kind: 'solid', color: p.fillBackground as Color, ...(back < 1 ? { opacity: back } : {}) });
  const op = opacitiesOf(p).fill;
  if (op > 0) {
    const color = (p.fillColor ?? FILL_COLOR) as Color;
    const alpha = op < 1 ? { opacity: op } : {};
    const angle = Number.isFinite(p.fillAngle) ? p.fillAngle : 45;
    const spacing = p.fillSpacing > 0 ? p.fillSpacing : 2;
    const weight = p.fillWeight !== undefined && p.fillWeight > 0 ? p.fillWeight : undefined;
    // Mönstret utgår från objektets första hörn (0.10.14), så att det följer med när objektet flyttas.
    const at = rings[0]?.[0];
    const anchor = (lines: HatchLine[]): HatchLine[] => (at ? anchorLines(lines, at, scale) : lines);
    // Skrafferingens avstånd i verkliga mått (0.10.14) i stället för på papper.
    const paperSpacing = p.fillModel ? spacing / (scale || 1) : spacing;
    const hatch = (a: number): FillDef => ({ kind: 'pattern', color, weight: weight ?? FILL_WEIGHT, lines: anchor(hatchAsLines(a, paperSpacing)), ...alpha });
    const solid = (c: Color): FillDef => ({ kind: 'solid', color: c, ...alpha });
    // En egen fyllningstyp (0.8.36): alla familjer i en yta; måtten på papper eller i verkligheten (0.10.14).
    const own = (): FillDef => {
      const t = fillTypeOf(style, p.fillType);
      const f = t
        ? ({ kind: 'pattern', color, weight: t.weight ?? FILL_WEIGHT, lines: patternLines({ ...t, model: p.fillModel ?? t.model }, p.fillTypeAngle ?? 0, p.fillTypeScale ?? 1, scale), ...alpha } as FillDef)
        : resolveFill({ kind: 'type', type: p.fillType ?? '', color, weight: FILL_WEIGHT, angle: p.fillTypeAngle ?? 0, scale: p.fillTypeScale ?? 1, ...alpha }, style, scale);
      return f.kind === 'pattern' ? { ...f, lines: anchor(f.lines), ...(weight !== undefined ? { weight } : {}) } : f;
    };
    fills.push(...(p.fill === 'type' ? [own()] : p.fill === 'mask' ? [solid('paper')] : p.fill === 'solid' ? [solid(color)] : p.fill === 'cross' ? [hatch(angle), hatch(angle + 90)] : [hatch(angle)]));
  }
  return fills.map((fill): Primitive => ({ kind: 'region', role: 'cut', rings, fill, outline: null, noOutline: true, ownFill: true, ...(under ? { under: true } : {}), origin: origin && { ...origin, part: 'fyllning' } }));
}

/**
 * Mönstrets linjer flyttade så att de utgår från punkten `at` i modellen
 * (mm) i stället för modellens nollpunkt (0.10.14). Linjerna är på papper,
 * `scale` modellens mm per mm på papper.
 */
export function anchorLines(lines: readonly HatchLine[], at: Vec2, scale: number): HatchLine[] {
  const x = at[0] / (scale || 1);
  const y = at[1] / (scale || 1);
  return lines.map((l) => {
    const a = (l.angle * Math.PI) / 180;
    const along = x * Math.cos(a) + y * Math.sin(a);
    const across = -x * Math.sin(a) + y * Math.cos(a);
    // Samma linjer med det minsta läget: tvärs inom ett linjeavstånd, längs inom en streckperiod.
    let [p0, p1] = l.phase ?? [0, 0];
    p0 += along;
    p1 += across;
    const m = Math.floor(p1 / l.spacing);
    p1 -= m * l.spacing;
    p0 -= m * (l.shift ?? 0);
    const period = l.dash?.reduce((t, d) => t + d, 0) ?? 0;
    p0 = period > 0 ? p0 - Math.floor(p0 / period) * period : 0;
    const r = (v: number) => Math.round(v * 1e4) / 1e4;
    return { ...l, phase: [r(p0), r(p1)] as [number, number] };
  });
}

/** Bakgrundens opacitet 0–1 (0.8.29); utelämnad = 1. */
export function backgroundOpacity(p: Pick<FillParams, 'fillBackgroundOpacity'>): number {
  const v = p.fillBackgroundOpacity;
  return v === undefined || !Number.isFinite(v) ? 1 : Math.max(0, Math.min(100, v)) / 100;
}

/** Fyllningens förvalda färg. */
export const FILL_COLOR = '#9aa0a6';

/** Opaciteten 0–1 för linjen och fyllningen; 1 = helt täckande. */
export function opacitiesOf(p: Pick<FillParams, 'opacity' | 'fillOpacity'>): { line: number; fill: number } {
  const of = (v: number | undefined) => (v === undefined || !Number.isFinite(v) ? 1 : Math.max(0, Math.min(100, v)) / 100);
  return { line: of(p.opacity), fill: of(p.fillOpacity ?? p.opacity) };
}

export const PATTERN_LABELS: Record<FillPattern, string> = {
  solid: 'Hel fyllning',
  hatch: 'Skraffering',
  cross: 'Korsskraffering',
  mask: 'Mask',
  type: 'Egen fyllningstyp',
};
