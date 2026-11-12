import type { Element, Id, ProjectDoc } from '../core/model';
import { buildingStoreys, isSite } from '../core/model';
import { DERIVED_FIELDS, fieldValue, scheduleFields, type ScheduleKind } from '../core/openingSchedule';
import { layoutOpening, OP_LABEL } from '../core/openingTypes';
import { DEFAULT_FIGURE_SCALE, isLitteraLayout, isNumberField, scheduleOf, type Schedule, type ScheduleSource } from '../core/schedules';
import { actionOf, defaultState, existingState, type Action } from '../core/states';
import { defaultSheet } from '../core/viewCategories';
import { glassPanes, roomDaylight, shareText, type GlassPane } from '../elements/daylight';
import { labelObjects, labelValue, labelLines } from '../elements/label';
import { litteraField, ownProp } from '../elements/littera';
import { openingHinges, openingLitteras, openingMirrored } from '../elements/openingLittera';
import { openingModelOf, type OpeningObjParams } from '../elements/openingSpec';
import { openingFigure, type OpeningFigure } from './openingFigure';
import type { PlanContext } from '../elements/registry';
import { spaceOutline, roomNumbersFor, type SpaceParams } from '../elements/rooms';
import { areaOf } from '../elements/space';
import { createContext } from './context';
import { columnName, writeXlsx, type XlsxCell, type XlsxSheet } from '../formats/xlsxWrite';
import { AREA_KINDS, BRA_KINDS, COMPUTED_KINDS, areaParts, areaRegion, btaParts, byaRegion, groundStorey, ringsArea, roundArea, type AreaParams, type AreaPart } from '../elements/areaCalc';

/**
 * Förteckningens rader (0.12.2), räknade ur modellen: en rad per objekt
 * (eller per littera), med kolumnerna som text och, för tal, värdet som
 * summeras. Tabellen ritas av `scheduleTable.ts` och skrivs som CSV av
 * `scheduleCsv`.
 */

export interface Cell {
  /** Texten i rutan; tom ritas som `-`. */
  text: string;
  /** Talet för summan (bara kolumner med tal). */
  value?: number;
}

export interface ScheduleGroup {
  /** Gruppens rubrik; utelämnad när förteckningen inte grupperas. */
  label?: string;
  rows: Cell[][];
  /** Delsumman, när förteckningen grupperas och har kolumner som summeras. */
  sums?: Cell[];
}

export interface ScheduleTable {
  name: string;
  columns: { title: string; number: boolean; sum: boolean }[];
  groups: ScheduleGroup[];
  /** Summaraden, när någon kolumn summeras. */
  total?: Cell[];
  /** Antal rader (utan rubriker och summor). */
  count: number;
  /** Uppställd per littera (0.12.5): kolumnerna är litteror och raderna fält; se `LitteraInfo`. */
  littera?: LitteraInfo;
}

/** En kolumn i förteckningen per littera: litteran, objekten som har den och ritningen. */
export interface LitteraColumn {
  littera: string;
  ids: Id[];
  figure?: OpeningFigure;
}

/**
 * Det förteckningen per littera har utöver tabellen (0.12.5). Tabellens
 * första kolumn är fältens namn och resten litterorna, så att CSV och XLSX
 * skrivs som vanligt; här står vilka objekt en kolumn gäller, vilka rader
 * som går att skriva i, ritningarna och föreskrifterna till höger.
 */
export interface LitteraInfo {
  kind: ScheduleKind;
  /** Radernas fält, i tabellens ordning. */
  fields: string[];
  /** Raderna som fylls i per objekt (inte räknas fram). */
  own: boolean[];
  columns: LitteraColumn[];
  /** Ritningens skala (nämnaren); 0 = ingen ritning. */
  figureScale: number;
  /** Föreskrifterna: projektets egna rader och typernas, med litterorna de gäller. */
  notes: string[];
}

/** Enheten i rubriken för fälten med tal. */
const UNITS: Record<string, string> = { Area: 'm²', Omkrets: 'm', Rumshöjd: 'mm', Glasarea: 'm²', Bröstningshöjd: 'mm', Bredd: 'mm', Höjd: 'mm' };

