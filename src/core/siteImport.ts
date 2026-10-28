import { newId } from './ids';
import { SITE_STOREY, withSiteLast, type Asset, type Element, type ProjectDoc } from './model';
import { cropGrid, decodeGrid, encodeGrid, heightAtZone, northOf, terrainOf, zoneToLocal, type Site } from './site';
import type { DocStore, TxBuilder } from './store';

/**
 * Platspaketet ur Höjdkurvor (0.10.3), version 1: läsa, kontrollera och
 * lägga in i ett projekt. Formatet står i `docs/UTBYTE-CAD-APA.md` i
 * hojdkurvor-repot. Fält som saknas betyder att användaren inte valde dem;
 * okända fält hoppas över.
 */

export const PACKAGE_FORMAT = 'hojdkurvor-plats';
export const PACKAGE_VERSION = 1;
/** Typen på filen som rutnätets höjder sparas i. */
export const GRID_MIME = 'application/x-hojdkurvor-terrang';

type XY = [number, number];

export interface Platspaket {
  format: string;
  version: number;
  skapad?: string;
  kalla?: string;
  projekt?: { id?: string; namn?: string; kommun?: string };
  koordinatsystem: { plan: { epsg: number; namn: string }; hojd?: string; enhet?: string };
  utsnitt: { xmin: number; ymin: number; xmax: number; ymax: number };
  nollpunkt: { x: number; y: number; z?: number };
  vridning?: number;
  sannNord?: number;
  terrang?: { rutnat?: { x0: number; y1: number; s: number; W: number; H: number; z: string } };
  trad?: { x: number; y: number; mark?: number | null; hojd?: number | null; krona?: number | null }[];
  vagar?: { typ?: string; namn?: string | null; pts: XY[] }[];
  stompunkter?: { namn?: string; x: number; y: number; z?: number | null }[];
  byggnader?: { id?: string; typ?: string; andamal?: string[]; husnummer?: string | null; namn?: string | null; fotavtryck: XY[]; mark?: number | null; hojd?: number | null }[];
  fastigheter?: {
    granser?: { typ?: string; osakerhet?: number | null; pts: XY[] }[];
    punkter?: { x: number; y: number }[];
    ytor?: { beteckning?: string; etikett?: string; ankare?: XY | null }[];
    varning?: string;
  };
  lankar?: { projekt?: string };
  licens?: string;
}

export class SitePackageError extends Error {}

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Läs ett platspaket ur text eller ett redan läst objekt. Kastar `SitePackageError` med en förklaring. */
export function parseSitePackage(input: string | unknown): Platspaket {
  let d: any = input;
  if (typeof input === 'string') {
    try {
      d = JSON.parse(input);
    } catch {
      throw new SitePackageError('Filen gick inte att läsa som JSON.');
    }
  }
  if (d?.format !== PACKAGE_FORMAT) throw new SitePackageError('Filen är inte en platsfil från Höjdkurvor.');
  if (!(Number(d.version) <= PACKAGE_VERSION)) throw new SitePackageError(`Platsfilen är version ${d.version}; den här versionen av programmet läser version ${PACKAGE_VERSION}. Ladda om sidan för att hämta den senaste.`);
  const u = d.utsnitt;
  const o = d.nollpunkt;
  if (!u || !num(u.xmin) || !num(u.ymin) || !num(u.xmax) || !num(u.ymax)) throw new SitePackageError('Platsfilen saknar utsnitt.');
  if (!o || !num(o.x) || !num(o.y)) throw new SitePackageError('Platsfilen saknar nollpunkt.');
  if (!num(d.koordinatsystem?.plan?.epsg)) throw new SitePackageError('Platsfilen saknar koordinatsystem.');
  const g = d.terrang?.rutnat;
  if (g && !(num(g.x0) && num(g.y1) && num(g.s) && g.s > 0 && num(g.W) && num(g.H) && g.W >= 2 && g.H >= 2 && typeof g.z === 'string')) {
    throw new SitePackageError('Markmodellen i platsfilen är trasig.');
  }
  return d as Platspaket;
}

/** Om projektet redan har en plats ur samma utsnitt i Höjdkurvor. */
export function sameSite(doc: ProjectDoc, pkg: Platspaket): boolean {
  return !!doc.site && !!pkg.projekt?.id && doc.site.source.id === pkg.projekt.id;
}

/** Ett namn för ett nytt projekt med platsen. */
export function siteProjectName(pkg: Platspaket): string {
  return pkg.projekt?.namn?.trim() || (pkg.projekt?.kommun ? `Plats i ${pkg.projekt.kommun}` : 'Ny plats');
}

/**
 * Lägg in platsen i projektet i en transaktion. Har projektet redan en
 * plats i samma koordinatsystem behålls dess nollpunkt, vridning och ±0,
 * så att huset står kvar; det som kom med den gamla platsen byts ut. Annars
 * blir paketets nollpunkt modellens origo och ±0 markens höjd mitt i
 * utsnittet, avrundad till decimeter.
 */
