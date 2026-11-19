// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Carl August Agrell / Agrell Arkitektur
import type { Element, ProjectDoc } from '../core/model';
import { railNum, type RailPart } from '../core/railingTypes';
import { railingPath, railingsOnStair, railingStair, railingTypeOf, railingValues } from './railing';
import type { RailingParams } from './railingGeometry';
import { geometryOfStair, stairParams } from './stair';

/**
 * Varningarna (0.11.1), som aldrig spärrar: BFS 2024:9 där det är
 * föreskrift (kontrollerat mot texten 1 november 2026: 2 kap. 11 § har
 * måtten för barnsäkerheten men ingen höjd, 12–13 §§ ledstängerna), och
 * *avviker från praxis* för det vedertagna (höjderna,
 * öppningarna, förlängningen och avvikelsen vid kilstegen). Uppslaget i
 * utredningen 30 oktober 2026.
 */
export function railingWarnings(doc: ProjectDoc, el: Element<any>): string[] {
  const out: string[] = [];
  const mm = (v: number) => `${Math.round(v).toLocaleString('sv-SE')} mm`;
  const model = railingTypeOf(doc, el);
  const vals = railingValues(doc, el);
  const p = el.params as RailingParams;
  const stair = railingStair(doc, el);
  const path = railingPath(doc, el);
  const n = (v: RailPart['z'], f = 0) => railNum(v, vals, f);
  const guard = vals.get('Skyddshöjd');
  if (guard !== undefined && model.group !== 'Ledstänger') {
    if (stair && guard < 900 - 0.5) out.push(`Skyddshöjden är ${mm(guard)}; avviker från praxis (900 mm i trappor).`);
    if (!stair && model.group === 'Räcken' && guard < 1100 - 0.5) out.push(`Skyddshöjden är ${mm(guard)}; avviker från praxis (1 100 mm vid ett trapphål eller en kant med fallhöjd).`);
  }
  const grabs = model.parts.filter((q) => q.kind === 'along' && (q.pen === 'railGrab' || /ledstång/i.test(q.name)));
  if (stair)
    for (const q of grabs) {
      const h = n(q.z, 900);
      if (h < 800 - 0.5 || h > 1000 + 0.5) {
        out.push(`${q.name} sitter ${mm(h)} över stegnosen; avviker från praxis (800–1 000 mm).`);
        break;
      }
    }
  if (model.childSafe) {
    const gaps = model.parts.filter((q) => q.kind === 'repeat').map((q) => n(q.spacing, 100));
    const widest = Math.max(0, ...gaps);
    if (widest > 100.5) out.push(`Barnsäkert (BFS 2024:9, 2 kap. 11 §): öppningarna mellan ${model.parts.find((q) => q.kind === 'repeat')!.name.toLowerCase()} är ${mm(widest)}; lodräta öppningar får vara högst 100 mm breda.`);
    const infill = model.parts.some((q) => q.kind === 'repeat' || q.kind === 'surface');
    if (!infill) out.push('Barnsäkert (BFS 2024:9, 2 kap. 11 §): räcket har varken spjälor eller fyllning under handledaren; lodräta öppningar får vara högst 100 mm breda.');
    const climb = model.parts.filter((q) => q.kind === 'along' && q !== grabs[0]).map((q) => n(q.z, 900)).filter((z) => z > 150 && z < 800);
    if (climb.length) out.push(`Barnsäkert (BFS 2024:9, 2 kap. 11 §): en liggare ${mm(climb[0])} upp går att klättra på; 0,8 m av skyddets höjd ska motverka klättring.`);
    const slot = horizontalOpening(model.parts.filter((q) => !grabs.includes(q)), n);
    if (slot) out.push(`Barnsäkert (BFS 2024:9, 2 kap. 11 § 5): öppningen ${slot.where} är ${mm(slot.size)}; horisontella öppningar ovanför skyddets front får inte vara 110–230 mm.`);
  }
  if (stair && grabs.length) {
    const g = geometryOfStair(stairParams(doc, stair));
    const from = p.host?.from ?? 0;
    const to = p.host?.to ?? g?.length ?? 0;
    if (g && (from > 1 || to < g.length - 1)) out.push('Ledstången går inte hela trappan; BFS 2024:9, 2 kap. 13 §: kontinuerlig ledstång, med stöd före och efter trappan.');
    const ext = Math.min(...grabs.map((q) => n(q.extend)));
    if (ext < 300 - 0.5) out.push(`Ledstången förlängs ${mm(ext)} förbi trappan (BFS 2024:9, 2 kap. 13 §: stöd före och efter); avviker från praxis (300 mm).`);
  }
  if (path?.winderDeviation && path.winderDeviation > 50.5) out.push(`Den utjämnade handledaren avviker upp till ${mm(path.winderDeviation)} från höjden över stegnosen vid kilstegen; avviker från praxis (högst 50 mm). Välj Hoppande för exakt höjd.`);
  return out;
}

