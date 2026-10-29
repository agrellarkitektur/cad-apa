import type { Terrain } from './site';

/**
 * Den färdiga marken (0.10.4): den befintliga marken med markobjekten
 * (platåer och urgrävningar) i ritordning. Den befintliga marken ändras
 * aldrig; den färdiga räknas om ur den när ett objekt ändras.
 *
 * Varje objekt har en plan yta (platån, urgrävningens botten) och möter
 * marken med en slänt eller en stödmur. Slänten är ett band runt ytan som
 * vidgas med avståndet: på avståndet d från ytans kant ligger den färdiga
 * marken högst d/släntens lutning över och under kantens höjd. Där
 * befintlig mark ligger inom bandet är den orörd; annars tas den ned
 * (schakt) eller fylls upp (fyll) till bandets kant. En urgrävning tar bara
 * ned, en platå både tar ned och fyller. En stödmur ger ingen slänt: marken
 * utanför är orörd.
 *
 * Höjdpunkter och brytlinjer (0.10.5) möter marken på ett annat sätt: de
 * låser marken där de ligger, och marken runt tonas mot dem inom en radie
 * (`blend`), mjukt (vikten följer en S-kurva från 1 vid objektet till 0 vid
 * radien). Stödmurar (0.10.5) är linjer som slänterna och utjämningen inte
 * går över (`barriers`): marken på andra sidan muren är orörd.
 *
 * Ren matematik på rutnätet, utan ritning eller elementtyper.
 */

/** Ett markobjekt som det räknas: ytans höjd i varje punkt och hur den möter marken. */
export interface GroundShape {
  id: string;
  /** Får ta ned marken (schakt). */
  cut: boolean;
  /** Får fylla upp marken (fyll). */
  fill: boolean;
  /** Släntens lutning som horisontellt per vertikalt (2 för 1:2), eller null för stödmur. */
  slope: number | null;
  /** Ytans rektangel i modellen (mm): [minX, minY, maxX, maxY]. */
  box: readonly [number, number, number, number];
  /** Lägsta och högsta höjd på ytan (mm från ±0), för hur långt slänten kan nå. */
  hMin: number;
  hMax: number;
  /**
   * En punkt i modellen (mm): om den ligger på ytan, avståndet till ytans kant
   * (0 på ytan) och höjden (mm från ±0) där, eller vid närmaste kant utanför.
   * `skip`: punkten hör inte till objektet alls (huset inne i platån runt det).
   * `cell` är rutnätets maskvidd (mm). `wall` (0.10.18): närmaste kant är
   * en stödmur, så marken utanför den är orörd (rampens sidor var för sig).
   * `slope` (0.10.26): närmaste kantens egen slänt, som inte får vara
   * flackare än formens `slope` (den räknar hur långt slänten når).
   */
  probe(x: number, y: number, cell: number): { inside: boolean; d: number; h: number; skip?: boolean; at?: readonly [number, number]; wall?: boolean; slope?: number };
  /**
   * Utjämning (0.10.5): radien (mm) inom vilken marken tonas mot objektets
   * höjd, i stället för slänt. `slope` gäller då inte.
   */
  blend?: number;
}

/** En stödmurs linje (0.10.5): ett segment i modellen, mm. */
export type Barrier = readonly [number, number, number, number];

/** Schakt och fyll i m³ för ett objekt. */
export interface CutFill {
  cut: number;
  fill: number;
}

export interface FinishedGround {
  /** Höjderna (RH 2000, m) i samma rutnät som den befintliga marken. */
  z: Float32Array;
  /** Rutorna där marken ändrats (nodernas index), eller null. */
  changed: { i0: number; i1: number; j0: number; j1: number } | null;
  /** Schakt och fyll per objekt, i ritordning: det som ett objekt ändrar efter de bakom. */
  volumes: Map<string, CutFill>;
  /** Lägsta och högsta höjd (RH 2000, m): den befintligas, vidgade med det som ändrats. */
  min: number;
  max: number;
  /** Vad varje objekt ändrade, och det det räknades mot, så att nästa räkning kan börja efter objekten som är sig lika (0.10.6). */
  steps: readonly Step[];
  base: readonly unknown[];
}

/** Ett objekts ändringar (0.10.6): nodernas index och nya höjder, och läget efter objektet. */
export interface Step {
  shape: GroundShape;
  idx: Int32Array;
  val: Float32Array;
  /** Höjderna före objektet (0.10.26), för marken utanför en stödmurskant i 3D. */
  old: Float32Array;
  vol: CutFill;
  changed: FinishedGround['changed'];
  min: number;
  max: number;
}

/** Hur långt slänten högst når från ytan, mm. */
const MAX_REACH = 100_000;

