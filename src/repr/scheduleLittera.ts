// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Carl August Agrell / Agrell Arkitektur
import type { Id, ProjectDoc } from '../core/model';
import { DERIVED_FIELDS, scheduleFields, type ScheduleKind } from '../core/openingSchedule';
import { DEFAULT_FIGURE_SCALE, type Schedule } from '../core/schedules';
import { openingMirrored } from '../elements/openingLittera';
import { openingModelOf, type OpeningObjParams } from '../elements/openingSpec';
import { openingFigure, type OpeningFigure } from './openingFigure';
import { type Cell, type Item, type Shared, cellOf } from './scheduleCells';
import type { ScheduleTable } from './schedules';
import { cmpText } from './scheduleCells';


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
export function litteraTable(doc: ProjectDoc, s: Schedule, items: readonly Item[], sh: Shared): ScheduleTable {
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
