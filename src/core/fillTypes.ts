import type { FillDef, StyleResources } from './graphics';

/**
 * Egna fyllningstyper (0.8.36): ett mönster av en eller flera linjefamiljer,
 * som i AutoCADs och ArchiCADs `.pat`-filer. En familj är parallella linjer
 * med en vinkel, en baspunkt, ett avstånd mellan linjerna, en förskjutning
 * längs linjen från en linje till nästa och en streckning (som linjetyperna,
 * 0.8.30: streck och mellanrum omväxlande, med början på ett streck; tomt =
 * heldragen; ett streck under 0,5 mm blir en punkt).
 *
 * Måtten är på papper i mm, eller i modellen i mm (`model`) för mönster som
 * följer verkliga mått (tegel, plattor); de räknas då om med ritningens skala.
 *
 * Fyllningstyperna ligger i stilmallen (`StyleResources.fillTypes`) och följer
 * med den. En 2D-form, ett rum eller en snittfyllning anger typen med dess
 * nyckel; en nyckel som inte finns ritas som en vanlig skraffering.
 *
 * Strecken som geometri ligger i `hatchStrokes.ts` och `.pat`-filerna i
 * `patFile.ts` (uppdelat i 0.8.38).
 */

/** En linjefamilj som den skrivs in. Vinkeln i grader moturs. */
export interface FillFamily {
  angle: number;
  /** Baspunkten. */
  x: number;
  y: number;
  /** Avståndet mellan linjerna, vinkelrätt mot dem (> 0). */
  spacing: number;
  /** Hur långt mönstret flyttas längs linjen från en linje till nästa. */
  shift: number;
  /** Streck och mellanrum; tomt = heldragen. */
  dash: number[];
}

export interface FillTypeDef {
  name: string;
  families: FillFamily[];
  /** Måtten är i modellen (mm i verkligheten), inte på papper. */
  model?: boolean;
  /**
   * Linjernas tjocklek på papper i mm (0.8.37); utelämnad = fyllningens
   * förval (0,13 mm i 2D-former och rum, 0,18 mm i snittytor).
   */
  weight?: number;
}

export interface CustomFillType extends FillTypeDef {
  id: string;
}

/**
 * En linjefamilj som den ritas, på papper i mm: vinkeln, avståndet,
 * förskjutningen och streckningen, och baspunktens läge längs och tvärs
 * linjerna (`phase`). Används i fyllningen `pattern` (FillDef).
 */
export interface HatchLine {
  angle: number;
  spacing: number;
  shift?: number;
  dash?: number[];
  phase?: [number, number];
}

const fam = (angle: number, spacing: number, shift = 0, dash: number[] = [], x = 0, y = 0): FillFamily => ({ angle, x, y, spacing, shift, dash });
const ZIG = Math.sqrt(5);
const ZIG_ANGLE = (Math.atan2(2, 1) * 180) / Math.PI;

/**
 * De inbyggda fyllningstyperna (0.8.37), i den ordning de står i listorna.
 * Nycklarna sparas i projekten. Tegel, block och plattor har verkliga mått.
 */
