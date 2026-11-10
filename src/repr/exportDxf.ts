import { activeMap, isSb11List, layerDef, listLayers, nearestLayer, penColor, sb11Name, simpleName, TEMPLATE_LINETYPES, type DxfSettings, type LayerDef, type LayerQuery, type Status } from '../core/dxfLayers';
import type { Color, FillDef } from '../core/graphics';
import { lineTypeList } from '../core/lineTypes';
import { isSite, type Element, type Id, type ProjectDoc, type ViewDef } from '../core/model';
import { profileObjectPrefix } from '../core/profileTypes';
import { actionOf, existingState, type ViewStates } from '../core/states';
import { hatchAsPattern, resolveFill } from '../core/fillTypes';
import { resolveParams } from '../elements/registry';
import { isFixed, type FurnitureParams } from '../elements/furniture';
import { outsideSide } from '../elements/wallSides';
import type { WallParams } from '../elements/wallBodies';
import { lineweightOf, writeDxf, type DxfEntity, type DxfLayer, type DxfLinetype, type DxfPoint, type DxfVersion } from '../formats/dxfWrite';
import { DXF_CAP_HEIGHT } from '../formats/dxfText';
import { fontOf } from '../formats/fonts';
import type { Pen, Primitive, Vec2 } from './primitives';
import { boxOf, boxesTouch, intersection, type Rings } from '../geometry/boolean';
import { ownedOutlines } from './outlineOwners';
import { buildSheet, cachedViewPrims, viewSource, viewStatesFor } from './sheet';
import { workStampPrims } from './exportPages';

/**
 * Blad och vyer som DXF (0.12.1). Vyerna i modellens koordinater i mm
 * (lokal nolla, `$INSUNITS` 4) med texter och linjetyper skalade till vyns
 * skala, som i Archicad; bladen platta i pappers-mm. Primitiverna blir
 * LINE, ARC, CIRCLE, LWPOLYLINE, TEXT och HATCH (solida ytor och
 * skrafferingarnas linjefamiljer), på lager ur stilbokens lagerkarta
 * (`dxfLayers.ts`).
 *
 * Färgen följer pennan (tjockleken), som i svensk praxis, och tjockleken
 * står också som linjetjocklek; när lagret har samma penna och linjetyp
 * följer linjen lagret (BYLAYER). Bilder (underlag, loggor) följer inte med.
 */

export interface DxfExportOptions {
  version: DxfVersion;
  today: string;
  workStamp?: boolean;
  autoDims?: boolean;
}

export interface DxfResult {
  bytes: Uint8Array;
  /** Bilder som inte kom med. */
  images: number;
  layers: number;
}

/** Varifrån en primitiv kommer: vyns tillstånd (för statusen), eller bladet. */
interface Source {
  states?: ViewStates;
}

const sameDash = (a: readonly number[] | undefined, b: readonly number[] | undefined) => (a?.length ?? 0) === (b?.length ?? 0) && (a ?? []).every((x, i) => Math.abs(x - b![i]) < 1e-6);