/**
 * Den färdiga marken: den befintliga med objekten i ordning. Med `prev`, ett
 * tidigare svar mot samma mark och murar (0.10.6), används dess ändringar
 * för objekten i början som är desamma (samma objekt), så att bara objektet
 * som ändrats och de efter det räknas om.
 */
export function finishedGround(t: Terrain, shapes: readonly GroundShape[], barriers: readonly Barrier[] = [], prev?: FinishedGround | null): FinishedGround {
  const { W, H, x0, y1, s } = t.grid;
  const z = t.z.slice();
  const volumes = new Map<string, CutFill>();
  const site = t.site;
  const v = (site.rotation * Math.PI) / 180;
  const c = Math.cos(v);
  const sn = Math.sin(v);
  const ox = site.origin[0];
  const oy = site.origin[1];
  const datum = site.datum;
  const cell = s * s;
  let changed: FinishedGround['changed'] = null;
  let min = t.min;
  let max = t.max;
  const base = [t.z, x0, y1, s, W, H, ox, oy, site.rotation, datum, ...barriers];
  const steps: Step[] = [];
  // Objekten i början som är desamma som förra gången: deras ändringar läggs på direkt.
  if (prev && prev.base.length === base.length && prev.base.every((b, i) => b === base[i])) {
    for (const st of prev.steps) {
      if (steps.length >= shapes.length || st.shape !== shapes[steps.length]) break;
      for (let m = 0; m < st.idx.length; m++) z[st.idx[m]] = st.val[m];
      volumes.set(st.shape.id, st.vol);
      ({ changed, min, max } = st);
      steps.push(st);
    }
  }
  for (const sh of shapes.slice(steps.length)) {
    const vol: CutFill = { cut: 0, fill: 0 };
    volumes.set(sh.id, vol);
    const idx: number[] = [];
    const val: number[] = [];
    const was: number[] = [];
    const lo = Math.min(sh.hMin, (t.min - datum) * 1000);
    const hi = Math.max(sh.hMax, (t.max - datum) * 1000);
    const blend = sh.blend ?? 0;
    const reach = blend > 0 ? blend : sh.slope === null ? 0 : Math.min(MAX_REACH, (hi - lo) * sh.slope);
    const bx0 = sh.box[0] - reach - s * 1000;
    const by0 = sh.box[1] - reach - s * 1000;
    const bx1 = sh.box[2] + reach + s * 1000;
    const by1 = sh.box[3] + reach + s * 1000;
    // Murarna som kan ligga mellan ytan och noderna runt den.
    const walls = barriers.filter((w) => Math.max(w[0], w[2]) >= bx0 && Math.min(w[0], w[2]) <= bx1 && Math.max(w[1], w[3]) >= by0 && Math.min(w[1], w[3]) <= by1);
    // Rutan i zonens koordinater, ur modellens fyra hörn.
    let Xmin = Infinity;
    let Xmax = -Infinity;
    let Ymin = Infinity;
    let Ymax = -Infinity;
    for (const [x, y] of [
      [bx0, by0],
      [bx1, by0],
      [bx1, by1],
      [bx0, by1],
    ]) {
      const X = ox + (x / 1000) * c - (y / 1000) * sn;
      const Y = oy + (x / 1000) * sn + (y / 1000) * c;
      Xmin = Math.min(Xmin, X);
      Xmax = Math.max(Xmax, X);
      Ymin = Math.min(Ymin, Y);
      Ymax = Math.max(Ymax, Y);
    }
    const i0 = Math.max(0, Math.floor((Xmin - x0) / s));
    const i1 = Math.min(W - 1, Math.ceil((Xmax - x0) / s));
    const j0 = Math.max(0, Math.floor((y1 - Ymax) / s));
    const j1 = Math.min(H - 1, Math.ceil((y1 - Ymin) / s));
    for (let j = j0; j <= j1; j++) {
      const b = y1 - j * s - oy;
      for (let i = i0; i <= i1; i++) {
        const n = j * W + i;
        const old = z[n];
        if (old !== old) continue;
        const a = x0 + i * s - ox;
        const x = (a * c + b * sn) * 1000;
        const y = (-a * sn + b * c) * 1000;
        if (x < bx0 || x > bx1 || y < by0 || y > by1) continue;
        const cur = (old - datum) * 1000;
        // Utanför ytans rektangel: hoppa över noder som slänten inte kan nå,
        // räknat med avståndet till rektangeln och ytans högsta och lägsta höjd.
        const dx = x < sh.box[0] ? sh.box[0] - x : x > sh.box[2] ? x - sh.box[2] : 0;
        const dy = y < sh.box[1] ? sh.box[1] - y : y > sh.box[3] ? y - sh.box[3] : 0;
        if (dx || dy) {
          if (blend > 0) {
            if (Math.hypot(dx, dy) > blend) continue;
          } else {
            if (sh.slope === null) continue;
            const band = Math.hypot(dx, dy) / sh.slope;
            if ((!sh.fill || cur >= sh.hMax - band) && (!sh.cut || cur <= sh.hMin + band)) continue;
          }
        }
        const p = sh.probe(x, y, s * 1000);
        if (p.skip || (p.wall && !p.inside)) continue;
        let next = cur;
        // Bakom en stödmur (sett från ytan) är marken orörd.
        if (!p.inside && walls.length && p.at && blocked(x, y, p.at[0], p.at[1], walls)) continue;
        if (blend > 0) {
          if (p.inside) next = p.h;
          else if (p.d < blend) {
            const f = p.d / blend;
            next = cur + (p.h - cur) * (1 - f * f * (3 - 2 * f));
          }
        } else if (p.inside) {
          if (sh.cut && cur > p.h) next = p.h;
          if (sh.fill && cur < p.h) next = p.h;
        } else if (sh.slope !== null && p.d <= reach) {
          const band = p.d / Math.min(sh.slope, p.slope ?? sh.slope);
          if (sh.cut && cur > p.h + band) next = p.h + band;
          if (sh.fill && cur < p.h - band) next = p.h - band;
        }
        if (next === cur) continue;
        const d = (next - cur) / 1000;
        if (d > 0) vol.fill += d * cell;
        else vol.cut -= d * cell;
        const h = datum + next / 1000;
        z[n] = h;
        idx.push(n);
        val.push(h);
        was.push(old);
        if (h < min) min = h;
        if (h > max) max = h;
        if (!changed) changed = { i0: i, i1: i, j0: j, j1: j };
        else if (i < changed.i0 || i > changed.i1 || j < changed.j0 || j > changed.j1)
          changed = { i0: Math.min(i, changed.i0), i1: Math.max(i, changed.i1), j0: Math.min(j, changed.j0), j1: Math.max(j, changed.j1) };
      }
    }
    steps.push({ shape: sh, idx: Int32Array.from(idx), val: Float32Array.from(val), old: Float32Array.from(was), vol, changed, min, max });
  }
  return { z, changed, volumes, min, max, steps, base };
}