export const FILL_TYPES: Record<string, FillTypeDef> = {
  tegel: { name: 'Tegel i förband', model: true, families: [fam(0, 75), fam(90, 131, 75, [75, 75])] },
  block: { name: 'Lättbetong, block', model: true, families: [fam(0, 200), fam(90, 300, 200, [200, 200])] },
  betong: { name: 'Betong', families: [fam(50, 2, 1.1, [0.6, 2.4]), fam(335, 2.3, 0.7, [0.5, 2.9]), fam(100, 2.6, 1.6, [0, 3.1])] },
  tra: { name: 'Trä', families: [fam(0, 1.2, 3, [6, 1.5]), fam(0, 1.2, 2, [3, 3], 0, 0.6)] },
  plattor300: { name: 'Plattor 300', model: true, families: [fam(0, 300), fam(90, 300)] },
  plattor150: { name: 'Plattor 150', model: true, families: [fam(0, 150), fam(90, 150)] },
  mark: {
    name: 'Mark',
    families: [
      fam(0, 3.175, 3.175, [3.175, 3.175]),
      fam(0, 3.175, 3.175, [3.175, 3.175], 0, 1.19),
      fam(0, 3.175, 3.175, [3.175, 3.175], 0, 2.38),
      fam(90, 3.175, 3.175, [3.175, 3.175], 0.4, 2.78),
      fam(90, 3.175, 3.175, [3.175, 3.175], 1.59, 2.78),
      fam(90, 3.175, 3.175, [3.175, 3.175], 2.78, 2.78),
    ],
  },
  // Markens material (0.10.28.1): gatsten 100 i förband, stenmur i stora block, trallens brädor och singelns prickar.
  gatsten: { name: 'Gatsten 100', model: true, families: [fam(0, 100), fam(90, 50, 100, [100, 100])] },
  stenmur: { name: 'Stenmur', model: true, families: [fam(0, 250), fam(90, 200, 250, [250, 250]), fam(90, 600, 0, [250, 750], 100)] },
  trall: { name: 'Trall', model: true, families: [fam(0, 145)] },
  singel: { name: 'Singel', families: [fam(0, 1.5, 0.75, [0, 1.5]), fam(0, 1.5, 0.75, [0, 1.5], 0.4, 0.75)] },
  // Sicksack 2 mm hög och 2 mm per tand, med 2 mm mellan raderna: uppåt- och nedåtstrecken som två familjer.
  sicksack: { name: 'Sicksack', families: [fam(ZIG_ANGLE, (2 * 2) / ZIG, -2 / ZIG, [ZIG, ZIG]), fam(-ZIG_ANGLE, (2 * 2) / ZIG, 2 / ZIG, [ZIG, ZIG], 1, 2)] },
};

/** Alla fyllningstyper som går att välja: de inbyggda (`own: false`) och stilmallens egna. */
export function fillTypeList(style: StyleResources | undefined): (CustomFillType & { own: boolean })[] {
  return [...Object.entries(FILL_TYPES).map(([id, t]) => ({ id, ...t, own: false })), ...(style?.fillTypes ?? []).map((t) => ({ ...t, own: true }))];
}

/** Typen för nyckeln: en inbyggd eller en av stilmallens egna. */
export function fillTypeOf(style: StyleResources | undefined, id: string | undefined): FillTypeDef | undefined {
  if (!id) return undefined;
  return FILL_TYPES[id] ?? style?.fillTypes?.find((t) => t.id === id);
}

/** En ny nyckel som inte krockar med någon annan. */
export function newFillTypeId(style: StyleResources): string {
  const used = new Set((style.fillTypes ?? []).map((t) => t.id));
  let i = 1;
  while (used.has(`fyllning-${i}`)) i++;
  return `fyllning-${i}`;
}

/** Streckningen med ett jämnt antal tal (en udda följd upprepas, som i SVG). */
export function evenDash(dash: readonly number[] | undefined): number[] | undefined {
  if (!dash?.length || !dash.some((x) => x > 0)) return undefined;
  return dash.length % 2 ? [...dash, ...dash] : [...dash];
}

/**
 * Typens linjer på papper i mm. `angle` vrider hela mönstret (grader),
 * `scale` förstorar det, och `modelPerPaper` är modellens mm per mm på
 * papper (ritningens skalnämnare), för typer med mått i modellen.
 */
export function patternLines(t: FillTypeDef, angle = 0, scale = 1, modelPerPaper = 1): HatchLine[] {
  const k = (scale > 0 ? scale : 1) / (t.model ? modelPerPaper || 1 : 1);
  const out: HatchLine[] = [];
  for (const f of t.families) {
    if (!(f.spacing > 0)) continue;
    const a = (f.angle * Math.PI) / 180;
    // Baspunktens läge i familjens riktning; det ändras inte när mönstret vrids.
    const along = f.x * Math.cos(a) + f.y * Math.sin(a);
    const across = -f.x * Math.sin(a) + f.y * Math.cos(a);
    const dash = evenDash(f.dash);
    out.push({
      angle: f.angle + angle,
      spacing: f.spacing * k,
      ...(f.shift ? { shift: f.shift * k } : {}),
      ...(dash ? { dash: dash.map((d) => d * k) } : {}),
      ...(along || across ? { phase: [along * k, across * k] as [number, number] } : {}),
    });
  }
  return out;
}

