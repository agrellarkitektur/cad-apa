import type { Element, Id, ProjectDoc } from '../core/model';
import { buildingStoreys, isSite } from '../core/model';
import { fieldValue } from '../core/openingSchedule';
import { isNumberField, scheduleOf, type Schedule, type ScheduleSource } from '../core/schedules';
import { actionOf, defaultState, existingState, type Action } from '../core/states';
import { defaultSheet } from '../core/viewCategories';
import { glassPanes, roomDaylight, shareText, type GlassPane } from '../elements/daylight';
import { labelObjects, labelValue, labelLines } from '../elements/label';
import { litteraField, ownProp } from '../elements/littera';
import { openingHinges, openingLitteras } from '../elements/openingLittera';
import type { OpeningObjParams } from '../elements/openingSpec';
import { gateLittera } from '../elements/railing';
import type { RailingParams } from '../elements/railingGeometry';
import type { PlanContext } from '../elements/registry';
import { spaceOutline, roomNumbersFor, type SpaceParams } from '../elements/rooms';
import { areaOf } from '../elements/space';
import { createContext } from './context';

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
}

/** Enheten i rubriken för fälten med tal. */
const UNITS: Record<string, string> = { Area: 'm²', Omkrets: 'm', Rumshöjd: 'mm', Glasarea: 'm²', Bröstningshöjd: 'mm', Bredd: 'mm', Höjd: 'mm' };

/** Kolumnens rubrik: den egna, eller fältets namn med enheten (*Area, m²*). */
export const columnTitle = (c: { field: string; title?: string }): string => c.title?.trim() || (UNITS[c.field] ? `${c.field}, ${UNITS[c.field]}` : c.field);

const nf = (d: number) => new Intl.NumberFormat('sv-SE', { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: true });
const STATUS: Partial<Record<Action, string>> = { new: 'Nytt', existing: 'Befintligt', demolished: 'Rivs' };
const HANG: Record<string, string> = { right: 'Höger', pair: 'Par', slide: 'Skjut' };

/** Ett objekt (eller en grind i ett räcke) med det som behövs för att läsa dess fält. */
interface Item {
  el: Element;
  ctx: PlanContext;
  gate?: NonNullable<RailingParams['gates']>[number];
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
      return { text: fieldValue(el, field) || litteraField(ctx, el, field) };
    }
    case 'Gate': {
      const g = it.gate!;
      switch (field) {
        case 'Littera':
          return { text: gateLittera(doc, g) };
        case 'Antal':
          return { text: '1', value: 1 };
        case 'Räcke':
          return { text: (el.definition ? doc.definitions[el.definition]?.name : undefined) ?? el.name ?? '' };
        case 'Bredd':
          return mm(g.width);
        case 'Höjd':
          return mm(g.own ? g.height : undefined);
        case 'Hängning':
          return { text: HANG[g.hang ?? ''] ?? 'Vänster' };
        case 'Lås':
          return { text: g.lock ?? '' };
      }
      return { text: ownProp([el.props], field) };
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

/** Objekten förteckningen räknar: källans sort i tillståndet, på de valda våningarna. */
function itemsOf(doc: ProjectDoc, s: Schedule, state: Id, ctxFor: (storey: Id) => PlanContext): Item[] {
  const sheets = new Set(doc.sheets.map((x) => x.id));
  const storeys = s.storeys?.length ? new Set(s.storeys) : null;
  const type = s.source === 'Gate' ? 'Railing' : s.source;
  const out: Item[] = [];
  for (const el of Object.values(doc.elements)) {
    if (el.type !== type) continue;
    if (el.space && sheets.has(el.space)) continue;
    if (storeys && !storeys.has(el.storey)) continue;
    // Littera följer inte alltid tillstånden (de saknar dem då); rummen och öppningarna gör det.
    if (!el.states.includes(state) && !(s.source === 'Label' && !el.states.length)) continue;
    if (s.source === 'Label' && s.labelSort && (el.params as { sort?: string }).sort?.trim().toLowerCase() !== s.labelSort.trim().toLowerCase()) continue;
    if (s.source === 'Gate') {
      for (const gate of (el.params as RailingParams).gates ?? []) out.push({ el, ctx: ctxFor(el.storey), gate });
      continue;
    }
    out.push({ el, ctx: ctxFor(el.storey) });
  }
  return out;
}

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
  const perLittera = !!s.perLittera && s.source !== 'Space' && s.source !== 'Label';
  // Fälten som behövs för sortering och gruppering räknas också, fast de inte är kolumner.
  const extra = [...s.sort.map((k) => k.field), ...(s.group ? [s.group] : [])].filter((f) => !fields.includes(f));
  const all = [...fields, ...extra, ...(perLittera && !fields.includes('Littera') ? ['Littera'] : [])];
  const items = itemsOf(doc, s, state, ctxFor);
  // Våningarna nerifrån och upp, så att *Våning* sorteras i husets ordning.
  const storeyOrder = new Map([...buildingStoreys(doc)].sort((a, b) => a.elevation - b.elevation).map((x, i) => [x.name, i]));
  const site = doc.storeys.find((x) => isSite(x));
  if (site) storeyOrder.set(site.name, -1);
  let rows: Cell[][] = items.map((it) => all.map((f) => cellOf(s.source, f, it, sh)));
  if (perLittera) {
    const li = all.indexOf('Littera');
    rows = mergeByLittera(rows.map((cells) => ({ cells, key: cells[li].text })), all);
  }
  const col = (f: string) => all.indexOf(f);
  const cmpCell = (f: string, a: Cell, b: Cell) => {
    if (f === 'Våning') return (storeyOrder.get(a.text) ?? 99) - (storeyOrder.get(b.text) ?? 99) || cmpText(a.text, b.text);
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
  const decimals = (i: number) => (s.columns[i].field === 'Area' ? sh.decimals : s.columns[i].field === 'Omkrets' || s.columns[i].field === 'Glasarea' ? 1 : 0);
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
