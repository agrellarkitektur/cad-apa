import type { Definition, Id } from './model';

/**
 * Räckestyperna (0.11.1): en typ är en lista med delar av fyra slag och en
 * lista med parametrar. Allt ligger i formatet från början (utredningen 30
 * oktober 2026, tavla 4), så att räckestypeditorn (0.11.2) och staketen och
 * grindarna (0.11.3) bara lägger till gränssnitt. Typen bor i en definition
 * (`Definition.railing`), med littera som andra typer (RÄ01 …).
 *
 * - *punkt*: stolpe, konsol, plint; står med jämn delning
 * - *längsgående*: handledare, liggare, bottenlist, ledstång, spänntråd
 * - *upprepad*: spjälor, ribbor; med en största öppning
 * - *yta*: glas, plåt, nät, spaljérutnät; mellan stolparna
 *
 * Måtten är tal (mm) eller formler med typens parametrar, t.ex.
 * `Skyddshöjd - 40`. Typen bestämmer vilka parametrar som får ändras per
 * räcke (`perRailing`); höjderna är kryssade som förval.
 */

/** Ett mått: mm, eller en formel med typens parametrar. */
export type RailNum = number | string;

export type RailPartKind = 'point' | 'along' | 'repeat' | 'surface';

export const PART_KIND_LABELS: Record<RailPartKind, string> = { point: 'Punkt', along: 'Längsgående', repeat: 'Upprepad', surface: 'Yta' };

/** Profilen för en stolpe, en liggare eller en spjäla: rektangel (bredd × höjd) eller rund (diameter). */
export interface RailProfile {
  shape: 'rect' | 'round';
  /** Bredd eller diameter, mm. */
  w: number;
  /** Höjd (rektangel), mm; utelämnad = som bredden. */
  h?: number;
}

export interface RailPart {
  id: string;
  kind: RailPartKind;
  name: string;
  profile?: RailProfile;
  /** Ytans tjocklek, mm. */
  thickness?: number;
  /** Stilbokens material; utelämnat = metall (glas för ytor). */
  material?: string;
  /** Längsgående: överkantens höjd över referenslinjen. */
  z?: RailNum;
  /** Punkt, upprepad och yta: underkant och överkant. */
  from?: RailNum;
  to?: RailNum;
  /** Läge i sidled från referenslinjen, mm; positivt inåt (mot trappan eller åt vänster). */
  offset?: RailNum;
  /** Punkt: största delning (jämnt fördelat). Upprepad: största öppning mellan delarna. */
  spacing?: RailNum;
  /** Längsgående: förlängning förbi början och slutet, och avslutet. */
  extend?: RailNum;
  finish?: 'down' | 'wall' | 'straight';
  /** Punkt och upprepad: står också i hörnen (förval för punkter). */
  corners?: boolean;
  /** I trappa: följer lutningen (förval) eller lodrät (spjälor står alltid lodrätt). */
  stair?: 'follow' | 'plumb';
  /** På sluttning (0.11.3): följer marken eller trappstegat. */
  slope?: 'follow' | 'stepped';
  /** Vid grind (0.11.3): avbryts (förval för längsgående) eller fortsätter. */
  gate?: 'break' | 'continue';
  /** Under mark (0.11.3, stolpar): nedgrävd längd eller plint. */
  below?: { depth?: RailNum; footing?: boolean };
  /** Lägsta detaljnivå delen ritas i planen; utelämnad = efter slaget (stolpar i Detalj). */
  detail?: 'sketch' | 'normal' | 'detail';
  /** Stilbokens ställe i planen; utelämnat = efter slaget. */
  pen?: string;
}

export interface RailParam {
  name: string;
  /** Värdet, eller en formel med de andra parametrarna. */
  value: RailNum;
  /** Får ändras på det enskilda räcket. */
  perRailing?: boolean;
}

export interface RailingTypeModel {
  /** Gruppen i typlistan: Räcken, Ledstänger, Staket … eller en egen. */
  group: string;
  /** Visas på Platsen (staket) och på våningarna, som materialen. */
  ground?: boolean;
  building?: boolean;
  /** Barnsäkert: varningarna för öppningar och klätterbarhet; på som förval, inte för staket. */
  childSafe?: boolean;
  /** Grindtypen nya grindar i räcket får (0.11.3); utelämnad = följer staketet. */
  gateType?: string;
  params: RailParam[];
  parts: RailPart[];
}