/** Färgen som RGB-tal, och om den är vit (papperets: maskar, som DXF inte har). */
function rgbOf(c: Color | 'muted' | 'accent' | undefined): { rgb: number; white: boolean } {
  if (!c || c === 'ink' || c === 'accent') return { rgb: 0, white: false };
  if (c === 'paper') return { rgb: 0xffffff, white: true };
  if (c === 'muted') return { rgb: 0x8c8c8c, white: false };
  let h = c.replace('#', '');
  if (h.length === 3 || h.length === 4) h = [...h.slice(0, 3)].map((x) => x + x).join('');
  const v = parseInt(h.slice(0, 6), 16);
  if (!Number.isFinite(v)) return { rgb: 0, white: false };
  const [r, g, b] = [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  return { rgb: v, white: r > 245 && g > 245 && b > 245 };
}

/** Närmaste ACI-färg för en RGB-färg bland de grå och grundfärgerna. */
function aciOf(rgb: number): number {
  const [r, g, b] = [(rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255];
  const table: [number, number, number, number][] = [
    [1, 255, 0, 0],
    [2, 255, 255, 0],
    [3, 0, 255, 0],
    [4, 0, 255, 255],
    [5, 0, 0, 255],
    [6, 255, 0, 255],
    [7, 0, 0, 0],
    [8, 128, 128, 128],
    [9, 192, 192, 192],
    [250, 51, 51, 51],
    [251, 80, 80, 80],
    [252, 105, 105, 105],
    [253, 130, 130, 130],
    [254, 190, 190, 190],
    [30, 255, 127, 0],
    [40, 255, 191, 0],
    [140, 0, 191, 255],
    [52, 165, 124, 0],
    [94, 0, 165, 0],
  ];
  let best = 7;
  let d = Infinity;
  for (const [i, tr, tg, tb] of table) {
    const e = (tr - r) ** 2 + (tg - g) ** 2 + (tb - b) ** 2;
    if (e < d) [best, d] = [i, e];
  }
  return best;
}

/** Typsnittsfilen för textstilen: ett som finns i AutoCAD när appens eget inte gör det. */
function fontFile(doc: ProjectDoc): string {
  const f = fontOf(doc);
  if (f.id === 'osifont') return 'isocp.shx';
  if (f.id === 'arimo') return 'arial.ttf';
  if (f.id === 'josefin') return 'JosefinSans-Regular.ttf';
  return doc.assets[f.id]?.name ?? 'arial.ttf';
}

type StrokeGeo =
  | { kind: 'line'; a: DxfPoint; b: DxfPoint }
  | { kind: 'poly'; points: readonly DxfPoint[]; closed: boolean }
  | { kind: 'arc'; center: DxfPoint; radius: number; start: number; end: number }
  | { kind: 'circle'; center: DxfPoint; radius: number };

class Builder {
  readonly entities: DxfEntity[] = [];
  readonly layers = new Map<string, DxfLayer>();
  readonly linetypes = new Map<string, DxfLinetype>();
  images = 0;
  private readonly doc: ProjectDoc;
  private readonly settings: DxfSettings | undefined;
  private readonly map: ReturnType<typeof activeMap>;
  private readonly own: Map<string, LayerDef> | undefined;
  private readonly ownSb11: boolean;
  private readonly named: { name: string; dash: number[] }[];
  private readonly elInfo = new Map<Id, Partial<LayerQuery>>();
  private readonly v2018: boolean;
  /** Mm i filen per mm på papperet: vyns skala, 1 på bladen. */
  private readonly k: number;

  constructor(doc: ProjectDoc, version: DxfVersion, k: number) {
    this.doc = doc;
    this.k = k;
    this.v2018 = version === 'R2018';
    this.settings = doc.graphics.export?.dxf;
    this.map = activeMap(this.settings);
    this.own = this.map === 'custom' ? new Map(this.settings!.custom!.layers.map((l) => [l.name, l])) : undefined;
    this.ownSb11 = !!this.own && isSb11List([...this.own.values()]);
    // Linjetyperna som kan få ett namn: mallens och stilbokens (stilbokens först, med sina svenska namn).
    const own = this.settings?.custom?.linetypes ?? [];
    this.named = [...lineTypeList(doc.graphics).filter((t) => t.dash.length).map((t) => ({ name: t.name, dash: t.dash })), ...[...TEMPLATE_LINETYPES, ...own].map((t) => ({ name: t.name, dash: t.pattern }))];
    for (const t of [...TEMPLATE_LINETYPES, ...own]) this.linetypes.set(t.name, { name: t.name, desc: t.desc, pattern: t.pattern });
  }

  /** Det lagret beror på hos objektet (yttervägg, bärande, fast inredning …), en gång per objekt. */
  private info(id: Id | undefined): Partial<LayerQuery> {
    if (!id) return {};
    const hit = this.elInfo.get(id);
    if (hit) return hit;
    const doc = this.doc;
    const el = doc.elements[id];
    const out: Partial<LayerQuery> = {};
    if (el) {
      out.site = isSite(el.storey);
      const wall: Element | undefined = el.type === 'Wall' ? el : el.host ? doc.elements[el.host] : undefined;
      if (wall?.type === 'Wall') {
        out.exterior = outsideSide(doc, wall) !== null;
        const lb = resolveParams<WallParams & { loadBearing?: boolean }>(doc, wall).loadBearing;
        out.loadBearing = lb ?? out.exterior;
      }
      if (el.type === 'BasisFacade') out.exterior = out.loadBearing = true;
      if (el.type === 'Furniture') out.fixed = isFixed(resolveParams<FurnitureParams>(doc, el));
      if (el.type === 'Profile') out.profile = profileObjectPrefix(el.definition ? (doc.definitions[el.definition]?.profile?.group ?? '') : '', (el.params as { path?: string }).path === 'plumb');
    }
    this.elInfo.set(id, out);
    return out;
  }

  /** Statusen: åtgärden mot befintligt när projektet har ett, annars ingen. */
  private status(id: Id | undefined, src: Source): Status {
    const el = id ? this.doc.elements[id] : undefined;
    const ex = existingState(this.doc);
    if (!el || !src.states || !ex) return '-';
    if (src.states.state === ex.id) return el.states.includes(ex.id) ? 'E' : '-';
    const a = actionOf(el, { ...src.states, compareTo: ex.id });
    return a === 'new' ? 'N' : a === 'existing' ? 'E' : a === 'demolished' ? 'R' : '-';
  }

  /** Lagret för en primitiv, och lagret i tabellen. */
  private layerOf(p: Primitive, src: Source, pen: Pen | null): DxfLayer {
    const o = p.origin;
    const q: LayerQuery = {
      type: o?.objectType,
      part: o?.part,
      sheet: !src.states,
      cut: (p.kind === 'region' && p.role === 'cut') || (p.kind === 'polyline' && !!p.asOutline),
      dashed: !!pen?.dash?.length,
      region: p.kind === 'region',
      status: this.status(o?.objectId, src),
      ...this.info(o?.objectId),
    };
    let name: string;
    if (this.map === 'simple') name = simpleName(q);
    else if (this.map === 'custom' && this.ownSb11) name = nearestLayer(sb11Name(q, true), this.own!) ?? '0';
    else name = sb11Name(q, this.map === 'sb11full' || this.map === 'custom');
    let layer = this.layers.get(name);
    if (!layer) {
      const def = this.map === 'simple' ? { name, color: 7, lineweight: -3 } : layerDef(name, this.own);
      layer = { ...def };
      this.layers.set(name, layer);
    }
    return layer;
  }

  /** Linjetypens namn för ett streckmönster (på papper i mm), och definitionen om den behövs. */
  private linetype(dash: readonly number[] | undefined): string {
    if (!dash?.length) return 'Continuous';
    const hit = this.named.find((t) => sameDash(t.dash, dash));
    const name = hit?.name ?? `CA-${dash.map((x) => String(Math.round(x * 100) / 100).replace('.', ',')).join('_')}`;
    if (!this.linetypes.has(name)) this.linetypes.set(name, { name, pattern: [...dash] });
    return name;
  }

  /** Pennan som entitetens färg, linjetyp och tjocklek, utelämnade där de är lagrets. */
  private props(layer: DxfLayer, pen: Pen): Pick<DxfEntity, 'color' | 'linetype' | 'lineweight' | 'layer'> {
    const lw = lineweightOf(pen.weight);
    const color = penColor(pen.weight);
    const lt = this.linetype(pen.dash);
    const layerLt = layer.linetype || 'Continuous';
    const layerDash = this.linetypes.get(layerLt)?.pattern;
    const sameLt = lt === layerLt || (!!pen.dash?.length && sameDash(layerDash, pen.dash));
    return {
      layer: layer.name,
      ...(color === layer.color ? {} : { color }),
      ...(sameLt ? {} : { linetype: lt }),
      ...(lw === layer.lineweight ? {} : { lineweight: lw }),
    };
  }

  private pt = (p: Vec2): DxfPoint => [p[0], p[1]];

  private stroke(p: Primitive, src: Source, pen: Pen, geo: StrokeGeo): void {
    if (pen.weight === 0) return;
    const layer = this.layerOf(p, src, pen);
    this.entities.push({ ...this.props(layer, pen), ...geo } as DxfEntity);
  }

  private fill(p: Extract<Primitive, { kind: 'region' }>, src: Source, fill: FillDef): void {
    const rings = p.rings.filter((r) => r.length >= 3).map((r) => r.map(this.pt));
    if (!rings.length || fill.kind === 'none') return;
    const f = hatchAsPattern(fill.kind === 'type' ? resolveFill(fill, this.doc.graphics) : fill, 0.3);
    const layer = this.layerOf(p, src, null);
    const solid = (color: Color, opacity: number | undefined) => {
      const c = rgbOf(color);
      // Vitt är papperet (en mask under linjerna); DXF har ingen mask, så ytan utelämnas.
      if (c.white) return;
      const aci = aciOf(c.rgb);
      this.entities.push({ kind: 'hatch', layer: layer.name, rings, ...(aci === layer.color ? {} : { color: aci }), ...(this.v2018 && c.rgb ? { rgb: c.rgb } : {}), ...(opacity !== undefined && opacity < 1 ? { opacity } : {}) });
    };
    if (f.kind === 'solid') return solid(f.color, f.opacity);
    if (f.kind !== 'pattern') return;
    if (f.background) solid(f.background, f.backgroundOpacity);
    const k = this.k;
    const lines = f.lines
      .filter((l) => l.spacing > 0)
      .map((l) => {
        const a = (l.angle * Math.PI) / 180;
        const dir = [Math.cos(a), Math.sin(a)];
        const nor = [-dir[1], dir[0]];
        const [p0, p1] = l.phase ?? [0, 0];
        const shift = l.shift ?? 0;
        return {
          angle: l.angle,
          base: [(dir[0] * p0 + nor[0] * p1) * k, (dir[1] * p0 + nor[1] * p1) * k] as DxfPoint,
          offset: [(dir[0] * shift + nor[0] * l.spacing) * k, (dir[1] * shift + nor[1] * l.spacing) * k] as DxfPoint,
          dash: (l.dash ?? []).map((x) => x * k),
        };
      });
    if (!lines.length) return;
    const pen = { weight: f.weight };
    this.entities.push({ kind: 'hatch', rings, lines, ...this.props(layer, pen), linetype: undefined });
  }

  /**
   * En sammanslagen yta (väggarna i planen) delad efter objekten den är gjord
   * av, så att varje väggs del hamnar på väggens lager: fyllningen klipps
   * mot väggens form och konturen delas efter vilken vägg kanten kommer
   * ifrån. Svarar falskt när ytan inte behöver delas.
   */
  private ownedRegion(p: Extract<Primitive, { kind: 'region' }>, src: Source): boolean {
    const box = boxOf(p.rings as Rings);
    const owners = p.owners!.filter((o) => boxesTouch(boxOf(o.rings as Rings), box));
    if (!owners.length) return false;
    const with_ = (id: string, rings: readonly (readonly Vec2[])[]): Extract<Primitive, { kind: 'region' }> => ({ ...p, rings, origin: { ...p.origin, objectId: id }, owners: undefined });
    const groups = new Map<string, typeof owners>();
    for (const o of owners) {
      const name = this.layerOf(with_(o.id, p.rings), src, p.outline).name;
      groups.set(name, [...(groups.get(name) ?? []), o]);
    }
    if (groups.size === 1) {
      const q = with_(owners[0].id, p.rings);
      this.add(q, src);
      return true;
    }
    for (const group of groups.values())
      for (const rings of intersection(p.rings as Rings, group.map((o) => o.rings as Rings))) this.fill(with_(group[0].id, rings), src, p.fill);
    if (p.outline && !p.noOutline)
      for (const o of ownedOutlines([p.rings as Rings], owners as { id: string; rings: Rings }[], new Set(owners.map((x) => x.id))))
        this.stroke(with_(o.id ?? owners[0].id, p.rings), src, p.outline, { kind: 'poly', points: o.points.map(this.pt), closed: o.closed });
    return true;
  }

  add(p: Primitive, src: Source): void {
    switch (p.kind) {
      case 'line':
        return this.stroke(p, src, p.pen, { kind: 'line', a: this.pt(p.a), b: this.pt(p.b) });
      case 'polyline':
        if (p.points.length < 2) return;
        return this.stroke(p, src, p.pen, { kind: 'poly', points: p.points.map(this.pt), closed: p.closed });
      case 'arc': {
        let sweep = (((p.end - p.start) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        if (sweep < 1e-9) sweep = 2 * Math.PI;
        if (sweep > 2 * Math.PI - 1e-6) return this.stroke(p, src, p.pen, { kind: 'circle', center: this.pt(p.center), radius: p.radius });
        const deg = (x: number) => ((((x * 180) / Math.PI) % 360) + 360) % 360;
        return this.stroke(p, src, p.pen, { kind: 'arc', center: this.pt(p.center), radius: p.radius, start: deg(p.start), end: deg(p.start + sweep) });
      }
      case 'region':
        if (!p.origin?.objectId && p.owners?.length && this.ownedRegion(p, src)) return;
        this.fill(p, src, p.fill);
        if (p.outline && !p.noOutline) for (const r of p.rings) if (r.length >= 2) this.stroke(p, src, p.outline, { kind: 'poly', points: r.map(this.pt), closed: true });
        return;
      case 'text': {
        if (!p.text.trim()) return;
        const layer = this.layerOf(p, src, p.pen);
        const a = p.angle ?? 0;
        const step = p.height * 1.5 * this.k;
        p.text.split('\n').forEach((line, i) => {
          if (!line.trim()) return;
          const at: DxfPoint = [p.at[0] + Math.sin(a) * step * i, p.at[1] - Math.cos(a) * step * i];
          const pen = { weight: p.pen.weight };
          this.entities.push({ ...this.props(layer, pen), linetype: undefined, kind: 'text', at, text: line, height: p.height * DXF_CAP_HEIGHT * this.k, angle: (a * 180) / Math.PI, align: p.align ?? 'start', style: 'cad-apa' });
        });
        return;
      }
      case 'image':
        this.images++;
        return;
    }
  }

  write(version: DxfVersion, ltscale: number): DxfResult {
    if (this.settings?.allLayers) for (const l of listLayers(this.settings)) if (!this.layers.has(l.name)) this.layers.set(l.name, { ...l });
    // Bara linjetyperna som används (av lagren och linjerna).
    const used = new Set<string>([...this.layers.values()].map((l) => l.linetype ?? ''));
    for (const e of this.entities) if (e.linetype) used.add(e.linetype);
    const linetypes = [...this.linetypes.values()].filter((t) => used.has(t.name));
    // Ett lager vars linjetyp inte finns blir heldraget (en egen lista kan peka på något som saknas).
    const layers = [...this.layers.values()].map((l) => (l.linetype && !this.linetypes.has(l.linetype) ? { ...l, linetype: undefined } : l)).sort((a, b) => a.name.localeCompare(b.name, 'sv'));
    const bytes = writeDxf({ version, layers, linetypes, styles: [{ name: 'cad-apa', font: fontFile(this.doc) }], entities: this.entities, ltscale, textSize: 2.5 * DXF_CAP_HEIGHT * this.k });
    return { bytes, images: this.images, layers: layers.length };
  }
}

/** En vy som DXF i modellens mm, med texterna i vyns skala. */
export function viewDxf(doc: ProjectDoc, viewId: Id, opt: DxfExportOptions): DxfResult | null {
  const src = viewSource(doc, viewId);
  if (!src) return null;
  const scale = src.def.scale ?? 100;
  const vopt = { scale, autoDims: opt.autoDims };
  const prims = cachedViewPrims(doc, src.def, vopt);
  if (!prims.length) return null;
  const b = new Builder(doc, opt.version, scale);
  const source: Source = { states: viewStatesFor(doc, src.def, vopt) };
  for (const p of prims) b.add(p, source);
  return b.write(opt.version, scale);
}

/** Ett blad som DXF i pappers-mm, allt platt i modellrymden. */
export function sheetDxf(doc: ProjectDoc, sheetId: Id, opt: DxfExportOptions): DxfResult | null {
  const s = doc.sheets.find((x) => x.id === sheetId);
  if (!s) return null;
  const d = buildSheet(doc, s, { autoDims: opt.autoDims, today: opt.today });
  const viewOf = new Map<Primitive, Source>();
  for (const v of d.views) {
    const def: ViewDef | undefined = viewSource(doc, v.view)?.def;
    const source: Source = def ? { states: viewStatesFor(doc, def, { scale: v.scale, autoDims: opt.autoDims }) } : {};
    for (const p of v.prims) viewOf.set(p, source);
  }
  const b = new Builder(doc, opt.version, 1);
  const prims = [...d.prims, ...(opt.workStamp ? workStampPrims(opt.today) : [])];
  for (const p of prims) {
    // Vyns rubrik hör till bladet.
    const src = p.origin?.objectType === 'ViewTitle' ? {} : (viewOf.get(p) ?? {});
    b.add(p, src);
  }
  return b.write(opt.version, 1);
}
