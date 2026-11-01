import { RISER_TARGET, STAIR_THICKNESS, type StairGeometry, type StairParams } from './stairGeometry';
import { SPIRAL_HEADROOM } from './stairSpiral';

/**
 * Trappans varningar (0.11, 0.11.7.2), delade ur stairGeometry.ts i
 * granskningen efter 0.11.8.
 */

/**
 * Varningarna (0.11, texterna 0.11.1): måtten är vedertagna men står inte i
 * Boverkets föreskrifter (BFS 2024:9 har inga mått för steg och bredd; de
 * var allmänna råd i BBR 8:232), så de *avviker från praxis*. Uppslaget 30
 * oktober 2026 och igen 1 november (granskningen efter 0.11.8): den fria
 * höjden 2,0 m och ledstängerna är kvar som förut; nytt är öppningen mellan
 * planstegen i en öppen trappa (2 kap. 6 §). Trappan går alltid att rita;
 * varningarna står i panelen.
 */
export function stairWarnings(p: StairParams, g: StairGeometry, outdoor = false): string[] {
  const out: string[] = [];
  const mm = (v: number) => `${Math.round(v).toLocaleString('sv-SE')} mm`;
  const h = g.riserHeight;
  const minG = outdoor ? 300 : 250;
  for (const r of g.runs) {
    if (r.going < minG - 0.5) {
      out.push(`Stegdjupet i gånglinjen är ${mm(r.going)}; avviker från praxis (minst ${minG} mm${outdoor ? ' utomhus' : ', 300 utomhus'}).`);
      break;
    }
  }
  for (const r of g.runs) {
    const f = 2 * h + r.going;
    if (f < 600 - 0.5 || f > 650 + 0.5) {
      out.push(`Stegformeln 2 × steghöjd + stegdjup är ${mm(f)}; avviker från praxis (600–650 mm).`);
      break;
    }
  }
  if (h > 200.5) out.push(`Steghöjden är ${mm(h)}; avviker från praxis (180–200 mm i bostäder).`);
  if (g.width < 900 - 0.5) out.push(`Bredden är ${mm(g.width)}; avviker från praxis (minst 900 mm fri bredd i bostäder).`);
  for (const [s, e] of g.landings) if (e - s < g.width - 1) {
    out.push(`Ett vilplan är ${mm(e - s)} i gånglinjen; avviker från praxis (minst trappans bredd, ${mm(g.width)}).`);
    break;
  }
  // Spiraltrappan (0.11.7.2): den fria höjden under nästa varv, (steg per varv × steghöjd) − stegets tjocklek.
  if (g.turn && g.length > g.turn + 1 && g.runs[0]?.going > 0) {
    const t = p.build === 'built' ? Math.max(0, p.built?.tread?.thickness ?? 40) : Math.max(20, p.thickness ?? STAIR_THICKNESS);
    const free = (g.turn / g.runs[0].going) * h - t;
    if (free < SPIRAL_HEADROOM - 0.5) out.push(`Den fria höjden under nästa varv är ${mm(free)}; avviker från praxis (minst ${mm(SPIRAL_HEADROOM)}). Minska stegdjupet, eller öka steghöjden eller ytterdiametern.`);
  }
  // Öppen trappa (sättsteg 0): BFS 2024:9, 2 kap. 6 §, öppningar mellan planstegen högst 100 mm. Uppslaget i granskningen efter 0.11.8.
  if (p.build === 'built' && (p.built?.riser?.thickness ?? 20) <= 0) {
    const gap = h - (p.built?.tread?.thickness ?? 40);
    if (gap > 100.5) out.push(`Öppningen mellan planstegen är ${mm(gap)}; BFS 2024:9, 2 kap. 6 §: högst 100 mm (sättsteg, eller tjockare plansteg).`);
  }
  const wanted = p.risers ?? Math.max(2, Math.round(p.rise / RISER_TARGET));
  const actual = g.risers.length;
  if (p.risers !== undefined && actual !== wanted) out.push(`Trappan har ${actual} sättsteg i stället för ${wanted}: varje lopp mellan vilplanen behöver minst ett steg.`);
  return out;
}