export const RAILING_GROUPS = ['Räcken', 'Ledstänger', 'Staket', 'Stängsel', 'Spaljéer', 'Grindar'] as const;

// ---------- Formler ----------

type Tok = { k: 'n'; v: number } | { k: 'id'; v: string } | { k: 'op'; v: string };

function tokens(src: string): Tok[] | null {
  const s = src.replace(/[−–]/g, '-').replace(/[×]/g, '*').replace(/[÷]/g, '/');
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const num = /^(\d+(?:[.,]\d+)?)/.exec(s.slice(i));
    if (num) {
      out.push({ k: 'n', v: Number(num[1].replace(',', '.')) });
      i += num[1].length;
      continue;
    }
    const id = /^([A-Za-zÅÄÖåäöÉé_][A-Za-zÅÄÖåäöÉé_0-9]*)/.exec(s.slice(i));
    if (id) {
      out.push({ k: 'id', v: id[1] });
      i += id[1].length;
      continue;
    }
    if ('+-*/()'.includes(c)) {
      out.push({ k: 'op', v: c });
      i++;
      continue;
    }
    return null;
  }
  return out;
}

/** En formel med namngivna värden; null om den inte går att räkna (okänt namn, fel i uttrycket). */
export function evalFormula(src: string, vars: (name: string) => number | undefined): number | null {
  const t = tokens(src);
  if (!t || !t.length) return null;
  let i = 0;
  const peek = () => t[i];
  const expr = (): number | null => {
    let a = term();
    while (a !== null && peek()?.k === 'op' && (peek()!.v === '+' || peek()!.v === '-')) {
      const op = t[i++].v;
      const b = term();
      if (b === null) return null;
      a = op === '+' ? a + b : a - b;
    }
    return a;
  };
  const term = (): number | null => {
    let a = unary();
    while (a !== null && peek()?.k === 'op' && (peek()!.v === '*' || peek()!.v === '/')) {
      const op = t[i++].v;
      const b = unary();
      if (b === null || (op === '/' && b === 0)) return null;
      a = op === '*' ? a * b : a / b;
    }
    return a;
  };
  const unary = (): number | null => {
    const q = peek();
    if (q?.k === 'op' && q.v === '-') {
      i++;
      const v = unary();
      return v === null ? null : -v;
    }
    if (q?.k === 'op' && q.v === '(') {
      i++;
      const v = expr();
      if (peek()?.k !== 'op' || peek()!.v !== ')') return null;
      i++;
      return v;
    }
    if (q?.k === 'n') {
      i++;
      return q.v;
    }
    if (q?.k === 'id') {
      i++;
      const v = vars(q.v);
      return v === undefined ? null : v;
    }
    return null;
  };
  const v = expr();
  return v !== null && i === t.length && Number.isFinite(v) ? v : null;
}

/**
 * Typens parametrar som tal, med räckets egna värden för dem som får ändras
 * per räcke. Formler räknas i den ordning de behövs; en formel som pekar på
 * sig själv eller på ett okänt namn ger 0.
 */
export function railValues(model: RailingTypeModel, own?: Record<string, number>): Map<string, number> {
  const byName = new Map(model.params.map((p) => [p.name, p]));
  const out = new Map<string, number>();
  const busy = new Set<string>();
  const get = (name: string): number | undefined => {
    if (out.has(name)) return out.get(name);
    const p = byName.get(name);
    if (!p || busy.has(name)) return undefined;
    busy.add(name);
    const mine = p.perRailing ? own?.[name] : undefined;
    const v = typeof mine === 'number' && Number.isFinite(mine) ? mine : typeof p.value === 'number' ? p.value : evalFormula(p.value, get) ?? 0;
    busy.delete(name);
    out.set(name, v);
    return v;
  };
  for (const p of model.params) get(p.name);
  return out;
}

