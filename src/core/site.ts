import type { Asset, Id, ProjectDoc } from './model';

/**
 * Platsen (0.10.3, format 18): var projektet ligger i SWEREF 99 och RH 2000,
 * och den befintliga markmodellen. Allt kommer från platspaketet ur
 * Höjdkurvor (`docs/UTBYTE-CAD-APA.md` i hojdkurvor-repot). Modellen ritas
 * runt nollpunkten i mm som förut; zonens koordinater (meter, stora tal)
 * når aldrig planen eller 3D-vyn.
 *
 * Höjderna i modellen räknas från projektets ±0 (plan 1:s golv), som ligger
 * på `datum` meter i RH 2000. Rutnätet, grannhusen och träden har kvar sina
 * höjder i RH 2000, så att ett nytt ±0 flyttar huset mot marken, inte
 * marken.
 *
 * Ren matematik och data, utan ritning eller gränssnitt.
 */

/** Markmodellens rutnät, i zonens koordinater (m). Höjderna ligger i en fil (`asset`), inte som tal i projektet. */
export interface SiteGrid {
  asset: Id;
  /** Västligaste nodens x och nordligaste nodens y. */
  x0: number;
  y1: number;
  /** Avståndet mellan noderna, m. */
  s: number;
  W: number;
  H: number;
}

export interface Site {
  /** Planens koordinatsystem (SWEREF 99-zonen) och höjdsystemet. */
  crs: { epsg: number; name: string; height: string };
  /** Nollpunkten i zonens koordinater (m): modellens origo. */
  origin: [x: number, y: number];
  /** Nollpunktens höjd enligt platspaketet (m), för skissen tillbaka. */
  originZ?: number;
  /** Vridningen i grader, som Vrid i Höjdkurvor: zonens riktning (cos v, sin v) är modellens x-axel. */
  rotation: number;
  /** Meridiankonvergensen i utsnittets mitt (grader): sann nord är rutnätets nord vriden så mycket moturs. */
  trueNorth: number;
  /** Utsnittet i zonens koordinater (m). */
  extent: { xmin: number; ymin: number; xmax: number; ymax: number };
  /** Projektets ±0 i RH 2000 (m). */
  datum: number;
  grid?: SiteGrid;
  /** Höjdkurvornas avstånd i mm (förval 500). */
  contours?: number;
  /** Varifrån platsen kommer. */
  source: { id?: string; name?: string; kommun?: string; kalla?: string; created?: string; link?: string };
  /** Licenstexten, som ska följa med det som sparas och skrivs ut. */
  licence?: string;
  /** Varningen om fastighetsgränsernas läge. */
  boundaryWarning?: string;
  /** Förvalen för markobjekten (0.10.4); det som saknas tas ur `GROUND_DEFAULTS`. */
  ground?: Partial<GroundDefaults>;
  /** Medelmarknivån räknas mot den befintliga marken i stället för den färdiga (0.10.4). */
  meanOnExisting?: boolean;
  /** Jord under marklinjen i sektionerna (0.10.4). */
  earthHatch?: boolean;
}

/** Förvalen för markobjekten (0.10.4), i mm och som 1:N. */
export interface GroundDefaults {
  /** Släntens lutning 1:N. */
  slope: number;
  /** Fallet från huset 1:N. */
  fall: number;
  /** Hur långt ut från fasaden fallet gäller, mm. */
  fallLength: number;
  /** Hur långt ut markytan runt huset går, mm. */
  distance: number;
  /** Sockeln: från golvet ned till marken vid fasaden, mm. */
  sockel: number;
  /** Arbetsutrymmet runt bjälklaget i en urgrävning, mm. */
  margin: number;
  /** Brantaste ramp/väg 1:N (0.10.5): brantare ger en varning. Förval för vägens egen gräns sedan 0.10.7. */
  rampMax: number;
  /** Brantare än detta (1:N) behövs vilplan: gångvägens gräns. */
  walkMax: number;
  /** Höjdskillnaden en ramp får ha utan vilplan, mm. */
  landingRise: number;
  /** Hur långt marken tonas mot en höjdpunkt eller brytlinje, mm. */
  blend: number;
  /** Stödmurens tjocklek, mm. */
  wallThickness: number;
}

export const GROUND_DEFAULTS: GroundDefaults = { slope: 2, fall: 20, fallLength: 3000, distance: 3000, sockel: 200, margin: 500, rampMax: 12, walkMax: 20, landingRise: 500, blend: 5000, wallThickness: 200 };

/** Projektets förval för markobjekten. */
export function groundDefaults(site: Pick<Site, 'ground'> | undefined): GroundDefaults {
  return { ...GROUND_DEFAULTS, ...(site?.ground ?? {}) };
}

