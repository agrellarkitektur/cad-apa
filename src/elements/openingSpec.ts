import { openingSettingsOf } from '../core/general';
import type { Definition, Element, ProjectDoc } from '../core/model';
import {
  fallbackModel,
  frameFromModule,
  holeFromFrame,
  kindOfElementType,
  LEAF_OPS,
  SIDE_HUNG,
  standsOnFloor,
  type OpeningKind,
  type OpeningTypeModel,
} from '../core/openingTypes';
import type { FrameParams } from './opening';
import type { OpeningParams } from './wallBodies';

/**
 * Dörrarnas, fönstrens och vägghålens parametrar (0.11.8, format 28). Typen
 * ger karmen och lufterna, objektet måtten, läget och hängningen.
 */
export interface OpeningObjParams extends OpeningParams, FrameParams {
  /** Modulmåttet, mm (1000 = 10M). */
  width: number;
  height: number;
  /** Eget karmyttermått (bredd, höjd), mm, när det inte följer modulen. */
  frame?: [number, number] | null;
  /** Vilken ände längs väggen den första luftens gångjärn sitter (*Spegla hängning* byter). */
  hinge: 'start' | 'end';
  /** Dörrens slagsida: 1 = vänster om väggens riktning. Fönster: sidan de öppnas utåt mot i innerväggar. */
  swing?: 1 | -1;
  /** Hålets underkant över våningens golv (fönster), mm; med `sillFromWall` från väggens fot. */
  sill?: number;
  sillFromWall?: boolean;
  /** Höjdläget: bröstningen eller överkant karm (`head`) står fast. */
  heightRef?: 'sill' | 'head';
  head?: number;
  /** Karmens läge: liv ute, liv inne eller mitt i väggen; avståndet är `inset`. */
  place?: 'out' | 'in' | 'mid';
  /** Egen eller låst littera; tom = litteraregeln. */
  littera?: string;
  mainEntrance?: boolean;
  // Räknade (`deriveOpening`):
  frameW: number;
  frameH: number;
  holeW: number;
  holeH: number;
  gap: number;
  /** Står på golvet (dörrar, fönsterdörren). */
  floor: boolean;
}

/** Typen för ett objekt: definitionens, eller förvalet för sorten. */
export function openingModelOf(doc: Pick<ProjectDoc, 'definitions'>, el: Pick<Element, 'type' | 'definition'>): OpeningTypeModel {
  const def = el.definition ? doc.definitions[el.definition] : undefined;
  const kind = kindOfElementType(el.type) ?? 'window';
  return def?.opening && def.opening.kind === kind ? def.opening : fallbackModel(kind);
}

/**
 * Räkna fram karmytter- och hålmåttet, karmens mått ur typen och
 * bröstningen ur överkanten (registrets `derive`).
 */
export function deriveOpening(kind: OpeningKind) {
  return (out: Record<string, unknown>, el: Element<any>, doc: ProjectDoc, def: Definition | undefined): void => {
    const m = def?.opening && def.opening.kind === kind ? def.opening : fallbackModel(kind);
    const st = openingSettingsOf(doc.graphics);
    const gap = st.gap;
    const own = el.params as Record<string, unknown>;
    if (own.width === undefined && def?.params.width === undefined) out.width = m.size[0];
    if (own.height === undefined && def?.params.height === undefined) out.height = m.size[1];
    if (own.frameWidth === undefined) out.frameWidth = m.frame.width;
    if (own.frameDepth === undefined) out.frameDepth = m.frame.depth;
    const fr = Array.isArray(out.frame) && out.frame.length === 2 ? (out.frame as [number, number]) : frameFromModule(m, [Number(out.width), Number(out.height)], gap);
    const hole = holeFromFrame(m, fr, gap);
    out.frameW = fr[0];
    out.frameH = fr[1];
    out.holeW = hole[0];
    out.holeH = hole[1];
    out.gap = gap;
    const floor = standsOnFloor(m);
    out.floor = floor;
    if (kind === 'door') {
      delete out.sill;
      return;
    }
    // Höjdläget: bröstningen står fast, eller överkant karm (förval för fönster som inte står på golvet).
    const ref = own.heightRef ?? (own.sill !== undefined || floor ? 'sill' : 'head');
    out.heightRef = ref;
    if (ref === 'head') {
      const head = typeof own.head === 'number' ? own.head : st.head;
      out.head = head;
      out.sill = head - fr[1] - (floor ? 0 : gap);
    } else {
      if (own.sill === undefined) out.sill = m.sill ?? (kind === 'hole' ? 300 : 900);
      out.head = Number(out.sill) + (floor ? 0 : gap) + fr[1];
    }
  };
}

/** Modulmåttet i hela moduler (1180 → 12), eller null när karmyttermåttet är eget och inte på modulen. */
export function moduleText(p: Pick<OpeningObjParams, 'width' | 'height' | 'frame'>): string {
  const m = (v: number) => Math.round(v / 100);
  return `${m(p.width)} × ${m(p.height)}`;
}

/** Om karmyttermåttet är skrivet fritt och inte ligger på modulen. */
export const customFrame = (p: Pick<OpeningObjParams, 'frame'>): boolean => Array.isArray(p.frame);

// ---------------------------------------------------------------------------
// Sett utifrån

/**
 * Den sida av väggen som öppningen ses ifrån (utsidan i ytterväggar). I
 * innerväggar ses en dörr från sidan den inte slår mot, ett fönster från
 * den sida det öppnas utåt mot (`swing`, förval vänster).
 */
export function viewFace(outside: 1 | -1 | null, kind: OpeningKind, swing: 1 | -1 | undefined): 1 | -1 {
  if (outside !== null) return outside;
  if (kind === 'door') return (-(swing ?? 1)) as 1 | -1;
  return swing ?? 1;
}

/** Var den första sidohängda luftens gångjärn sitter i typen, sett utifrån. */
function naturalHinge(m: OpeningTypeModel): 'left' | 'right' {
  const c = m.cells.find((x) => SIDE_HUNG.has(x.op) && x.hinge);
  return c?.hinge ?? 'left';
}

/**
 * Från karmens u (från vänster sett utifrån) till läget längs väggen. Sett
 * från vänster sida (n) går väggens riktning åt höger till vänster.
 * Objektets `hinge` (start/slut) avgör om typen speglas.
 */
export function uMapping(m: OpeningTypeModel, vf: 1 | -1, hinge: 'start' | 'end', s1: number, s2: number): { s: (u: number) => number; mirrored: boolean } {
  // Utan spegling: vänster sett utifrån är slutet (vf = 1) eller början (vf = −1).
  const leftIsStart = vf === -1;
  const natural = naturalHinge(m);
  const naturalAtStart = (natural === 'left') === leftIsStart;
  const mirrored = naturalAtStart !== (hinge === 'start');
  const fromStart = leftIsStart !== mirrored;
  return { s: (u) => (fromStart ? s1 + u : s2 - u), mirrored };
}

/** Hängningen sedd utifrån eller inifrån: V, H eller tom per luft (*VH* för ett 2-luft). */
export function hingeLetters(m: OpeningTypeModel, mirrored: boolean, fromInside = false): string {
  const flip = mirrored !== fromInside;
  return m.cells
    .filter((c) => (SIDE_HUNG.has(c.op) || LEAF_OPS.has(c.op)) && c.hinge)
    .sort((a, b) => a.row - b.row || a.col - b.col)
    .map((c) => ((c.hinge === 'left') !== flip ? 'V' : 'H'))
    .join('');
}