/** Ett mått som tal: talet, eller formeln räknad med parametrarna. */
export function railNum(v: RailNum | undefined, vals: ReadonlyMap<string, number>, fallback = 0): number {
  if (v === undefined || v === '') return fallback;
  if (typeof v === 'number') return v;
  const n = evalFormula(v, (name) => vals.get(name));
  return n ?? fallback;
}

// ---------- Typerna i ett nytt projekt ----------

const post = (id: string, to: RailNum, spacing: RailNum, w = 40): RailPart => ({ id, kind: 'point', name: 'Stolpe', profile: { shape: 'rect', w }, from: 0, to, spacing, corners: true, detail: 'detail', pen: 'railPost' });

/**
 * De förvalda räckestyperna (fasta id, så att ett projekt får dem en gång):
 * räcke med spjälor och ledstång, glasräcke och vägghängd ledstång.
 */
export function defaultRailingTypes(): Definition[] {
  const def = (id: Id, name: string, description: string, railing: RailingTypeModel): Definition => ({ id, origin: 'component', name, description, elementType: 'Railing', params: {}, props: {}, railing });
  return [
    def('t-ra01', 'RÄ01', 'Räcke med spjälor och ledstång', {
      group: 'Räcken',
      building: true,
      childSafe: true,
      params: [
        { name: 'Skyddshöjd', value: 900, perRailing: true },
        { name: 'Ledstångshöjd', value: 'Skyddshöjd - 40', perRailing: true },
        { name: 'Förlängning', value: 300, perRailing: true },
        { name: 'Stolpdelning', value: 1200 },
        { name: 'Spjälöppning', value: 90 },
      ],
      parts: [
        post('stolpe', 'Skyddshöjd - 40', 'Stolpdelning'),
        { id: 'handledare', kind: 'along', name: 'Handledare', profile: { shape: 'rect', w: 50, h: 40 }, z: 'Skyddshöjd', pen: 'railHandrail' },
        { id: 'bottenliggare', kind: 'along', name: 'Bottenliggare', profile: { shape: 'rect', w: 40, h: 20 }, z: 60, detail: 'detail' },
        { id: 'spjalor', kind: 'repeat', name: 'Spjälor', profile: { shape: 'rect', w: 20 }, from: 60, to: 'Skyddshöjd - 40', spacing: 'Spjälöppning', stair: 'plumb', detail: 'detail' },
        { id: 'ledstang', kind: 'along', name: 'Ledstång', profile: { shape: 'round', w: 40 }, z: 'Ledstångshöjd', offset: 70, extend: 'Förlängning', finish: 'down', pen: 'railGrab' },
      ],
    }),
    def('t-ra02', 'RÄ02', 'Glasräcke med handledare', {
      group: 'Räcken',
      building: true,
      childSafe: true,
      params: [
        { name: 'Skyddshöjd', value: 900, perRailing: true },
        { name: 'Stolpdelning', value: 1000 },
      ],
      parts: [
        post('stolpe', 'Skyddshöjd - 40', 'Stolpdelning'),
        { id: 'handledare', kind: 'along', name: 'Handledare', profile: { shape: 'rect', w: 50, h: 40 }, z: 'Skyddshöjd', pen: 'railHandrail' },
        { id: 'glas', kind: 'surface', name: 'Glas', thickness: 10, from: 40, to: 'Skyddshöjd - 60', detail: 'detail' },
      ],
    }),
    def('t-ra03', 'RÄ03', 'Ledstång på väggen', {
      group: 'Ledstänger',
      building: true,
      params: [
        { name: 'Ledstångshöjd', value: 900, perRailing: true },
        { name: 'Förlängning', value: 300, perRailing: true },
        { name: 'Konsoldelning', value: 1000 },
      ],
      parts: [
        { id: 'ledstang', kind: 'along', name: 'Ledstång', profile: { shape: 'round', w: 40 }, z: 'Ledstångshöjd', offset: 60, extend: 'Förlängning', finish: 'wall', pen: 'railGrab' },
        { id: 'konsol', kind: 'point', name: 'Konsol', profile: { shape: 'round', w: 14 }, from: 'Ledstångshöjd - 90', to: 'Ledstångshöjd - 40', offset: 60, spacing: 'Konsoldelning', detail: 'detail', pen: 'railPost' },
      ],
    }),
  ];
}

