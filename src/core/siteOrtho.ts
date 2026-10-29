import { newId } from './ids';
import type { Asset } from './model';
import type { Site, SiteOrtho } from './site';
import type { DocStore, TxBuilder } from './store';

/**
 * Ortofotot på platsen (0.10.31): läget ur en världsfil eller ur
 * platspaketet, bildens koordinater för 3D-vyn och att lägga in och ta bort
 * det. Bilden är parallell med zonens axlar; modellen kan vara vriden mot
 * zonen (`site.rotation`), så 3D-vyn får en affin avbildning från modellens
 * mm till bildens 0–1.
 *
 * Ren matematik och data, utan ritning eller gränssnitt.
 */

/** Platspaketets ortofoto (Höjdkurvor, valfritt): pixelns mitt i hörnet uppe till vänster, som i en världsfil. */
export interface PaketOrtofoto {
  /** Bilden som data-URL (`data:image/jpeg;base64,…`). */
  bild: string;
  x0: number;
  y1: number;
  s: number;
  W: number;
  H: number;
  ar?: number;
}

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** En världsfils sex tal (A, D, B, E, C, F), eller null om den inte går att läsa eller bilden är vriden. */
export function parseWorldFile(text: string): { s: number; x: number; y: number } | null {
  const v = text
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => Number(t.replace(',', '.')));
  if (v.length < 6 || v.some((n) => !Number.isFinite(n))) return null;
  const [a, d, b, e, c, f] = v;
  // Vriden eller skev bild, eller olika pixelstorlek på ledderna: inte en bild ur Höjdkurvor.
  if (Math.abs(d) > 1e-9 || Math.abs(b) > 1e-9 || a <= 0 || Math.abs(a + e) > a * 1e-6) return null;
  return { s: a, x: c, y: f };
}

/**
 * Läget för en bild med världsfilen `w` och storleken `W` × `H` pixlar.
 * Höjdkurvors zip har två världsfiler: `_sweref` (zonens koordinater) och
 * `_lokal` (meter från nollpunkten, utan vridning). Hamnar bilden inte över
 * platsen i zonens koordinater läses de som lokala.
 */
export function orthoFromWorld(w: { s: number; x: number; y: number }, W: number, H: number, site: Pick<Site, 'origin' | 'extent'>): Omit<SiteOrtho, 'asset'> {
  const at = (x: number, y: number) => ({ x0: x - w.s / 2, y1: y + w.s / 2, s: w.s, W: Math.round(W), H: Math.round(H) });
  const zone = at(w.x, w.y);
  return orthoTouchesSite(zone, site) ? zone : at(w.x + site.origin[0], w.y + site.origin[1]);
}

/** Om ortofotot ligger över platsens utsnitt alls. */
export function orthoTouchesSite(o: Omit<SiteOrtho, 'asset'>, site: Pick<Site, 'extent'>): boolean {
  const e = site.extent;
  return o.x0 < e.xmax && o.x0 + o.W * o.s > e.xmin && o.y1 > e.ymin && o.y1 - o.H * o.s < e.ymax;
}

/**
 * Avbildningen från modellens mm (x, y) till bildens (u, v), 0–1 med v
 * uppåt från bildens nedre kant, som nio tal radvis (en 3 × 3-matris för
 * texturen i three.js).
 */
export function orthoUvMatrix(site: Pick<Site, 'origin' | 'rotation'>, o: Omit<SiteOrtho, 'asset'>): number[] {
  const v = (site.rotation * Math.PI) / 180;
  const c = Math.cos(v);
  const s = Math.sin(v);
  const w = o.W * o.s;
  const h = o.H * o.s;
  const bottom = o.y1 - h;
  // Zonen: X = ox + (c·x − s·y)/1000, Y = oy + (s·x + c·y)/1000.
  return [c / 1000 / w, -s / 1000 / w, (site.origin[0] - o.x0) / w, s / 1000 / h, c / 1000 / h, (site.origin[1] - bottom) / h, 0, 0, 1];
}

/** Platspaketets ortofoto som fil och läge, eller null om det saknas eller är trasigt. */
export function orthoFromPackage(p: PaketOrtofoto | undefined, name: string): { asset: Asset; ortho: Omit<SiteOrtho, 'asset'> } | null {
  if (!p || typeof p.bild !== 'string' || !num(p.x0) || !num(p.y1) || !num(p.s) || !(p.s > 0) || !num(p.W) || !num(p.H) || p.W < 1 || p.H < 1) return null;
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/s.exec(p.bild);
  if (!m) return null;
  const asset: Asset = { id: newId('orto'), name: `${name} – ortofoto`, mime: m[1], data: m[2] };
  return { asset, ortho: { x0: p.x0 - p.s / 2, y1: p.y1 + p.s / 2, s: p.s, W: Math.round(p.W), H: Math.round(p.H), ...(num(p.ar) && p.ar > 0 ? { year: p.ar } : {}) } };
}

/** Byt platsens ortofoto i en transaktion (null tar bort det). Den gamla bilden tas bort. */
export function putOrtho(tx: TxBuilder, site: Site, next: { asset: Asset; ortho: Omit<SiteOrtho, 'asset'> } | null): Site {
  if (site.ortho) tx.removeAsset(site.ortho.asset);
  const out = { ...site };
  delete out.ortho;
  if (next) {
    tx.putAsset(next.asset);
    out.ortho = { ...next.ortho, asset: next.asset.id, ...(site.ortho?.show ? { show: site.ortho.show } : {}) };
  }
  tx.setField('site', out);
  return out;
}

/** Lägg in eller ta bort platsens ortofoto. */
export function setSiteOrtho(store: DocStore, next: { asset: Asset; ortho: Omit<SiteOrtho, 'asset'> } | null): void {
  const site = store.doc.site;
  if (!site) return;
  store.transact(next ? 'Lägg in ortofoto' : 'Ta bort ortofotot', (tx) => putOrtho(tx, site, next));
}

/** Var ortofotot syns i 3D. */
export function orthoShowOf(site: Site | undefined): 'base' | 'all' | 'off' {
  return site?.ortho?.show ?? 'base';
}