/** Förvalt avstånd mellan höjdkurvorna, mm. */
export const DEFAULT_CONTOURS = 500;
/** Avstånden som går att välja, mm. */
export const CONTOUR_STEPS = [250, 500, 1000] as const;

type V2 = readonly [number, number];

/** En punkt i zonens koordinater (m) i modellens (mm). */
export function zoneToLocal(site: Pick<Site, 'origin' | 'rotation'>, X: number, Y: number): [number, number] {
  const v = (site.rotation * Math.PI) / 180;
  const c = Math.cos(v);
  const s = Math.sin(v);
  const a = X - site.origin[0];
  const b = Y - site.origin[1];
  return [(a * c + b * s) * 1000, (-a * s + b * c) * 1000];
}

/** En punkt i modellen (mm) i zonens koordinater (m). */
export function localToZone(site: Pick<Site, 'origin' | 'rotation'>, x: number, y: number): [number, number] {
  const v = (site.rotation * Math.PI) / 180;
  const c = Math.cos(v);
  const s = Math.sin(v);
  const a = x / 1000;
  const b = y / 1000;
  return [site.origin[0] + a * c - b * s, site.origin[1] + a * s + b * c];
}

/** Riktningen mot sann nord i modellen, grader moturs från x-axeln (norrpilen). */
export function northOf(site: Pick<Site, 'rotation' | 'trueNorth'>): number {
  return Math.round((90 - site.rotation + site.trueNorth) * 1000) / 1000;
}

/** En höjd i modellen (mm från ±0) i RH 2000 (m). */
export function toRh(site: Pick<Site, 'datum'>, zMm: number): number {
  return site.datum + zMm / 1000;
}

/** En höjd (mm från ±0) som nivåkot: RH 2000 när projektet har en plats, annars från ±0 (*+62,400*). */
export function levelText(site: Pick<Site, 'datum'> | undefined, zMm: number): string {
  const m = site ? site.datum + zMm / 1000 : zMm / 1000;
  const r = Math.round(m * 1000) / 1000;
  return `${r === 0 ? '±' : r > 0 ? '+' : '−'}${Math.abs(r).toLocaleString('sv-SE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`;
}

/** En höjd i RH 2000 (m) i modellen (mm från ±0). */
export function fromRh(site: Pick<Site, 'datum'>, rh: number): number {
  return (rh - site.datum) * 1000;
}

// ---------------------------------------------------------------------------
// Rutnätet

