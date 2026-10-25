import type { Color, FillDef, StyleSheet } from './graphics';

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
 * Fyllningstyperna ligger i stilmallen (`StyleSheet.fillTypes`) och följer
 * med den. En 2D-form, ett rum eller en snittfyllning anger typen med dess
 * nyckel; en nyckel som inte finns ritas som en vanlig skraffering.
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

/** Stilmallens fyllningstyper. */
export function fillTypeList(style: StyleSheet | undefined): CustomFillType[] {
  return style?.fillTypes ?? [];
}

export function fillTypeOf(style: StyleSheet | undefined, id: string | undefined): CustomFillType | undefined {
  return id ? style?.fillTypes?.find((t) => t.id === id) : undefined;
}

/** En ny nyckel som inte krockar med någon annan. */
export function newFillTypeId(style: StyleSheet): string {
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
 * En fyllning av en typ i stilmallen (`kind: 'type'`) som det som ritas
 * (`kind: 'pattern'`). En borttagen typ blir en vanlig skraffering. Övriga
 * fyllningar kommer tillbaka som de är.
 */
export function resolveFill(fill: FillDef, style: StyleSheet | undefined, modelPerPaper = 1): FillDef {
  if (fill.kind !== 'type') return fill;
  const t = fillTypeOf(style, fill.type);
  const lines = t ? patternLines(t, fill.angle ?? 0, fill.scale ?? 1, modelPerPaper) : hatchAsLines(45 + (fill.angle ?? 0), 0.6 * (fill.scale ?? 1));
  return {
    kind: 'pattern',
    color: fill.color,
    weight: fill.weight ?? 0.13,
    lines: lines.length ? lines : hatchAsLines(45, 2),
    ...(fill.opacity !== undefined ? { opacity: fill.opacity } : {}),
    ...(fill.background ? { background: fill.background, ...(fill.backgroundOpacity !== undefined ? { backgroundOpacity: fill.backgroundOpacity } : {}) } : {}),
  };
}

/** Ett streck i en linjefamilj inom en ruta: från a till b, och hur långt in i streckningen det börjar. */
export interface HatchStroke {
  a: [number, number];
  b: [number, number];
  phase: number;
}

/**
 * Familjens linjer över rutan (på papper eller i vilket mått som helst, som
 * linjen), med var streckningen börjar på varje linje. Högst `max` linjer.
 * Används av PDF:en och förhandsvisningarna; skärmen ritar ett SVG-mönster.
 */
export function hatchStrokes(l: HatchLine, box: { minX: number; minY: number; maxX: number; maxY: number }, max = 20000): HatchStroke[] {
  const a = (l.angle * Math.PI) / 180;
  const dir = [Math.cos(a), Math.sin(a)];
  const nor = [-dir[1], dir[0]];
  const corners = [
    [box.minX, box.minY],
    [box.maxX, box.minY],
    [box.maxX, box.maxY],
    [box.minX, box.maxY],
  ];
  const along = corners.map((p) => p[0] * dir[0] + p[1] * dir[1]);
  const across = corners.map((p) => p[0] * nor[0] + p[1] * nor[1]);
  const t0 = Math.min(...along) - 1;
  const t1 = Math.max(...along) + 1;
  const [p0, p1] = l.phase ?? [0, 0];
  const sp = l.spacing;
  if (!(sp > 0)) return [];
  const k0 = Math.floor((Math.min(...across) - p1) / sp);
  const k1 = Math.ceil((Math.max(...across) - p1) / sp);
  const period = l.dash?.reduce((s, x) => s + x, 0) ?? 0;
  const out: HatchStroke[] = [];
  for (let k = k0; k <= k1 && out.length < max; k++) {
    const s = p1 + k * sp;
    const start = p0 + k * (l.shift ?? 0);
    const phase = period > 0 ? (((t0 - start) % period) + period) % period : 0;
    out.push({
      a: [nor[0] * s + dir[0] * t0, nor[1] * s + dir[1] * t0],
      b: [nor[0] * s + dir[0] * t1, nor[1] * s + dir[1] * t1],
      phase,
    });
  }
  return out;
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
    if (typeof t?.id !== 'string' || !t.id || out.some((o) => o.id === t.id)) continue;
    const families = (Array.isArray(t.families) ? t.families : []).map(normalizeFamily).filter((f: FillFamily | null): f is FillFamily => !!f);
    if (!families.length) continue;
    out.push({ id: t.id, name: typeof t.name === 'string' && t.name.trim() ? t.name.trim() : t.id, families, ...(t.model ? { model: true } : {}) });
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

/**
 * Fyllningstyperna i en `.pat`-fil (AutoCAD, ArchiCAD): en rubrik
 * `*NAMN, beskrivning` och en rad per linjefamilj, `vinkel, x, y,
 * förskjutning, avstånd, streck …` där positiva tal är streck, negativa
 * mellanrum och 0 en punkt. Kommentarer börjar med `;`. Typer utan någon
 * läsbar familj hoppas över. Mönster med stora mått (över 20 mm mellan
 * linjerna) antas vara i verkliga mått (modellen).
 */
export function parsePat(text: string): FillTypeDef[] {
  const out: FillTypeDef[] = [];
  let cur: FillTypeDef | null = null;
  const done = () => {
    if (cur?.families.length) {
      if (cur.families.some((f) => f.spacing > 20)) cur.model = true;
      out.push(cur);
    }
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/;.*$/, '').trim();
    if (!line) continue;
    if (line.startsWith('*')) {
      done();
      const [name, desc] = line.slice(1).split(',');
      const n = name.trim();
      cur = { name: n || desc?.trim() || 'Fyllning', families: [] };
      continue;
    }
    if (!cur) continue;
    const v = line.split(',').map((s) => Number(s.trim()));
    if (v.length < 5 || v.slice(0, 5).some((x) => !Number.isFinite(x))) continue;
    const f = patFamily(v[0], v[1], v[2], v[3], v[4], v.slice(5).filter(Number.isFinite));
    if (f) cur.families.push(f);
  }
  done();
  return out;
}

/**
 * En linjefamilj ur `.pat`-filens tal (också DXF-skrafferingens): vinkel,
 * baspunkt, förskjutning längs och tvärs linjerna och strecken. Null om
 * linjerna inte har något avstånd.
 */
export function patFamily(angle: number, x: number, y: number, along: number, across: number, dashes: readonly number[]): FillFamily | null {
  // En negativ förskjutning tvärs linjerna är samma linjer åt andra hållet.
  const flip = across < 0 ? -1 : 1;
  const spacing = Math.abs(across);
  if (!(spacing > 1e-9)) return null;
  let d = [...dashes];
  let [bx, by] = [x, y];
  // Börjar streckningen med ett mellanrum flyttas det sist och baspunkten lika långt fram.
  const lead = d.findIndex((v) => v >= 0);
  if (lead > 0) {
    const g = d.slice(0, lead).reduce((s, v) => s - v, 0);
    const a = (angle * Math.PI) / 180;
    bx += g * Math.cos(a);
    by += g * Math.sin(a);
    d = [...d.slice(lead), ...d.slice(0, lead)];
  }
  return { angle, x: bx, y: by, spacing, shift: along * flip, dash: lead < 0 ? [] : patDash(d) };
}

/** `.pat`-strecken (positiva streck, negativa mellanrum, 0 punkt) som omväxlande streck och mellanrum. */
export function patDash(v: readonly number[]): number[] {
  if (!v.length) return [];
  const out: number[] = [];
  // Lika tecken i rad slås ihop (mönstret börjar med ett streck, se parsePat).
  for (const x of v) {
    const stroke = x >= 0;
    const len = Math.abs(x);
    const wantStroke = out.length % 2 === 0;
    if (stroke === wantStroke) out.push(len);
    else if (out.length) out[out.length - 1] += len;
  }
  // Två punkter i rad (0, 0) blir ett streck på 0 och ett mellanrum på 0, som ritas som en punkt.
  if (out.length % 2) out.push(0);
  // Ett mönster utan mellanrum är heldraget.
  return out.some((x, i) => i % 2 === 1 && x > 0) ? out : [];
}

/** Typerna som `.pat`-text, för att spara och dela. */
export function formatPat(types: readonly FillTypeDef[]): string {
  const n = (x: number) => String(Math.round(x * 10000) / 10000);
  return types
    .map((t) => {
      const head = `*${t.name.replace(/[,*\r\n]/g, ' ').trim() || 'Fyllning'}`;
      const rows = t.families.map((f) => {
        const dash = f.dash.map((d, i) => (i % 2 ? -d : d)).filter((d, i) => i % 2 === 0 || d !== 0);
        return [f.angle, f.x, f.y, f.shift, f.spacing, ...dash].map(n).join(', ');
      });
      return [head, ...rows].join('\n');
    })
    .join('\n') + '\n';
}

/** Fyllningen i stilmallen av en typ, med förvalda värden. */
export function typeFill(type: string, color: Color, weight = 0.18): FillDef {
  return { kind: 'type', type, color, weight };
}