/**
 * Staketen, spaljén och grinden (0.11.3, tavla 5), som läggs i projektet
 * första gången ett räcke läggs på Platsen och med knappen i editorn.
 */
export function defaultGroundRailingTypes(): Definition[] {
  const def = (id: Id, name: string, description: string, railing: RailingTypeModel): Definition => ({ id, origin: 'component', name, description, elementType: 'Railing', params: {}, props: {}, railing });
  const buried = { depth: 600 };
  return [
    def('t-st01', 'ST01', 'Spjälstaket', {
      group: 'Staket',
      ground: true,
      params: [
        { name: 'Höjd', value: 1000, perRailing: true },
        { name: 'Stolpdelning', value: 1800 },
        { name: 'Spjälöppning', value: 30 },
      ],
      parts: [
        { id: 'stolpe', kind: 'point', name: 'Stolpe', profile: { shape: 'rect', w: 70 }, material: 'trall', from: 0, to: 'Höjd', spacing: 'Stolpdelning', corners: true, slope: 'stepped', below: buried, detail: 'normal', pen: 'railPost' },
        { id: 'overliggare', kind: 'along', name: 'Överliggare', profile: { shape: 'rect', w: 45, h: 70 }, material: 'trall', z: 'Höjd - 150', offset: -35, slope: 'stepped', pen: 'railHandrail' },
        { id: 'underliggare', kind: 'along', name: 'Underliggare', profile: { shape: 'rect', w: 45, h: 70 }, material: 'trall', z: 320, offset: -35, slope: 'stepped', detail: 'detail' },
        { id: 'spjalor', kind: 'repeat', name: 'Spjälor', profile: { shape: 'rect', w: 70, h: 22 }, material: 'trall', from: 100, to: 'Höjd', spacing: 'Spjälöppning', offset: -70, slope: 'stepped', detail: 'detail' },
      ],
    }),
    def('t-st02', 'ST02', 'Ribbstaket', {
      group: 'Staket',
      ground: true,
      params: [
        { name: 'Höjd', value: 1000, perRailing: true },
        { name: 'Stolpdelning', value: 1800 },
      ],
      parts: [
        { id: 'stolpe', kind: 'point', name: 'Stolpe', profile: { shape: 'rect', w: 70 }, material: 'trall', from: 0, to: 'Höjd', spacing: 'Stolpdelning', corners: true, below: buried, detail: 'normal', pen: 'railPost' },
        ...[0, 1, 2, 3, 4, 5].map((k): RailPart => ({ id: `ribba-${k + 1}`, kind: 'along', name: `Ribba ${k + 1}`, profile: { shape: 'rect', w: 22, h: 95 }, material: 'trall', z: k ? `Höjd - ${k * 150}` : 'Höjd', offset: -46, ...(k ? { detail: 'detail' as const } : { pen: 'railHandrail' }) })),
      ],
    }),
    def('t-st03', 'ST03', 'Flätverk 1 200', {
      group: 'Stängsel',
      ground: true,
      params: [
        { name: 'Höjd', value: 1200, perRailing: true },
        { name: 'Stolpdelning', value: 2500 },
      ],
      parts: [
        { id: 'stolpe', kind: 'point', name: 'Stolpe', profile: { shape: 'round', w: 48 }, from: 0, to: 'Höjd', spacing: 'Stolpdelning', corners: true, below: { footing: true }, detail: 'normal', pen: 'railPost' },
        { id: 'trad-1', kind: 'along', name: 'Spänntråd överst', profile: { shape: 'round', w: 4 }, z: 'Höjd', pen: 'railHandrail' },
        { id: 'trad-2', kind: 'along', name: 'Spänntråd mitt', profile: { shape: 'round', w: 4 }, z: 'Höjd / 2', detail: 'detail' },
        { id: 'trad-3', kind: 'along', name: 'Spänntråd nederst', profile: { shape: 'round', w: 4 }, z: 54, detail: 'detail' },
        { id: 'nat', kind: 'surface', name: 'Nät (flätverk 50 × 50)', thickness: 3, material: 'aluminium', from: 50, to: 'Höjd', gate: 'break', detail: 'detail' },
      ],
    }),
    def('t-sp01', 'SP01', 'Spaljé, rutnät', {
      group: 'Spaljéer',
      ground: true,
      building: true,
      params: [
        { name: 'Höjd', value: 1800, perRailing: true },
        { name: 'Stolpdelning', value: 2400 },
      ],
      parts: [
        { id: 'stolpe', kind: 'point', name: 'Stolpe', profile: { shape: 'rect', w: 90 }, material: 'trall', from: 0, to: 'Höjd', spacing: 'Stolpdelning', corners: true, below: buried, detail: 'normal', pen: 'railPost' },
        { id: 'ram-over', kind: 'along', name: 'Ram överst', profile: { shape: 'rect', w: 45, h: 45 }, material: 'trall', z: 'Höjd', pen: 'railHandrail' },
        { id: 'ram-under', kind: 'along', name: 'Ram nederst', profile: { shape: 'rect', w: 45, h: 45 }, material: 'trall', z: 300, detail: 'detail' },
        { id: 'rutnat', kind: 'surface', name: 'Ribbor 45°, c/c 150', thickness: 20, material: 'trall', from: 255, to: 'Höjd - 45', detail: 'detail' },
      ],
    }),
    def('t-g01', 'G01', 'Spjälgrind', {
      group: 'Grindar',
      ground: true,
      params: [
        { name: 'Höjd', value: 1000, perRailing: true },
        { name: 'Spjälöppning', value: 30 },
      ],
      parts: [
        { id: 'sidstycke', kind: 'point', name: 'Sidstycke', profile: { shape: 'rect', w: 45, h: 70 }, material: 'trall', from: 50, to: 'Höjd', corners: false, detail: 'detail', pen: 'railPost' },
        { id: 'overliggare', kind: 'along', name: 'Överliggare', profile: { shape: 'rect', w: 45, h: 70 }, material: 'trall', z: 'Höjd - 150', offset: -35 },
        { id: 'underliggare', kind: 'along', name: 'Underliggare', profile: { shape: 'rect', w: 45, h: 70 }, material: 'trall', z: 320, offset: -35, detail: 'detail' },
        { id: 'spjalor', kind: 'repeat', name: 'Spjälor', profile: { shape: 'rect', w: 70, h: 22 }, material: 'trall', from: 100, to: 'Höjd', spacing: 'Spjälöppning', offset: -70, detail: 'detail' },
      ],
    }),
  ];
}

