// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Carl August Agrell / Agrell Arkitektur
import type { Element, Id, ProjectDoc } from '../core/model';
import { DERIVED_FIELDS, fieldValue } from '../core/openingSchedule';
import { OP_LABEL } from '../core/openingTypes';
import { layoutOpening } from '../core/openingLayout';
import { type ScheduleSource } from '../core/schedules';
import { actionOf, type Action } from '../core/states';
import { roomDaylight, shareText, type GlassPane } from '../elements/daylight';
import { labelObjects, labelValue, labelLines } from '../elements/label';
import { litteraField, ownProp } from '../elements/littera';
import { openingModelOf, type OpeningObjParams } from '../elements/openingSpec';
import type { PlanContext } from '../elements/registry';
import { spaceOutline, roomNumbersFor, type SpaceParams } from '../elements/rooms';
import { areaOf } from '../elements/space';
import { areaParts, roundArea, type AreaParams, type AreaPart } from '../elements/areaCalc';
import { ringsArea } from '../elements/areaRegions';


/**
 * Förteckningens celler (Granskning efter 0.12, ur `schedules.ts`): ett
 * fälts värde för ett objekt, de framräknade fälten för dörrar och fönster,
 * enheterna och statusens ord.
 */

export interface Cell {
  /** Texten i rutan; tom ritas som `-`. */
  text: string;
  /** Talet för summan (bara kolumner med tal). */
  value?: number;
}

/** Enheten i rubriken för fälten med tal. */
export const UNITS: Record<string, string> = { Area: 'm²', Omkrets: 'm', Rumshöjd: 'mm', Glasarea: 'm²', Bröstningshöjd: 'mm', Bredd: 'mm', Höjd: 'mm' };

/** Kolumnens rubrik: den egna, eller fältets namn med enheten (*Area, m²*). */
export const columnTitle = (c: { field: string; title?: string }): string => c.title?.trim() || (UNITS[c.field] ? `${c.field}, ${UNITS[c.field]}` : c.field);

export const nf = (d: number) => new Intl.NumberFormat('sv-SE', { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: true });
export const STATUS: Partial<Record<Action, string>> = { new: 'Nytt', existing: 'Befintligt', demolished: 'Rivs' };

/** Ett objekt med det som behövs för att läsa dess fält. */
export interface Item {
  el: Element;
  ctx: PlanContext;
  /** En framräknad area (0.12.3): BYA, BTA eller BRA på våningen, i m² med en decimal, och beteckningen (BTA(o) …). */
  gen?: { kind: string; value: number; code?: string };
  /** Areaobjektets del (0.12.4): BIA(u) bortom 6-meterszonen, BOA:L under 2,10 m … */
  part?: AreaPart;
}

/** Det som räknas en gång för hela förteckningen. */
export interface Shared {
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
export function cellOf(src: ScheduleSource, field: string, it: Item, sh: Shared): Cell {
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

export const DOOR_OP: Record<string, string> = { leaf: 'Slagdörr', fixed: 'Fast parti' };

/**
 * Fältmallens fält som räknas fram ur typen eller läget (0.12.5):
 * öppningssätt, utförande (typens namn), hålets mått, poster, spröjs,
 * karmdjup och väggens tjocklek. Null för andra fält.
 */
export function derivedOpening(field: string, it: Item, sh: Shared): Cell | null {
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

/** Texter i svensk ordning, med talen som tal (T2 före T10). */
export const cmpText = (a: string, b: string) => a.localeCompare(b, 'sv', { numeric: true, sensitivity: 'base' });