/** Kolumnens rubrik: den egna, eller fältets namn med enheten (*Area, m²*). */
export const columnTitle = (c: { field: string; title?: string }): string => c.title?.trim() || (UNITS[c.field] ? `${c.field}, ${UNITS[c.field]}` : c.field);

const nf = (d: number) => new Intl.NumberFormat('sv-SE', { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: true });
const STATUS: Partial<Record<Action, string>> = { new: 'Nytt', existing: 'Befintligt', demolished: 'Rivs' };

/** Ett objekt med det som behövs för att läsa dess fält. */
interface Item {
  el: Element;
  ctx: PlanContext;
  /** En framräknad area (0.12.3): BYA, BTA eller BRA på våningen, i m² med en decimal, och beteckningen (BTA(o) …). */
  gen?: { kind: string; value: number; code?: string };
  /** Areaobjektets del (0.12.4): BIA(u) bortom 6-meterszonen, BOA:L under 2,10 m … */
  part?: AreaPart;
}

/** Det som räknas en gång för hela förteckningen. */
interface Shared {
  doc: ProjectDoc;
  state: Id;
  compareTo?: Id;
  decimals: number;
  panes: () => GlassPane[];
  litteras: () => Map<Id, string>;
  hinges: () => Map<Id, string>;
  storeyName: (id: Id) => string;
}

/** Objektens fält i en källa ('' när det saknas). Tal har också sitt värde. */
function cellOf(src: ScheduleSource, field: string, it: Item, sh: Shared): Cell {
  const { el, ctx } = it;
  const doc = sh.doc;
  const mm = (v: unknown): Cell => (typeof v === 'number' && Number.isFinite(v) ? { text: nf(0).format(Math.round(v)), value: Math.round(v) } : { text: '' });
  if (field === 'Våning') return { text: sh.storeyName(el.storey) };
  if (field === 'Status') return { text: STATUS[actionOf(el, { state: sh.state, compareTo: sh.compareTo })] ?? '' };
  switch (src) {
    case 'Space': {
      const p = ctx.params<SpaceParams>(el);
      const pts = (): ReturnType<typeof spaceOutline> => ctx.memo(`outline:${el.id}`, () => spaceOutline(ctx, el as unknown as Element<SpaceParams>));
      switch (field) {
        case 'Nummer':
          return { text: p.number ?? roomNumbersFor(ctx).get(el.id) ?? '' };
        case 'Namn':
          return { text: el.name ?? '' };
        case 'Area': {
          const o = pts();
          if (o.length < 3) return { text: '' };
          const a = areaOf(o);
          return { text: nf(sh.decimals).format(a), value: Number(a.toFixed(sh.decimals)) };
        }
        case 'Omkrets': {
          const o = pts();
          if (o.length < 3) return { text: '' };
          let l = 0;
          for (let i = 0; i < o.length; i++) l += Math.hypot(o[(i + 1) % o.length][0] - o[i][0], o[(i + 1) % o.length][1] - o[i][1]);
          return { text: nf(1).format(l / 1000), value: Number((l / 1000).toFixed(1)) };
        }
        case 'Rumshöjd':
          return mm(p.ceilingHeight);
        case 'Dagsljus':
        case 'Glasarea': {
          const o = pts();
          if (o.length < 3) return { text: '' };
          const d = roomDaylight(sh.panes(), el.storey, o, areaOf(o));
          return field === 'Dagsljus' ? { text: shareText(d) } : { text: nf(1).format(d.glass), value: Number(d.glass.toFixed(1)) };
        }
      }
      return { text: ownProp([el.props], field) };
    }
    case 'Area': {
      const g = it.gen;
      const p = g ? null : ctx.params<AreaParams>(el);
      const part = it.part ?? (g ? undefined : areaParts(ctx, el)[0]);
      switch (field) {
        case 'Areaslag':
          return { text: g?.kind ?? part!.kind };
        case 'Beteckning':
          return { text: g ? (g.code ?? g.kind) : part!.code };
        case 'Funktion':
          return { text: p?.func?.trim() ?? '' };
        case 'Area': {
          const v = g ? g.value : roundArea(ringsArea(part!.region), 1);
          return { text: nf(1).format(v), value: v };
        }
      }
      return g ? { text: '' } : { text: ownProp([el.props], field) };
    }
    case 'Door':
    case 'Window': {
      const p = ctx.params<OpeningObjParams>(el);
      const def = el.definition ? doc.definitions[el.definition] : undefined;
      const pair = (a: unknown, b: unknown) => (typeof a === 'number' && typeof b === 'number' ? `${Math.round(a)}×${Math.round(b)}` : '');
      switch (field) {
        case 'Littera':
          return { text: sh.litteras().get(el.id) ?? '' };
        case 'Antal':
          return { text: '1', value: 1 };
        case 'Nummer':
          return { text: litteraField(ctx, el, 'nummer') };
        case 'Typ':
          return { text: def?.name ?? '' };
        case 'Beskrivning':
          return { text: def?.description ?? '' };
        case 'Modulmått':
          return { text: typeof p.width === 'number' ? `${Math.round(p.width / 100)}×${Math.round(p.height / 100)}` : '' };
        case 'Karmyttermått':
          return { text: pair(p.frameW, p.frameH) };
        case 'Hålmått':
          return { text: pair(p.holeW, p.holeH) };
        case 'Hängning':
          return { text: sh.hinges().get(el.id) ?? '' };
        case 'Bröstningshöjd':
          return p.floor ? { text: '' } : mm(p.sill);
      }
      const derived = derivedOpening(field, it, sh);
      if (derived !== null) return derived;
      return { text: fieldValue(el, field) || litteraField(ctx, el, field) };
    }
    case 'Label':
      switch (field) {
        case 'Nummer':
          return { text: labelValue(ctx, el, 'nr') };
        case 'Sort':
          return { text: labelValue(ctx, el, 'sort') };
        case 'Text':
          return { text: labelLines(ctx, el).filter(Boolean).join(' ') };
        case 'Antal objekt': {
          const n = labelObjects(doc, el).length;
          return { text: String(n), value: n };
        }
      }
      return { text: labelValue(ctx, el, field) };
  }
}