export function applySitePackage(store: DocStore, pkg: Platspaket): void {
  store.transact('Lägg in platsen', (tx) => putSite(tx, pkg));
}

function putSite(tx: TxBuilder, pkg: Platspaket): void {
  const doc = tx.doc;
  const old = doc.site;
  const epsg = pkg.koordinatsystem.plan.epsg;
  const keep = old && old.crs.epsg === epsg;
  const g = pkg.terrang?.rutnat;

  // Det som kom med den gamla platsen.
  for (const el of Object.values(doc.elements)) if (SITE_ELEMENT_TYPES.has(el.type)) tx.removeElement(el.id);
  if (old?.grid) tx.removeAsset(old.grid.asset);

  const frame = keep ? { origin: old.origin, rotation: old.rotation } : { origin: [pkg.nollpunkt.x, pkg.nollpunkt.y] as XY, rotation: num(pkg.vridning) ? pkg.vridning : 0 };
  let grid: Site['grid'];
  let asset: Asset | undefined;
  if (g) {
    asset = { id: newId('mark'), name: `${siteProjectName(pkg)} – markmodell`, mime: GRID_MIME, data: g.z };
    grid = { asset: asset.id, x0: g.x0, y1: g.y1, s: g.s, W: Math.round(g.W), H: Math.round(g.H) };
    tx.putAsset(asset);
  }
  const u = pkg.utsnitt;
  let datum = keep ? old.datum : num(pkg.nollpunkt.z) && pkg.nollpunkt.z !== 0 ? pkg.nollpunkt.z : 0;
  if (!keep && grid && asset) {
    const z = decodeGrid(asset.data, grid.W * grid.H);
    const mid = heightAtZone({ grid, z }, (u.xmin + u.xmax) / 2, (u.ymin + u.ymax) / 2);
    if (mid !== null) datum = Math.round(mid * 10) / 10;
  }
  const site: Site = {
    crs: { epsg, name: pkg.koordinatsystem.plan.namn ?? `EPSG:${epsg}`, height: pkg.koordinatsystem.hojd ?? 'RH 2000' },
    origin: [frame.origin[0], frame.origin[1]],
    ...(num(pkg.nollpunkt.z) ? { originZ: pkg.nollpunkt.z } : {}),
    rotation: frame.rotation,
    trueNorth: num(pkg.sannNord) ? pkg.sannNord : 0,
    extent: { xmin: u.xmin, ymin: u.ymin, xmax: u.xmax, ymax: u.ymax },
    datum,
    ...(grid ? { grid } : {}),
    ...(old?.contours ? { contours: old.contours } : {}),
    source: {
      ...(pkg.projekt?.id ? { id: pkg.projekt.id } : {}),
      ...(pkg.projekt?.namn ? { name: pkg.projekt.namn } : {}),
      ...(pkg.projekt?.kommun ? { kommun: pkg.projekt.kommun } : {}),
      ...(pkg.kalla ? { kalla: pkg.kalla } : {}),
      ...(pkg.skapad ? { created: pkg.skapad } : {}),
      ...(pkg.lankar?.projekt ? { link: pkg.lankar.projekt } : {}),
    },
    ...(pkg.licens ? { licence: pkg.licens } : {}),
    ...(pkg.fastigheter?.varning ? { boundaryWarning: pkg.fastigheter.varning } : {}),
  };
  tx.setField('site', site);

  // Platsens objekt hör till Platsen (0.10.25).
  if (!doc.storeys.some((s) => s.site)) tx.setStoreys(withSiteLast(doc.storeys));
  const storey = SITE_STOREY;
  const L = (p: readonly number[]): XY => {
    const q = zoneToLocal(site, p[0], p[1]);
    return [Math.round(q[0]), Math.round(q[1])];
  };
  const put = (type: string, params: Record<string, unknown>) =>
    tx.putElement({ id: newId('plats'), type, storey, states: doc.states.map((s) => s.id), tags: [], locked: true, params, props: {} } as Element);

  if (grid) put('Terrain', {});
  for (const b of pkg.byggnader ?? []) {
    if (!Array.isArray(b.fotavtryck) || b.fotavtryck.length < 3) continue;
    const label = [b.andamal?.[0] ?? b.typ, b.husnummer ? `nr ${b.husnummer}` : '', b.namn ?? ''].filter(Boolean).join(', ');
    put('SiteBuilding', { points: b.fotavtryck.map(L), mark: num(b.mark) ? b.mark : null, height: num(b.hojd) ? b.hojd : null, ...(label ? { label } : {}) });
  }
  for (const t of pkg.trad ?? []) {
    if (!num(t.x) || !num(t.y)) continue;
    put('Tree', { pos: L([t.x, t.y]), crown: Math.round((num(t.krona) ? t.krona : 5) * 1000), height: Math.round((num(t.hojd) ? t.hojd : 12) * 1000), mark: num(t.mark) ? t.mark : null });
  }
  for (const v of pkg.vagar ?? []) if (Array.isArray(v.pts) && v.pts.length >= 2) put('SiteMap', { kind: 'road', points: v.pts.map(L), ...(v.namn ? { text: v.namn } : {}) });
  const f = pkg.fastigheter;
  for (const b of f?.granser ?? []) if (Array.isArray(b.pts) && b.pts.length >= 2) put('SiteMap', { kind: 'boundary', points: b.pts.map(L), uncertainty: num(b.osakerhet) ? b.osakerhet : null });
  for (const p of f?.punkter ?? []) if (num(p.x) && num(p.y)) put('SiteMap', { kind: 'point', pos: L([p.x, p.y]) });
  for (const y of f?.ytor ?? []) if (y.ankare && (y.etikett || y.beteckning)) put('SiteMap', { kind: 'label', pos: L(y.ankare), text: y.etikett || y.beteckning });
  for (const s of pkg.stompunkter ?? []) if (num(s.x) && num(s.y)) put('SiteMap', { kind: 'benchmark', pos: L([s.x, s.y]), ...(s.namn ? { text: s.namn } : {}), ...(num(s.z) ? { z: s.z } : {}) });

  // Norrpilen mot sann nord.
  for (const el of Object.values(doc.elements)) if (el.type === 'North') tx.putElement({ ...el, params: { ...el.params, angle: northOf(site) } });
}