/** Den vanliga skrafferingen som linjer (en familj mitt i varje band). */
export function hatchAsLines(angle: number, spacing: number): HatchLine[] {
  return [{ angle, spacing, phase: [0, spacing / 2] }];
}

/**
 * En vanlig skraffering som ett mönster med en familj (0.8.38), så att
 * skärmen och PDF:en ritar båda med samma kod. Linjerna ligger högst `min`
 * isär. Andra fyllningar kommer tillbaka som de är.
 */
export function hatchAsPattern(fill: FillDef, min = 0): FillDef {
  if (fill.kind !== 'hatch') return fill;
  return {
    kind: 'pattern',
    color: fill.color,
    weight: fill.weight,
    lines: hatchAsLines(fill.angle, Math.max(min, fill.spacing)),
    ...(fill.opacity !== undefined ? { opacity: fill.opacity } : {}),
    ...(fill.background ? { background: fill.background, ...(fill.backgroundOpacity !== undefined ? { backgroundOpacity: fill.backgroundOpacity } : {}) } : {}),
  };
}

/**
 * En fyllning av en typ i stilmallen (`kind: 'type'`) som det som ritas
 * (`kind: 'pattern'`). En borttagen typ blir en vanlig skraffering. Övriga
 * fyllningar kommer tillbaka som de är.
 */
export function resolveFill(fill: FillDef, style: StyleResources | undefined, modelPerPaper = 1): FillDef {
  if (fill.kind !== 'type') return fill;
  const t = fillTypeOf(style, fill.type);
  const lines = t ? patternLines(t, fill.angle ?? 0, fill.scale ?? 1, modelPerPaper) : hatchAsLines(45 + (fill.angle ?? 0), 0.6 * (fill.scale ?? 1));
  return {
    kind: 'pattern',
    color: fill.color,
    weight: t?.weight ?? fill.weight ?? 0.13,
    lines: lines.length ? lines : hatchAsLines(45, 2),
    ...(fill.opacity !== undefined ? { opacity: fill.opacity } : {}),
    ...(fill.background ? { background: fill.background, ...(fill.backgroundOpacity !== undefined ? { backgroundOpacity: fill.backgroundOpacity } : {}) } : {}),
  };
}

/** Streckningen som den ritas: korta streck blir punkter (längd 0, rund ände). */
export function drawnDash(dash: readonly number[]): { dash: number[]; round: boolean } {
  let round = false;
  const out = dash.map((d, i) => {
    if (i % 2 === 0 && d < 0.5) {
      round = true;
      return 0;
    }
    return d;
  });
  return { dash: out, round };
}

/** Stilmallens fyllningstyper från fil; de som inte går att läsa hoppas över. */
export function normalizeFillTypes(v: unknown): CustomFillType[] | null {
  if (!Array.isArray(v)) return null;
  const out: CustomFillType[] = [];
  for (const t of v) {
    if (typeof t?.id !== 'string' || !t.id || FILL_TYPES[t.id] || out.some((o) => o.id === t.id)) continue;
    const families = (Array.isArray(t.families) ? t.families : []).map(normalizeFamily).filter((f: FillFamily | null): f is FillFamily => !!f);
    if (!families.length) continue;
    const w = Number(t.weight);
    out.push({ id: t.id, name: typeof t.name === 'string' && t.name.trim() ? t.name.trim() : t.id, families, ...(t.model ? { model: true } : {}), ...(w > 0 ? { weight: w } : {}) });
  }
  return out.length ? out : null;
}

function normalizeFamily(f: any): FillFamily | null {
  const num = (x: unknown) => (Number.isFinite(Number(x)) ? Number(x) : 0);
  const spacing = Number(f?.spacing);
  if (!(spacing > 0)) return null;
  const dash = Array.isArray(f.dash) ? f.dash.map(Number).filter((x: number) => Number.isFinite(x) && x >= 0) : [];
  return { angle: num(f.angle), x: num(f.x), y: num(f.y), spacing, shift: num(f.shift), dash: dash.some((x: number) => x > 0) ? dash : [] };
}
