import type { Element, ProjectDoc } from '../core/model';
import { railNum, type RailPart } from '../core/railingTypes';
import { railingPath, railingsOnStair, railingStair, railingTypeOf, railingValues } from './railing';
import type { RailingParams } from './railingGeometry';
import { geometryOfStair, stairParams } from './stair';

/**
 * Varningarna (0.11.1), som aldrig spärrar: BFS 2024:9 där det är
 * föreskrift, och *avviker från praxis* för det vedertagna (höjderna,
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
    if (widest > 100.5) out.push(`Barnsäkert (BFS 2024:9, 2 kap. 11 §): öppningarna mellan ${model.parts.find((q) => q.kind === 'repeat')!.name.toLowerCase()} är ${mm(widest)}; avviker från praxis (högst 100 mm).`);
    const infill = model.parts.some((q) => q.kind === 'repeat' || q.kind === 'surface');
    if (!infill) out.push('Barnsäkert (BFS 2024:9, 2 kap. 11 §): räcket har varken spjälor eller fyllning under handledaren; avviker från praxis (öppningar högst 100 mm).');
    // Glipan under räcket: den lägsta delens underkant.
    const lows = model.parts.map((q) => (q.kind === 'along' ? n(q.z, 900) - (q.profile?.shape === 'round' ? q.profile.w : q.profile?.h ?? q.profile?.w ?? 40) : n(q.from)));
    const low = Math.min(...lows.filter((v) => Number.isFinite(v)), Infinity);
    const allowed = stair ? 50 : 100;
    if (infill && low > allowed + 0.5) out.push(`Barnsäkert (BFS 2024:9, 2 kap. 11 §): glipan under räcket är ${mm(low)} ${stair ? 'över stegnosen' : 'över golvet'}; avviker från praxis (högst ${allowed} mm).`);
    const climb = model.parts.filter((q) => q.kind === 'along' && q !== grabs[0]).map((q) => n(q.z, 900)).filter((z) => z > 150 && z < 800);
    if (climb.length) out.push(`Barnsäkert (BFS 2024:9, 2 kap. 11 §): en liggare ${mm(climb[0])} upp går att klättra på; avviker från praxis (inga fotsteg under 800 mm).`);
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