type V2 = readonly [number, number];

/** Om sträckan från (x, y) till (ax, ay) korsar eller når någon av murarna (en yta vars kant ligger på muren hålls av den). */
function blocked(x: number, y: number, ax: number, ay: number, walls: readonly Barrier[]): boolean {
  for (const w of walls) {
    const d1 = side(w[0], w[1], w[2], w[3], x, y);
    const d2 = side(w[0], w[1], w[2], w[3], ax, ay);
    if ((d1 > 0 && d2 > 0) || (d1 < 0 && d2 < 0)) continue;
    const d3 = side(x, y, ax, ay, w[0], w[1]);
    const d4 = side(x, y, ax, ay, w[2], w[3]);
    if ((d3 > 0 && d4 > 0) || (d3 < 0 && d4 < 0)) continue;
    return true;
  }
  return false;
}

const side = (ax: number, ay: number, bx: number, by: number, x: number, y: number) => Math.sign((bx - ax) * (y - ay) - (by - ay) * (x - ax));

/**
 * Var en punkt ligger mot några ringar (jämn–udda, så att hål fungerar):
 * inuti eller inte, avståndet till närmaste kant och punkten där.
 */
export function nearestEdge(rings: readonly (readonly V2[])[], x: number, y: number): { inside: boolean; d: number; at: [number, number] } {
  let inside = false;
  let best = Infinity;
  let bx = x;
  let by = y;
  for (const ring of rings) {
    const n = ring.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      const dx = xi - xj;
      const dy = yi - yj;
      const l2 = dx * dx + dy * dy;
      const f = l2 > 0 ? Math.max(0, Math.min(1, ((x - xj) * dx + (y - yj) * dy) / l2)) : 0;
      const px = xj + dx * f;
      const py = yj + dy * f;
      const d2 = (x - px) * (x - px) + (y - py) * (y - py);
      if (d2 < best) {
        best = d2;
        bx = px;
        by = py;
      }
    }
  }
  return { inside, d: Math.sqrt(best), at: [bx, by] };
}

/**
 * Markmodellen med andra höjder i samma rutnät (den färdiga marken). Lägsta
 * och högsta höjd räknas om, om de inte är kända.
 */
export function withHeights(t: Terrain, z: Float32Array, range?: { min: number; max: number }): Terrain {
  if (range) return { ...t, z, min: range.min, max: range.max };
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < z.length; i++) {
    const h = z[i];
    if (h === h) {
      if (h < min) min = h;
      if (h > max) max = h;
    }
  }
  return { ...t, z, min, max };
}