/**
 * En horisontell öppning på 110–230 mm ovanför skyddets front (BFS 2024:9,
 * 2 kap. 11 § 5; Granskning efter 0.12): springan i höjdled mellan
 * fyllningens eller spjälornas överkant och nästa liggare, och mellan
 * liggarna ovanför. Ledstänger räknas inte; de sitter innanför skyddet.
 */
function horizontalOpening(parts: readonly RailPart[], n: (v: RailPart['z'], f?: number) => number): { where: string; size: number } | null {
  const infill = parts.filter((q) => q.kind === 'repeat' || q.kind === 'surface');
  if (!infill.length) return null;
  const top = Math.max(...infill.map((q) => n(q.to)));
  const rails = parts
    .filter((q) => q.kind === 'along')
    .map((q) => ({ name: q.name.toLowerCase(), top: n(q.z, 900), bottom: n(q.z, 900) - (q.profile?.shape === 'round' ? q.profile.w : q.profile?.h ?? q.profile?.w ?? 40) }))
    .filter((r) => r.top > top + 0.5)
    .sort((a, b) => a.bottom - b.bottom);
  let below = { name: infill[0].name.toLowerCase(), top };
  for (const r of rails) {
    const size = r.bottom - below.top;
    if (size >= 110 - 0.5 && size <= 230 + 0.5) return { where: `mellan ${below.name} och ${r.name}`, size };
    if (r.top > below.top) below = r;
  }
  return null;
}

/** Största glipan under ett barnsäkert räcke, mm (BFS 2024:9, 2 kap. 11 § 3: mot balkonggolvet och stegnosen). */
const RAIL_GAP_MAX = 50;

/**
 * Glipan under ett barnsäkert räcke (0.12.5.5): BFS 2024:9, 2 kap. 11 § 3
 * ger högst 50 mm mellan räckets underkant och balkonggolvet eller
 * trappstegens stegnos. Förut tilläts 100 mm för räcken som inte satt på en
 * trappa; det måttet (punkt 4) gäller bara trappräcket mot ett trapplan
 * eller golv, och appen vet inte om räcket står där eller på en balkong.
 * Varningen kan därför kvitteras på räcket (`ack: ['gap']`).
 */
export function railingGapWarning(doc: ProjectDoc, el: Element<any>): string | null {
  if (((el.params.ack as string[] | undefined) ?? []).includes('gap')) return null;
  const model = railingTypeOf(doc, el);
  if (!model.childSafe || !model.parts.some((q) => q.kind === 'repeat' || q.kind === 'surface')) return null;
  const vals = railingValues(doc, el);
  const n = (v: RailPart['z'], f = 0) => railNum(v, vals, f);
  // Den lägsta delens underkant; stolpar och konsoler (`point`) står på golvet och räknas inte.
  const lows = model.parts.filter((q) => q.kind !== 'point').map((q) => (q.kind === 'along' ? n(q.z, 900) - (q.profile?.shape === 'round' ? q.profile.w : q.profile?.h ?? q.profile?.w ?? 40) : n(q.from)));
  const low = Math.min(...lows.filter((v) => Number.isFinite(v)), Infinity);
  if (!(low > RAIL_GAP_MAX + 0.5)) return null;
  const stair = railingStair(doc, el);
  return `Barnsäkert (BFS 2024:9, 2 kap. 11 §): glipan under räcket är ${Math.round(low).toLocaleString('sv-SE')} mm ${stair ? 'över stegnosen' : 'över golvet'}; högst ${RAIL_GAP_MAX} mm mot stegnosen eller ett balkonggolv (100 mm gäller bara mot ett trapplan). Kvittera om räcket står på ett trapplan.`;
}

/**
 * Trappans varning för ledstången (BFS 2024:9, 2 kap. 12 §: ledstång på
 * båda sidor), som kan kvitteras på trappan (`ack: ['handrails']`).
 */
export function stairHandrailWarning(doc: ProjectDoc, stair: Element<any>): string | null {
  if (((stair.params.ack as string[] | undefined) ?? []).includes('handrails')) return null;
  const on = railingsOnStair(doc, stair.id);
  const missing = (['left', 'right'] as const).filter((s) => !on[s].length);
  if (!missing.length) return null;
  const name = missing.length === 2 ? 'båda sidorna saknar' : `${missing[0] === 'left' ? 'vänster' : 'höger'} sida saknar`;
  return `Ledstång på båda sidor (BFS 2024:9, 2 kap. 12 §): ${name} räcke eller ledstång. Lägg till med Räcke längs kanten i smartmenyn, eller kvittera.`;
}