/** Typerna som kommer med platsen (samma som `SITE_TYPES` i elements/site.ts, som kärnan inte får importera). */
const SITE_ELEMENT_TYPES: ReadonlySet<string> = new Set(['Terrain', 'SiteBuilding', 'Tree', 'SiteMap']);

/** Ändra platsens ±0, höjdkurvornas avstånd eller annat i huvudet. */
export function updateSite(store: DocStore, patch: Partial<Pick<Site, 'datum' | 'contours' | 'ground' | 'meanOnExisting' | 'earthHatch' | 'earthWhite'>>, label = 'Ändra platsen'): void {
  const site = store.doc.site;
  if (!site) return;
  store.transact(label, (tx) => tx.setField('site', { ...site, ...patch }));
}

/** Ta bort platsen och allt som kom med den. Norrpilen står kvar. */
export function removeSite(store: DocStore): void {
  const site = store.doc.site;
  if (!site) return;
  store.transact('Ta bort platsen', (tx) => {
    for (const el of Object.values(tx.doc.elements)) if (SITE_ELEMENT_TYPES.has(el.type)) tx.removeElement(el.id);
    if (site.grid) tx.removeAsset(site.grid.asset);
    tx.setField('site', undefined);
  });
}

/**
 * Beskär markmodellen till rutan (modellens mm) och det som kom med platsen
 * till det som berör den. Rutan räknas om till zonens koordinater, med
 * vridningen. Ger false om rutan inte täcker markmodellen.
 */
export function cropSite(store: DocStore, box: { minX: number; minY: number; maxX: number; maxY: number }): boolean {
  const doc = store.doc;
  const t = terrainOf(doc);
  const site = doc.site;
  if (!t || !site) return false;
  const v = (site.rotation * Math.PI) / 180;
  const corners = [
    [box.minX, box.minY],
    [box.maxX, box.minY],
    [box.maxX, box.maxY],
    [box.minX, box.maxY],
  ].map(([x, y]) => [site.origin[0] + (x / 1000) * Math.cos(v) - (y / 1000) * Math.sin(v), site.origin[1] + (x / 1000) * Math.sin(v) + (y / 1000) * Math.cos(v)]);
  const zb = { xmin: Math.min(...corners.map((c) => c[0])), ymin: Math.min(...corners.map((c) => c[1])), xmax: Math.max(...corners.map((c) => c[0])), ymax: Math.max(...corners.map((c) => c[1])) };
  const c = cropGrid(t, zb);
  if (!c) return false;
  const inside = (q: readonly number[]) => q[0] >= box.minX && q[0] <= box.maxX && q[1] >= box.minY && q[1] <= box.maxY;
  store.transact('Beskär platsen', (tx) => {
    const asset: Asset = { ...doc.assets[t.grid.asset], id: newId('mark'), data: encodeGrid(c.z) };
    tx.removeAsset(t.grid.asset);
    tx.putAsset(asset);
    tx.setField('site', {
      ...site,
      grid: { asset: asset.id, ...c.grid },
      extent: { xmin: Math.max(site.extent.xmin, zb.xmin), ymin: Math.max(site.extent.ymin, zb.ymin), xmax: Math.min(site.extent.xmax, zb.xmax), ymax: Math.min(site.extent.ymax, zb.ymax) },
    });
    for (const el of Object.values(doc.elements)) {
      if (!SITE_ELEMENT_TYPES.has(el.type) || el.type === 'Terrain') continue;
      const p = el.params as { pos?: number[]; points?: number[][] };
      const pts = p.points ?? (p.pos ? [p.pos] : []);
      if (pts.length && !pts.some(inside)) tx.removeElement(el.id);
    }
  });
  return true;
}