const DOOR_OP: Record<string, string> = { leaf: 'Slagdörr', fixed: 'Fast parti' };

/**
 * Fältmallens fält som räknas fram ur typen eller läget (0.12.5):
 * öppningssätt, utförande (typens namn), hålets mått, poster, spröjs,
 * karmdjup och väggens tjocklek. Null för andra fält.
 */
function derivedOpening(field: string, it: Item, sh: Shared): Cell | null {
  if (!DERIVED_FIELDS.has(field)) return null;
  const { el, ctx } = it;
  const p = ctx.params<OpeningObjParams>(el);
  const m = openingModelOf(sh.doc, el);
  // Mått i mm utan tusentalsavgränsare, som karmyttermåttet (990×2090).
  const mm = (v: unknown): Cell => (typeof v === 'number' && Number.isFinite(v) ? { text: String(Math.round(v)) } : { text: '' });
  const uniq = (list: string[]) => [...new Set(list.filter(Boolean))].join(', ');
  switch (field) {
    case 'Utförande':
      return { text: (el.definition ? sh.doc.definitions[el.definition]?.name : undefined) ?? '' };
    case 'Öppningssätt': {
      const cells = typeof p.frameW === 'number' ? layoutOpening(m, p.frameW, p.frameH).cells : m.cells;
      const ops = cells.map((c) => (el.type === 'Door' ? (DOOR_OP[c.op] ?? OP_LABEL[c.op]) : OP_LABEL[c.op]));
      // Ett fast sidoljus i en dörr nämns sist; ett fönster med bara fasta lufter är *Fast*.
      return { text: uniq([...ops.filter((o) => !o.startsWith('Fast')), ...ops.filter((o) => o.startsWith('Fast'))]) };
    }
    case 'Öppningsbredd':
      return mm(p.holeW);
    case 'Öppningshöjd':
      return mm(p.holeH);
    case 'Poster': {
      const v = m.mullion > 0 ? m.cols.length - 1 : 0;
      const h = m.transom > 0 ? m.rows.length - 1 : 0;
      return { text: [v ? `${v} ${v === 1 ? 'lodrät' : 'lodräta'}` : '', h ? `${h} ${h === 1 ? 'vågrät' : 'vågräta'}` : ''].filter(Boolean).join(', ') };
    }
    case 'Spröjs':
      return {
        text: uniq(
          m.cells.map((c) => {
            const mu = c.muntins;
            if (!mu) return '';
            const kind = { loose: 'Löstagbar', between: 'Mellan glasen', fixed: 'Fast' }[mu.kind];
            return mu.lines?.length ? `${kind}, ritad` : mu.v || mu.h ? `${kind} ${mu.v}+${mu.h}` : '';
          }),
        ),
      };
    case 'Karmdjup':
      return mm(p.frameDepth);
    case 'Väggtjocklek': {
      const host = el.host ? sh.doc.elements[el.host] : undefined;
      return host ? mm(ctx.params<{ thickness?: number }>(host).thickness) : { text: '' };
    }
  }
  return null;
}

