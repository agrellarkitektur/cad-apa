import type { HatchLine } from './fillTypes';

/**
 * Linjefamiljernas streck som geometri (0.8.36, egen fil sedan 0.8.38):
 * linjerna över en ruta med var streckningen börjar (PDF:en och
 * förhandsvisningarna), och strecken klippta mot en yta (skärmen, för
 * starkt snedställda familjer).
 */

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

/**
 * Familjens streck inom ytan (0.8.38), i samma mått som ytan: linjerna
 * (som `hatchStrokes`) klippta mot ringarna (jämnt–udda, som fyllningen)
 * och delade efter streckningen (`l.dash` som den ritas, se `drawnDash`:
 * ett streck på 0 är en punkt och blir ett stycke med samma början och
 * slut). Svaret är platt, fyra tal per stycke (x och y för början och
 * slut), högst `max` stycken; fler betyder att det inte fick plats.
 * Skärmen ritar familjer med långa mellanrum så, se `renderPrimitives`.
 */
export function clippedDashes(l: HatchLine, rings: readonly (readonly (readonly [number, number])[])[], max = 50000): number[] {
  const out: number[] = [];
  const sp = l.spacing;
  const dash = l.dash?.length ? l.dash : null;
  const period = dash ? dash.reduce((s, x) => s + x, 0) : 0;
  if (!(sp > 0) || (dash && !(period > 0))) return out;
  const r = (l.angle * Math.PI) / 180;
  const dx = Math.cos(r);
  const dy = Math.sin(r);
  // Hörnen längs (a) och tvärs (c) linjerna, en gång.
  const al: number[][] = [];
  const cr: number[][] = [];
  let cMin = Infinity, cMax = -Infinity, aMin = Infinity, aMax = -Infinity;
  for (const ring of rings) {
    const a = ring.map((q) => q[0] * dx + q[1] * dy);
    const c = ring.map((q) => -q[0] * dy + q[1] * dx);
    for (let i = 0; i < a.length; i++) {
      if (a[i] < aMin) aMin = a[i];
      if (a[i] > aMax) aMax = a[i];
      if (c[i] < cMin) cMin = c[i];
      if (c[i] > cMax) cMax = c[i];
    }
    if (ring.length >= 2) {
      al.push(a);
      cr.push(c);
    }
  }
  if (!al.length) return out;
  const [p0, p1] = l.phase ?? [0, 0];
  const shift = l.shift ?? 0;
  const span = aMax - aMin;
  const ts: number[] = [];
  const push = (s: number, t0: number, t1: number) => {
    out.push(-dy * s + dx * t0, dx * s + dy * t0, -dy * s + dx * t1, dx * s + dy * t1);
  };
  const k0 = Math.floor((cMin - p1) / sp);
  const k1 = Math.ceil((cMax - p1) / sp);
  for (let k = k0; k <= k1; k++) {
    const s = p1 + k * sp;
    const start = p0 + k * shift;
    // Glesa mönster (grus): finns inget streck inom ytans längd hoppas linjen över.
    if (dash && span < period) {
      const x = (((aMin - start) % period) + period) % period;
      let o = 0;
      let any = false;
      for (let j = 0; j < dash.length && !any; j += 2) {
        any = (o <= x + span && o + dash[j] >= x) || o + period <= x + span;
        o += dash[j] + (dash[j + 1] ?? 0);
      }
      if (!any) continue;
    }
    // Var linjen korsar kanterna, längs linjen (halvöppet tvärs linjen, så att ett hörn på linjen räknas en gång).
    ts.length = 0;
    for (let ri = 0; ri < al.length; ri++) {
      const a = al[ri];
      const c = cr[ri];
      const n = a.length;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        if (c[i] > s === c[j] > s) continue;
        ts.push(a[j] + ((s - c[j]) / (c[i] - c[j])) * (a[i] - a[j]));
      }
    }
    if (ts.length < 2) continue;
    ts.sort((x, y) => x - y);
    for (let i = 0; i + 1 < ts.length; i += 2) {
      const t0 = ts[i];
      const t1 = ts[i + 1];
      if (!(t1 > t0)) continue;
      if (!dash) {
        push(s, t0, t1);
        if (out.length >= max * 4) return out;
        continue;
      }
      // Strecken: varje period börjar vid start + n · perioden.
      let o = t0 - ((((t0 - start) % period) + period) % period);
      while (o <= t1) {
        for (let j = 0; j < dash.length; j += 2) {
          const a = o;
          const b = o + dash[j];
          o = b + (dash[j + 1] ?? 0);
          if (dash[j] === 0 ? a < t0 || a > t1 : b <= t0 || a >= t1) continue;
          if (dash[j] === 0) push(s, a, a);
          else push(s, Math.max(a, t0), Math.min(b, t1));
          if (out.length >= max * 4) return out;
        }
      }
    }
  }
  return out;
}