/** Rutnätets höjder ur filen: Float32, little-endian, rad för rad från norr. */
export function decodeGrid(data: string, n: number): Float32Array {
  const bin = atob(data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const dv = new DataView(bytes.buffer);
  const out = new Float32Array(n);
  const m = Math.min(n, bytes.length >> 2);
  for (let i = 0; i < m; i++) out[i] = dv.getFloat32(i * 4, true);
  for (let i = m; i < n; i++) out[i] = NaN;
  return out;
}

/** Höjderna som base64, i samma form som platspaketet. */
export function encodeGrid(z: Float32Array): string {
  const bytes = new Uint8Array(z.length * 4);
  const dv = new DataView(bytes.buffer);
  for (let i = 0; i < z.length; i++) dv.setFloat32(i * 4, z[i], true);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Markmodellen: platsen, rutnätet och höjderna. */
export interface Terrain {
  site: Site;
  grid: SiteGrid;
  z: Float32Array;
  /** Lägsta och högsta höjd (m), utan NaN. */
  min: number;
  max: number;
}

let cached: { asset: Asset; grid: SiteGrid; z: Float32Array; min: number; max: number } | null = null;

/** Projektets markmodell, eller null utan platspaket med terräng. Höjderna avkodas en gång per fil. */
export function terrainOf(doc: Pick<ProjectDoc, 'site' | 'assets'>): Terrain | null {
  const site = doc.site;
  const grid = site?.grid;
  const asset = grid ? doc.assets[grid.asset] : undefined;
  if (!site || !grid || !asset) return null;
  if (!cached || cached.asset !== asset || cached.grid.W !== grid.W || cached.grid.H !== grid.H) {
    const z = decodeGrid(asset.data, grid.W * grid.H);
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < z.length; i++) {
      const h = z[i];
      if (h === h) {
        if (h < min) min = h;
        if (h > max) max = h;
      }
    }
    cached = { asset, grid, z, min, max };
  }
  return { site, grid, z: cached.z, min: cached.min, max: cached.max };
}

/** Markens höjd (RH 2000, m) i en punkt i zonens koordinater, bilinjärt. Null utanför eller där höjd saknas. */
export function heightAtZone(t: Pick<Terrain, 'grid' | 'z'>, X: number, Y: number): number | null {
  const { x0, y1, s, W, H } = t.grid;
  const fi = (X - x0) / s;
  const fj = (y1 - Y) / s;
  if (fi < 0 || fj < 0 || fi > W - 1 || fj > H - 1) return null;
  const i = Math.min(Math.floor(fi), W - 2);
  const j = Math.min(Math.floor(fj), H - 2);
  const u = fi - i;
  const w = fj - j;
  const z = t.z;
  const a = z[j * W + i];
  const b = z[j * W + i + 1];
  const c = z[(j + 1) * W + i];
  const d = z[(j + 1) * W + i + 1];
  if (a === a && b === b && c === c && d === d) return (a * (1 - u) + b * u) * (1 - w) + (c * (1 - u) + d * u) * w;
  // Där en nod saknar höjd: närmaste nod som har en.
  const near = [
    [a, (u + w) ** 2],
    [b, (1 - u + w) ** 2],
    [c, (u + 1 - w) ** 2],
    [d, (2 - u - w) ** 2],
  ].filter(([h]) => h === h);
  if (!near.length) return null;
  return near.reduce((p, q) => (q[1] < p[1] ? q : p))[0];
}

/** Markens höjd i modellen (mm från ±0) i en punkt i modellen, eller null. */
export function groundAt(t: Terrain, x: number, y: number): number | null {
  const [X, Y] = localToZone(t.site, x, y);
  const h = heightAtZone(t, X, Y);
  return h === null ? null : fromRh(t.site, h);
}

/**
 * Medelmarknivån (0.10.3) längs husets kontur, viktad efter fasadernas
 * längd: markhöjden längs konturen, medelvärdet per meter. I mm från ±0, eller
 * null utan mark under konturen. Varje ring räknas, också gårdar.
 */
export function meanGroundLevel(t: Terrain, rings: readonly (readonly V2[])[], step = 250): number | null {
  let sum = 0;
  let len = 0;
  for (const ring of rings) {
    const n = ring.length;
    for (let k = 0; k < n; k++) {
      const a = ring[k];
      const b = ring[(k + 1) % n];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (l < 1e-6) continue;
      const parts = Math.max(1, Math.ceil(l / step));
      for (let q = 0; q < parts; q++) {
        const f = (q + 0.5) / parts;
        const z = groundAt(t, a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f);
        if (z === null) continue;
        sum += z * (l / parts);
        len += l / parts;
      }
    }
  }
  return len > 0 ? sum / len : null;
}

// ---------------------------------------------------------------------------
// Höjdkurvor

export interface Contour {
  /** Höjden i RH 2000, m. */
  z: number;
  /** Punkterna i modellen, mm. */
  pts: [number, number][];
  closed: boolean;
}

/**
 * Höjdkurvorna (0.10.3) med `interval` mm mellan sig, i modellens
 * koordinater. Marching squares på rutnätet: bara de nivåer som går genom
 * en ruta prövas där, så att tiden följer antalet kurvor och inte antalet
 * nivåer gånger rutorna. Kanterna har nummer, så att bitarna fogas ihop till
 * långa linjer.
 */
export function contours(t: Terrain, interval: number): Contour[] {
  const { W, H, x0, y1, s } = t.grid;
  const z = t.z;
  const step = interval / 1000;
  if (!(step > 0) || !(t.max >= t.min)) return [];
  const first = Math.ceil(t.min / step);
  // Nivå k: höjden k·step. Nivåer exakt på en nod flyttas en aning, så att varje fall är entydigt.
  const bump = (h: number, lv: number) => (h === lv ? h + 1e-7 : h);
  const levels = new Map<number, { seg: number[]; pt: Map<number, [number, number]> }>();
  const edge = {
    h: (i: number, j: number) => j * W + i,
    v: (i: number, j: number) => W * H + j * W + i,
  };
  for (let j = 0; j < H - 1; j++) {
    for (let i = 0; i < W - 1; i++) {
      const a = z[j * W + i];
      const b = z[j * W + i + 1];
      const d = z[(j + 1) * W + i];
      const c = z[(j + 1) * W + i + 1];
      if (!(a === a && b === b && c === c && d === d)) continue;
      const lo = Math.min(a, b, c, d);
      const hi = Math.max(a, b, c, d);
      for (let k = Math.max(first, Math.ceil(lo / step)); k * step <= hi; k++) {
        const lv = k * step;
        const A = bump(a, lv) > lv ? 1 : 0;
        const B = bump(b, lv) > lv ? 2 : 0;
        const C = bump(c, lv) > lv ? 4 : 0;
        const D = bump(d, lv) > lv ? 8 : 0;
        const kase = A | B | C | D;
        if (kase === 0 || kase === 15) continue;
        let L = levels.get(k);
        if (!L) levels.set(k, (L = { seg: [], pt: new Map() }));
        // Kanterna: topp a–b, höger b–c, botten d–c, vänster a–d (j ökar söderut).
        const top = edge.h(i, j);
        const right = edge.v(i + 1, j);
        const bottom = edge.h(i, j + 1);
        const left = edge.v(i, j);
        const put = (e: number, p: number, q: number, ii: number, jj: number, horiz: boolean) => {
          if (L!.pt.has(e)) return;
          const f = (lv - p) / (q - p);
          const X = x0 + (ii + (horiz ? f : 0)) * s;
          const Y = y1 - (jj + (horiz ? 0 : f)) * s;
          L!.pt.set(e, zoneToLocal(t.site, X, Y));
        };
        put(top, a, b, i, j, true);
        put(right, b, c, i + 1, j, false);
        put(bottom, d, c, i, j + 1, true);
        put(left, a, d, i, j, false);
        const crossed = (p: number, q: number) => (bump(p, lv) > lv) !== (bump(q, lv) > lv);
        const ends: number[] = [];
        if (crossed(a, b)) ends.push(top);
        if (crossed(b, c)) ends.push(right);
        if (crossed(d, c)) ends.push(bottom);
        if (crossed(a, d)) ends.push(left);
        if (ends.length === 2) L.seg.push(ends[0], ends[1]);
        else if (ends.length === 4) {
          // Sadel: mitten avgör vilka hörn som hör ihop.
          const mid = (a + b + c + d) / 4 > lv;
          if (mid === !!A) L.seg.push(top, right, bottom, left);
          else L.seg.push(top, left, right, bottom);
        }
      }
    }
  }
  const out: Contour[] = [];
  for (const [k, L] of levels) {
    const by = new Map<number, number[]>();
    for (let n = 0; n < L.seg.length; n++) {
      const list = by.get(L.seg[n]);
      if (list) list.push(n >> 1);
      else by.set(L.seg[n], [n >> 1]);
    }
    const used = new Uint8Array(L.seg.length >> 1);
    const other = (sg: number, e: number) => (L.seg[sg * 2] === e ? L.seg[sg * 2 + 1] : L.seg[sg * 2]);
    const walk = (from: number, start: number): number[] => {
      const chain: number[] = [];
      let e = from;
      let sg = start;
      for (;;) {
        used[sg] = 1;
        e = other(sg, e);
        chain.push(e);
        const next = (by.get(e) ?? []).find((q) => !used[q]);
        if (next === undefined) break;
        sg = next;
      }
      return chain;
    };
    for (let sg = 0; sg < used.length; sg++) {
      if (used[sg]) continue;
      const e0 = L.seg[sg * 2];
      const fwd = walk(e0, sg);
      const closed = fwd[fwd.length - 1] === e0;
      let chain = [e0, ...fwd];
      if (!closed) {
        // Fortsätt åt andra hållet från början.
        const back = (by.get(e0) ?? []).find((q) => !used[q]);
        if (back !== undefined) chain = [...walk(e0, back).reverse(), ...chain];
      } else chain.pop();
      const pts = chain.map((e) => L.pt.get(e)!).filter(Boolean);
      if (pts.length >= 2) out.push({ z: Math.round(k * step * 1000) / 1000, pts, closed });
    }
  }
  return out;
}

/** Ett mindre utsnitt av rutnätet: noderna inom rutan (zonens m). Null om rutan inte täcker rutnätet. */
export function cropGrid(t: Pick<Terrain, 'grid' | 'z'>, box: { xmin: number; ymin: number; xmax: number; ymax: number }): { grid: Omit<SiteGrid, 'asset'>; z: Float32Array } | null {
  const { x0, y1, s, W, H } = t.grid;
  const i0 = Math.max(0, Math.floor((box.xmin - x0) / s));
  const i1 = Math.min(W - 1, Math.ceil((box.xmax - x0) / s));
  const j0 = Math.max(0, Math.floor((y1 - box.ymax) / s));
  const j1 = Math.min(H - 1, Math.ceil((y1 - box.ymin) / s));
  if (i1 - i0 < 1 || j1 - j0 < 1) return null;
  const w = i1 - i0 + 1;
  const h = j1 - j0 + 1;
  const z = new Float32Array(w * h);
  for (let j = 0; j < h; j++) z.set(t.z.subarray((j0 + j) * W + i0, (j0 + j) * W + i0 + w), j * w);
  return { grid: { x0: x0 + i0 * s, y1: y1 - j0 * s, s, W: w, H: h }, z };
}