/** Litterorna som ett spann där numren följer på varandra: F01–F03, F05. */
export function litteraRange(list: readonly string[]): string {
  const parts = list.map((l) => {
    const m = /^(.*?)(\d+)$/.exec(l);
    return m ? { l, pre: m[1], n: Number(m[2]) } : { l, pre: null as string | null, n: 0 };
  });
  const out: string[] = [];
  for (let i = 0; i < parts.length; ) {
    let j = i;
    while (parts[i].pre !== null && j + 1 < parts.length && parts[j + 1].pre === parts[i].pre && parts[j + 1].n === parts[j].n + 1) j++;
    out.push(j > i ? `${parts[i].l}–${parts[j].l}` : parts[i].l);
    i = j + 1;
  }
  return out.join(', ');
}

/**
 * Förteckningen uppställd per littera (0.12.5), som A-42-5-101 och -102:
 * fältmallens fält som rader och en kolumn per littera. Lika värden står
 * som de är, *Antal* räknas, hängningen räknas upp (*2 V, 1 H*) när
 * litteran delas, och det som skiljer sig blir *Olika*.
 */
function litteraTable(doc: ProjectDoc, s: Schedule, items: readonly Item[], sh: Shared): ScheduleTable {
  const kind = s.source as ScheduleKind;
  const litteras = sh.litteras();
  const by = new Map<string, Item[]>();
  for (const it of items) {
    const l = litteras.get(it.el.id) ?? '';
    const list = by.get(l);
    if (list) list.push(it);
    else by.set(l, [it]);
  }
  const keys = [...by.keys()].sort(cmpText);
  const all = scheduleFields(doc, kind);
  const cellFor = (field: string, list: Item[]): Cell => {
    if (field === 'Antal') return { text: String(list.length), value: list.length };
    const texts = list.map((it) => cellOf(s.source, field, it, sh).text);
    const uniq = [...new Set(texts)];
    if (uniq.length === 1) return { text: uniq[0] };
    if (field === 'Hängning') return { text: uniq.filter(Boolean).sort(cmpText).map((h) => `${texts.filter((t) => t === h).length} ${h}`).join(', ') };
    return { text: 'Olika' };
  };
  let rows = all.map((f) => ({ field: f, cells: keys.map((k) => cellFor(f, by.get(k)!)) }));
  if (s.hideEmpty) rows = rows.filter((r) => r.cells.some((c) => c.text));
  const figureScale = s.noFigure ? 0 : (s.figureScale ?? DEFAULT_FIGURE_SCALE);
  const mirrored = openingMirrored(doc);
  const columns: LitteraColumn[] = keys.map((k) => {
    const list = by.get(k)!;
    const { el, ctx } = list[0];
    const p = ctx.params<OpeningObjParams>(el);
    return {
      littera: k,
      ids: list.map((it) => it.el.id),
      ...(figureScale && typeof p.frameW === 'number' ? { figure: openingFigure(openingModelOf(doc, el), p.frameW, p.frameH, mirrored.has(el.id)) } : {}),
    };
  });
  // Föreskrifterna: projektets egna rader, sedan typernas med sina litteror.
  const notes = (doc.project.openingSchedule?.notes?.[kind] ?? '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  const specs = new Map<string, string[]>();
  for (const k of keys) {
    const spec = [...new Set(by.get(k)!.map((it) => openingModelOf(doc, it.el).spec?.trim() ?? '').filter(Boolean))];
    for (const sp of spec) specs.set(sp, [...(specs.get(sp) ?? []), k]);
  }
  for (const [spec, list] of specs) notes.push(`${litteraRange(list.filter(Boolean))}: ${spec}`.replace(/^: /, ''));
  return {
    name: s.name,
    columns: [{ title: 'Littera', number: false, sum: false }, ...keys.map((k) => ({ title: k || '(utan littera)', number: false, sum: false }))],
    groups: [{ rows: rows.map((r) => [{ text: r.field }, ...r.cells]) }],
    count: keys.length,
    littera: { kind, fields: rows.map((r) => r.field), own: rows.map((r) => !DERIVED_FIELDS.has(r.field)), columns, figureScale, notes },
  };
}

/** Objekten förteckningen räknar: källans sort i tillståndet, på de valda våningarna. */
function itemsOf(doc: ProjectDoc, s: Schedule, state: Id, ctxFor: (storey: Id) => PlanContext): Item[] {
  const sheets = new Set(doc.sheets.map((x) => x.id));
  const storeys = s.storeys?.length ? new Set(s.storeys) : null;
  const type = s.source;
  const out: Item[] = [];
  for (const el of Object.values(doc.elements)) {
    if (el.type !== type) continue;
    if (el.space && sheets.has(el.space)) continue;
    if (storeys && !storeys.has(el.storey)) continue;
    // Littera följer inte alltid tillstånden (de saknar dem då); rummen och öppningarna gör det.
    if (!el.states.includes(state) && !(s.source === 'Label' && !el.states.length)) continue;
    if (s.source === 'Label' && s.labelSort && (el.params as { sort?: string }).sort?.trim().toLowerCase() !== s.labelSort.trim().toLowerCase()) continue;
    // BTA- och BYA-objekten visar bara konturen; areorna räknas fram nedan.
    if (s.source === 'Area' && COMPUTED_KINDS.includes((el.params as unknown as AreaParams).kind)) continue;
    if (s.source === 'Area') {
      // En rad per del (0.12.4): BOA och BIA(u), BOA:H och BOA:L …
      const ctx = ctxFor(el.storey);
      for (const part of areaParts(ctx, el)) out.push({ el, ctx, part });
      continue;
    }
    out.push({ el, ctx: ctxFor(el.storey) });
  }
  if (s.source === 'Area') out.push(...computedAreas(doc, out, storeys, ctxFor));
  return out;
}

/**
 * De framräknade areorna (0.12.3): BYA på markplanet, BTA på varje våning,
 * och BRA som summan av våningens BOA, BIA, LOA och ÖVA (9).
 */
function computedAreas(doc: ProjectDoc, items: readonly Item[], storeys: Set<Id> | null, ctxFor: (storey: Id) => PlanContext): Item[] {
  const out: Item[] = [];
  const ground = groundStorey(doc);
  for (const st of buildingStoreys(doc)) {
    if (storeys && !storeys.has(st.id)) continue;
    const ctx = ctxFor(st.id);
    const el = { id: `gen:${st.id}`, type: 'Area', storey: st.id, states: [], tags: [], props: {}, params: {} } as Element;
    if (st.id === ground) {
      const bya = roundArea(ringsArea(byaRegion(ctx)), 1);
      if (bya > 0) out.push({ el, ctx, gen: { kind: 'BYA', value: bya } });
    }
    // BTA(o) och BTA(u) på en våning delvis under mark (0.12.4).
    for (const b of btaParts(ctx)) {
      const bta = roundArea(ringsArea(b.region), 1);
      if (bta > 0) out.push({ el, ctx, gen: { kind: 'BTA', value: bta, code: b.code } });
    }
    const counted = new Set<string>();
    const bra = items
      .filter((i) => !i.gen && i.el.storey === st.id && BRA_KINDS.includes((i.el.params as unknown as AreaParams).kind) && !counted.has(i.el.id) && counted.add(i.el.id))
      .reduce((a, i) => a + ringsArea(areaRegion(i.ctx, i.el)), 0);
    if (bra > 0) out.push({ el, ctx, gen: { kind: 'BRA', value: roundArea(bra, 1) } });
  }
  return out;
}

/** Areaslagen i redovisningens ordning: BYA, BTA, BRA och dess underindelningar, OPA. */
const AREA_ORDER = ['BYA', 'BTA', 'BRA', ...AREA_KINDS.filter((k) => k !== 'BYA' && k !== 'BTA')];

/** Areorna med samma slag, beteckning, funktion och våning blir en rad med arean summerad. */
function mergeAreas(rows: Cell[][], fields: string[]): Cell[][] {
  const keys = ['Areaslag', 'Beteckning', 'Funktion', 'Våning'].map((f) => fields.indexOf(f));
  const ai = fields.indexOf('Area');
  const by = new Map<string, Cell[][]>();
  for (const r of rows) {
    const k = keys.map((i) => (i < 0 ? '' : r[i].text)).join('|');
    const l = by.get(k);
    if (l) l.push(r);
    else by.set(k, [r]);
  }
  return [...by.values()].map((list) =>
    fields.map((_f, i) => {
      if (i === ai) {
        const v = roundArea(list.reduce((a, r) => a + (r[i].value ?? 0), 0), 1);
        return { text: nf(1).format(v), value: v };
      }
      const texts = [...new Set(list.map((c) => c[i].text))];
      return texts.length === 1 ? list[0][i] : { text: 'Olika' };
    }),
  );
}

const orderOf = (k: string) => {
  const i = AREA_ORDER.indexOf(k);
  return i < 0 ? 99 : i;
};

const cmpText = (a: string, b: string) => a.localeCompare(b, 'sv', { numeric: true, sensitivity: 'base' });

/**
 * Raderna slås ihop per littera: *Antal* räknas, lika värden står kvar,
 * våningarna räknas upp, och det som skiljer sig blir *Olika*.
 */
function mergeByLittera(rows: { cells: Cell[]; key: string }[], fields: string[]): Cell[][] {
  const by = new Map<string, Cell[][]>();
  for (const r of rows) {
    const l = by.get(r.key);
    if (l) l.push(r.cells);
    else by.set(r.key, [r.cells]);
  }
  return [...by.values()].map((list) =>
    fields.map((f, i) => {
      if (f === 'Antal') return { text: String(list.length), value: list.length };
      const texts = [...new Set(list.map((c) => c[i].text))];
      if (texts.length === 1) return list[0][i];
      if (f === 'Våning' || f === 'Nummer') return { text: texts.filter(Boolean).sort(cmpText).join(', ') };
      return { text: 'Olika' };
    }),
  );
}

function sumRow(rows: readonly Cell[][], sums: readonly boolean[], decimals: (i: number) => number): Cell[] {
  return sums.map((on, i) => {
    if (!on) return { text: '' };
    const v = Number(rows.reduce((a, r) => a + (r[i].value ?? 0), 0).toFixed(decimals(i)));
    return { text: nf(decimals(i)).format(v), value: v };
  });
}

/** Förteckningens tabell, räknad ur modellen. */
export function scheduleTable(doc: ProjectDoc, s: Schedule): ScheduleTable {
  const state = s.state && doc.states.some((x) => x.id === s.state) ? s.state : defaultState(doc);
  const ex = existingState(doc);
  const style = defaultSheet(doc.graphics);
  const contexts = new Map<Id, PlanContext>();
  const ctxFor = (storey: Id): PlanContext => {
    let c = contexts.get(storey);
    if (!c) contexts.set(storey, (c = createContext(doc, storey, { state }, style, () => true).ctx));
    return c;
  };
  let panes: GlassPane[] | null = null;
  const sh: Shared = {
    doc,
    state,
    compareTo: ex && ex.id !== state ? ex.id : undefined,
    decimals: style.general?.areaDecimals ?? 1,
    panes: () => (panes ??= glassPanes(doc, state)),
    litteras: () => openingLitteras(doc),
    hinges: () => openingHinges(doc),
    storeyName: (id) => doc.storeys.find((x) => x.id === id)?.name ?? '',
  };
  const fields = s.columns.map((c) => c.field);
  const perLittera = !!s.perLittera && s.source !== 'Space' && s.source !== 'Label' && s.source !== 'Area';
  const perArea = !!s.perLittera && s.source === 'Area';
  // Fälten som behövs för sortering och gruppering räknas också, fast de inte är kolumner.
  const extra = [...s.sort.map((k) => k.field), ...(s.group ? [s.group] : [])].filter((f) => !fields.includes(f));
  const all = [...fields, ...extra, ...(perLittera && !fields.includes('Littera') ? ['Littera'] : [])];
  const items = itemsOf(doc, s, state, ctxFor);
  if (isLitteraLayout(s)) return litteraTable(doc, s, items, sh);
  // Våningarna nerifrån och upp, så att *Våning* sorteras i husets ordning.
  const storeyOrder = new Map([...buildingStoreys(doc)].sort((a, b) => a.elevation - b.elevation).map((x, i) => [x.name, i]));
  const site = doc.storeys.find((x) => isSite(x));
  if (site) storeyOrder.set(site.name, -1);
  let rows: Cell[][] = items.map((it) => all.map((f) => cellOf(s.source, f, it, sh)));
  if (perLittera) {
    const li = all.indexOf('Littera');
    rows = mergeByLittera(rows.map((cells) => ({ cells, key: cells[li].text })), all);
  }
  if (perArea) rows = mergeAreas(rows, all);
  const col = (f: string) => all.indexOf(f);
  const cmpCell = (f: string, a: Cell, b: Cell) => {
    if (f === 'Våning') return (storeyOrder.get(a.text) ?? 99) - (storeyOrder.get(b.text) ?? 99) || cmpText(a.text, b.text);
    if (f === 'Areaslag') return orderOf(a.text) - orderOf(b.text) || cmpText(a.text, b.text);
    if (a.value !== undefined && b.value !== undefined) return a.value - b.value;
    // Tomma sist.
    if (!a.text !== !b.text) return a.text ? -1 : 1;
    return cmpText(a.text, b.text);
  };
  rows.sort((a, b) => {
    for (const k of s.sort) {
      const i = col(k.field);
      const d = cmpCell(k.field, a[i], b[i]);
      if (d) return k.desc ? -d : d;
    }
    return 0;
  });
  const sums = s.columns.map((c) => !!c.sum && isNumberField(s.source, c.field));
  // Areornas delsummor och summa i hela m² (SS 21054, 4.3).
  const decimals = (i: number) => (s.columns[i].field === 'Area' ? (s.source === 'Area' ? 0 : sh.decimals) : s.columns[i].field === 'Omkrets' || s.columns[i].field === 'Glasarea' ? 1 : 0);
  const anySum = sums.some(Boolean);
  const visible = (r: Cell[]) => r.slice(0, fields.length);
  let groups: ScheduleGroup[];
  if (s.group) {
    const gi = col(s.group);
    const by = new Map<string, Cell[][]>();
    for (const r of rows) {
      const k = r[gi].text;
      const l = by.get(k);
      if (l) l.push(r);
      else by.set(k, [r]);
    }
    const keys = [...by.keys()].sort((a, b) => cmpCell(s.group!, { text: a }, { text: b }));
    groups = keys.map((k) => {
      const list = by.get(k)!.map(visible);
      return { label: k || '(tomt)', rows: list, ...(anySum ? { sums: sumRow(list, sums, decimals) } : {}) };
    });
  } else groups = [{ rows: rows.map(visible) }];
  const shown = rows.map(visible);
  return {
    name: s.name,
    columns: s.columns.map((c, i) => ({ title: columnTitle(c), number: isNumberField(s.source, c.field), sum: sums[i] })),
    groups,
    ...(anySum && !s.noTotal ? { total: sumRow(shown, sums, decimals) } : {}),
    count: shown.length,
  };
}

/** Förteckningens tabell för ett id, eller null om det inte är en förteckning. */
export function scheduleTableById(doc: ProjectDoc, id: Id): ScheduleTable | null {
  const s = scheduleOf(doc, id);
  return s ? cachedTable(doc, s) : null;
}

const tables = new WeakMap<ProjectDoc, Map<string, ScheduleTable>>();

/** Som `scheduleTable`, sparad för samma dokument (skärmen ritar om ofta). */
export function cachedTable(doc: ProjectDoc, s: Schedule): ScheduleTable {
  let m = tables.get(doc);
  if (!m) tables.set(doc, (m = new Map()));
  const key = JSON.stringify(s);
  let t = m.get(key);
  if (!t) m.set(key, (t = scheduleTable(doc, s)));
  return t;
}

/**
 * Förteckningen som CSV (0.12.2): semikolon mellan fälten och decimalkomma,
 * som svensk Excel läser dem, med BOM så att å, ä och ö blir rätt. Tal
 * skrivs utan tusentalsavgränsare. Gruppernas rubriker och delsummor står
 * som egna rader.
 */
export function scheduleCsv(t: ScheduleTable): string {
  const q = (v: string) => (/[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const cell = (c: Cell, i: number) => (t.columns[i].number && c.value !== undefined ? String(c.value).replace('.', ',') : c.text);
  const lines: string[] = [t.columns.map((c) => q(c.title)).join(';')];
  for (const g of t.groups) {
    if (g.label !== undefined) lines.push(q(g.label));
    for (const r of g.rows) lines.push(r.map((c, i) => q(cell(c, i))).join(';'));
    if (g.sums) lines.push(g.sums.map((c, i) => q(i === 0 && !c.text ? `Summa ${g.label}` : cell(c, i))).join(';'));
  }
  if (t.total) lines.push(t.total.map((c, i) => q(i === 0 && !c.text ? 'Summa' : cell(c, i))).join(';'));
  return `﻿${lines.join('\r\n')}\r\n`;
}

/** Decimalerna i ett tal som det står i rutan (*80,6* har en). */
const decimalsIn = (text: string): number => {
  const i = text.lastIndexOf(',');
  return i < 0 ? 0 : Math.min(2, text.length - i - 1);
};

/**
 * Förteckningen som ett blad i XLSX (0.12.3): rubrikraden fet, talen som
 * tal med sina decimaler, gruppernas rubriker feta, och delsummorna och
 * summan som formler (`SUMMA` i svensk Excel), så att de räknas om när
 * man ändrar i bladet.
 */
export function scheduleSheet(t: ScheduleTable): XlsxSheet {
  const rows: XlsxCell[][] = [t.columns.map((c) => ({ v: c.title, bold: true }))];
  const numCell = (c: Cell, i: number): XlsxCell => (t.columns[i].number && c.value !== undefined ? { v: c.value, decimals: decimalsIn(c.text) } : c.text ? { v: c.text } : {});
  const groupSums: number[] = [];
  const dataRows: number[] = [];
  const sumFormula = (i: number, list: readonly number[]) => {
    const col = columnName(i);
    // Sammanhängande rader som ett område, annars en lista.
    const ranges: string[] = [];
    for (let k = 0; k < list.length; ) {
      let j = k;
      while (j + 1 < list.length && list[j + 1] === list[j] + 1) j++;
      ranges.push(j > k ? `${col}${list[k]}:${col}${list[j]}` : `${col}${list[k]}`);
      k = j + 1;
    }
    return ranges.length ? `SUM(${ranges.join(',')})` : '0';
  };
  for (const g of t.groups) {
    if (g.label !== undefined) rows.push([{ v: g.label, bold: true }]);
    const first = rows.length + 1;
    for (const r of g.rows) {
      rows.push(r.map(numCell));
      dataRows.push(rows.length);
    }
    const here = Array.from({ length: g.rows.length }, (_, k) => first + k);
    if (g.sums) {
      rows.push(g.sums.map((c, i) => (i === 0 && !c.text ? { v: `Summa ${g.label ?? ''}`.trim(), bold: true } : t.columns[i].sum ? { f: sumFormula(i, here), v: c.value, bold: true, decimals: decimalsIn(c.text) } : {})));
      groupSums.push(rows.length);
    }
  }
  if (t.total) rows.push(t.total.map((c, i) => (i === 0 && !c.text ? { v: 'Summa', bold: true } : t.columns[i].sum ? { f: sumFormula(i, dataRows), v: c.value, bold: true, decimals: decimalsIn(c.text) } : {})));
  return { name: t.name, rows };
}

/** Förteckningen som XLSX-fil (0.12.3). */
export const scheduleXlsx = (t: ScheduleTable, date?: Date): Uint8Array => writeXlsx(scheduleSheet(t), date);