/** Räckestypen för en definition, eller undefined. */
export const railingModel = (def: Definition | undefined): RailingTypeModel | undefined => (def?.elementType === 'Railing' ? def.railing : undefined);

/** Ett nytt id för en del, unikt i typen. */
export function newPartId(model: RailingTypeModel, base: string): string {
  const slug = base.toLowerCase().replace(/[åä]/g, 'a').replace(/ö/g, 'o').replace(/[^a-z0-9]+/g, '-') || 'del';
  const ids = new Set(model.parts.map((p) => p.id));
  let id = slug;
  for (let n = 2; ids.has(id); n++) id = `${slug}-${n}`;
  return id;
}

/** En ny del av ett slag, med rimliga förval. */
export function newPart(model: RailingTypeModel, kind: RailPartKind): RailPart {
  const top = model.params.some((p) => p.name === 'Skyddshöjd') ? 'Skyddshöjd' : model.params[0]?.name ?? 900;
  switch (kind) {
    case 'point':
      return { id: newPartId(model, 'stolpe'), kind, name: 'Stolpe', profile: { shape: 'rect', w: 40 }, from: 0, to: top, spacing: 1200, corners: true, detail: 'detail', pen: 'railPost' };
    case 'along':
      return { id: newPartId(model, 'liggare'), kind, name: 'Liggare', profile: { shape: 'rect', w: 40, h: 20 }, z: 400, detail: 'detail' };
    case 'repeat':
      return { id: newPartId(model, 'spjalor'), kind, name: 'Spjälor', profile: { shape: 'rect', w: 20 }, from: 60, to: top, spacing: 90, stair: 'plumb', detail: 'detail' };
    case 'surface':
      return { id: newPartId(model, 'fyllning'), kind, name: 'Fyllning', thickness: 10, from: 40, to: top, detail: 'detail' };
  }
}
