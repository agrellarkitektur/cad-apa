import { defaultSheet } from '../core/viewCategories';
import type { StyleSheet } from '../core/graphics';
import type { Element, Id, ProjectDoc } from '../core/model';
import type { Action, ViewStates } from '../core/states';
import { markerFrame, markerName } from '../elements/markers';
import { typeOf } from '../elements/registry';
import { union, type Rings } from '../geometry/boolean';
import type { V3 } from '../geometry/hiddenLine';
import { roofPlanes, type RoofParams } from '../elements/roof';
import { slopeSymbol, type RoofSlopeParams } from '../elements/roofSlope';
import type { PlanContext } from '../elements/registry';
import { cutSolid } from './sectionCut';
import { groundLines } from './terrain';
import { terrainOf } from '../core/site';
import { buildingFootprint } from '../elements/footprint';
import { levelPrims } from './sectionLevels';
import { modelShapes, WITH_DEMOLISHED } from './storeyShapes';
import { markerPen } from './markerPens';
import { applyOwnPen, effectivePen, ownPenOf } from './ownPen';
import { ownedOutlines } from './outlineOwners';
import { facadePen, facadeRowOf } from './facadePens';
import { cutRowPen } from './objectPens';
import { applyStyle, type Pickable } from './plan';
import { HIDDEN_SLABS, HIDDEN_SLABS_SECTION, HIDDEN_WALLS } from './sectionHidden';
import { sectionLines } from './sectionLines';
import { LINE_TYPES } from '../core/lineTypes';
import type { Pen, Primitive, Vec2 } from './primitives';
import { zOn, type Solid } from './solids';
import { materialCutFill, materialCutPrims, type FillParams } from '../elements/fill2d';
import { surfacePrims } from './sectionSurfaces';

/**
 * Fasader och sektioner (0.7). Vyn räknas fram ur samma 3D-former som
 * 3D-vyn: det som syns bortom linjen ritas med dolda linjer borttagna, och i
 * en sektion fylls det som skärs av linjen enligt stilmallen. Resultatet är
 * vanliga ritningsprimitiver i vyns koordinater (x åt höger, y = höjd), så
 * att vyn ritas, markeras och senare läggs på blad som planen.
 */
export interface SectionResult {
  name: string;
  prims: Primitive[];
  pickables: Pickable[];
  /** Hur lång tid uträkningen tog, ms. */
  ms: number;
  /**
   * Automatiska taklutningar (0.8), med id `slope:<tak>:<takfall>`. Markeras
   * en blir den ett eget objekt med de här värdena (`RoofSlope`).
   */
  slopes: Record<string, RoofSlopeParams>;
  /** Snittytorna (0.8), i linjens koordinater (x längs linjen, y höjd), för att fylla snittet i 3D. */
  cutFaces: { material: string; rings: Rings }[];
}

/** Id för en automatisk taklutning, innan den blivit ett eget objekt. */
export function autoSlopeId(roof: Id, face: number): string {
  return `slope:${roof}:${face}`;
}

// Linjerna i fasader och sektioner efter vad linjen är: `FACADE_PENS` (0.10.36).

/** Det tonade djupet (0.10.10). */
const FAR_PEN = { weight: 0.13, color: 'muted' } as const;
/** Dolda linjer (0.10.10). */
const HIDDEN_PEN: Pen = { weight: 0.13, dash: LINE_TYPES.dashed.dash };

/** Material som fylls i snitt som väggar; resten ritas med kontur (också snittets lock i 3D). */
export const POCHE_MATERIALS: ReadonlySet<string> = new Set(['wall', 'wall-new', 'roof', 'floor', 'slab']);

export function buildSection(doc: ProjectDoc, markerId: Id, view: ViewStates, style: StyleSheet = defaultSheet(doc.graphics, doc.elements[markerId]?.type === 'Section' ? 'section' : 'facade')): SectionResult | null {
  const t0 = performance.now();
  const marker = doc.elements[markerId];
  if (!marker || (marker.type !== 'Section' && marker.type !== 'Elevation')) return null;
  const fr = markerFrame(doc, marker);
  const isSection = marker.type === 'Section';
  const O = fr.start;
  const r = fr.right;
  const v = fr.view;
  const toView = (x: number, y: number, z: number): V3 => [(x - O[0]) * r[0] + (y - O[1]) * r[1], z, (x - O[0]) * v[0] + (y - O[1]) * v[1]];
  const depthMax = fr.depth;
  // Sektionen ritas bara så långt som linjen går.
  const uMax = Math.hypot(fr.end[0] - fr.start[0], fr.end[1] - fr.start[1]);

  // Formerna, med åtgärd. Det som rivs byggs för sig, så att det inte
  // påverkar skarvarna i det som står kvar. 2D-elementen i fasaden eller
  // sektionen ritas för sig (se buildPlan med `place`). Alla våningar (0.9),
  // var och en redan lyft till sin golvnivå.
  const { shapes, storeys } = modelShapes(doc, view, style, WITH_DEMOLISHED);
  // Stil, skala och åtgärd beror inte på våningen; taken med sin våningens golvnivå.
  const ctx = storeys[0].ctx;
  const roofs = storeys.flatMap(({ ctx: c, elevation }) => c.visible('Roof').filter((el) => c.actionOf(el) !== 'demolished' && !c.hiddenByView(el)).map((el) => ({ el, elevation })));
  const actionOfId = (id: string): Action => {
    const el = doc.elements[id];
    return el ? ctx.actionOf(el) : 'plain';
  };

  // Det tonade djupet (0.10.10): bortom det tunna grå linjer.
  const tone = fr.tone !== null && fr.tone > 0 && (depthMax === null || fr.tone < depthMax) ? fr.tone : null;
  // Dolda linjer i fasader (0.10.10), tända under Visa. I sektioner (0.10.12)
  // bjälklagen bakom snittet, på från början; de snittade ritas som snitt.
  const hiddenSlabs = isSection ? !view.hide?.includes(HIDDEN_SLABS_SECTION) : !!view.hide?.includes(`+${HIDDEN_SLABS}`);
  const hiddenWalls = !isSection && !!view.hide?.includes(`+${HIDDEN_WALLS}`);

  // Ytorna i fasaden (0.10.28.2): formerna vars material har en yta.
  const surfaced = isSection || view.hide?.includes('fill') ? new Set<string>() : new Set((style.materials ?? []).filter((m) => m.surface).map((m) => m.id));
  const { visibleLines, hiddenLines, minZ, maxZ, occluders, faces } = sectionLines(doc, shapes, { O, r, v, uMax, depthMax, tone, toView }, { slabs: hiddenSlabs, walls: hiddenWalls }, actionOfId, surfaced.size ? (s) => !!s.matId && surfaced.has(s.matId) && actionOfId(s.id) !== 'demolished' : undefined);

  // Snittytor där linjen skär formerna.
  const cuts = new Map<string, { action: Action; poche: boolean; ids: Set<string>; rings: Rings[]; cut?: FillParams; objectType?: string }>();
  // Snittlinjerna (0.10.38): väggar, bjälklag och tak slås ihop så länge deras snittlinjer är lika.
  const cutRowKey = new Map<string, string>();
  const rowKeyOf = (type: string | undefined) => {
    const t = type ?? '';
    let k = cutRowKey.get(t);
    if (k === undefined) cutRowKey.set(t, (k = JSON.stringify(cutRowPen(style, type))));
    return k;
  };
  const materialById = new Map((style.materials ?? []).map((m) => [m.id, m]));
  const cutFaces: { material: string; rings: Rings }[] = [];
  // Varje objekts egen snittyta, för markering. Snitten ritas sammanslagna
  // (väggar och tak i ett), men den sammanslagna ytan får inte göra att ett
  // klick på en vägg markerar taket och alla väggar som möter det (0.8.2).
  const ownCuts = new Map<string, Rings[]>();
  if (isSection) {
    for (const { s, demolished } of shapes) {
      if (s.kind === 'edges' || demolished) continue;
      const polys = cutSolid(s, O, r, v, uMax);
      if (!polys.length) continue;
      for (const rings of polys) cutFaces.push({ material: s.material, rings });
      const mine = ownCuts.get(s.id) ?? [];
      mine.push(...polys);
      ownCuts.set(s.id, mine);
      const action = actionOfId(s.id);
      const poche = POCHE_MATERIALS.has(s.material);
      // Materialets snitt (0.10.28.2): ett material slås ihop med sig självt.
      const cut = poche && s.matId ? materialCutFill(materialById.get(s.matId), action) : undefined;
      const objectType = doc.elements[s.id]?.type;
      const k = `${action}|${poche ? 'p' : 'o'}|${poche ? `${cut ? `m:${s.matId}` : ''}|${rowKeyOf(objectType)}` : s.id}`;
      let g = cuts.get(k);
      if (!g) cuts.set(k, (g = { action, poche, ids: new Set(), rings: [], ...(cut ? { cut } : {}), ...(objectType ? { objectType } : {}) }));
      g.ids.add(s.id);
      g.rings.push(...polys);
    }
  }

  // Ytornas fyllning först, under linjerna.
  const prims: Primitive[] = faces.length ? surfacePrims(faces, occluders, style, ctx.scale, (id) => doc.elements[id]?.type) : [];
  const byId = new Map<string, Primitive[]>();
  const own = (id: string, p: Primitive) => {
    const list = byId.get(id) ?? [];
    list.push(p);
    byId.set(id, list);
  };
  let minU = Infinity;
  let maxU = -Infinity;
  const slopes: Record<string, RoofSlopeParams> = {};
  for (const l of visibleLines) {
    // Konturlinjerna per objekt (0.10.38): delen och objekttypen ger raden.
    const objectType = doc.elements[l.key.id]?.type;
    const pen: Pen = { ...facadePen(style, facadeRowOf(l.key.part, objectType)), ...(l.key.dash ? { dash: l.key.dash } : {}) };
    const raw: Primitive = { kind: 'line', a: l.a, b: l.b, pen, origin: { objectId: l.key.id, objectType, part: l.key.part ?? 'vy' } };
    // Objektets egen penna (0.8.31) efter stilmallens.
    const styled = applyOwnPen(applyStyle(raw, style.actions[ctx.styleKeyOf(l.key.action)], l.key.action, style, ctx.scale), ownPenOf(doc, raw), style);
    // Det tonade (0.10.10): tunt och grått, oavsett penna.
    const p: Primitive = l.key.far && styled.kind === 'line' ? { ...styled, pen: { ...styled.pen, weight: Math.min(styled.pen.weight, FAR_PEN.weight), color: FAR_PEN.color } } : styled;
    prims.push(p);
    own(l.key.id, p);
    minU = Math.min(minU, l.a[0], l.b[0]);
    maxU = Math.max(maxU, l.a[0], l.b[0]);
  }
  // Dolda linjer (0.10.10): tunna och streckade, går inte att klicka på.
  for (const l of hiddenLines) {
    if (ownCuts.has(l.key.id)) continue;
    prims.push({ kind: 'line', a: l.a, b: l.b, pen: HIDDEN_PEN, noPick: true, origin: { objectId: l.key.id, objectType: doc.elements[l.key.id]?.type, part: 'dold' } });
  }
  for (const g of cuts.values()) {
    const merged = g.poche ? union(g.rings) : g.rings;
    const first = [...g.ids][0];
    // Snitt med egen penna (0.8.31): konturen delas efter objekt, som väggarna i planen.
    const owned = new Set([...g.ids].filter((id) => doc.elements[id] && effectivePen(doc, doc.elements[id])));
    const split = owned.size ? { outline: null, noOutline: true } : {};
    for (const rings of merged) {
      if (g.cut) {
        // Med egna pennor ritas konturen per objekt nedan; papperet först, utan kontur.
        // Konturen som snittlinje efter mönstret (0.10.38, som i planen); med egna pennor per objekt nedan.
        const mp = materialCutPrims(rings, g.cut, { objectId: first, objectType: g.objectType, part: 'snitt' }, style, ctx.scale, false, true);
        prims.push(...mp.filter((q) => !(owned.size && q.kind === 'polyline' && q.asOutline)).map((q) => (q.kind === 'polyline' && q.asOutline ? applyStyle(q, style.actions[ctx.styleKeyOf(g.action)], g.action, style, ctx.scale) : q)));
        for (const ring of rings) for (const q of ring) {
          minU = Math.min(minU, q[0]);
          maxU = Math.max(maxU, q[0]);
        }
        continue;
      }
      const raw: Primitive = g.poche
        ? { kind: 'region', role: 'cut', rings, fill: { kind: 'solid', color: 'ink' }, outline: { weight: 0.35 }, origin: { objectId: first, objectType: g.objectType, part: 'snitt' }, ...split }
        : { kind: 'region', role: 'cut', rings, fill: { kind: 'none' }, outline: { weight: 0.25 }, ownFill: true, origin: { objectId: first, objectType: g.objectType, part: 'snitt' }, ...split };
      const p = applyStyle(raw, style.actions[ctx.styleKeyOf(g.action)], g.action, style, ctx.scale);
      prims.push(p);
      for (const ring of rings) for (const q of ring) {
        minU = Math.min(minU, q[0]);
        maxU = Math.max(maxU, q[0]);
      }
    }
    if (owned.size) {
      const pieces = [...g.ids].flatMap((id) => (ownCuts.get(id) ?? []).map((r) => ({ id, rings: r })));
      for (const o of ownedOutlines(merged, pieces, owned)) {
        const id = o.id ?? first;
        const raw: Primitive = { kind: 'polyline', points: o.points, closed: o.closed, pen: { weight: g.poche ? 0.35 : 0.25 }, ...(g.poche ? { asOutline: true } : {}), origin: { objectId: id, objectType: doc.elements[id]?.type ?? g.objectType, part: 'snitt' } };
        const styled = g.poche ? applyStyle(raw, style.actions[ctx.styleKeyOf(g.action)], g.action, style, ctx.scale) : raw;
        const p = applyOwnPen(styled, o.id && doc.elements[o.id] ? effectivePen(doc, doc.elements[o.id]) : undefined, style);
        prims.push(p);
        own(id, p);
      }
    }
  }

  if (Number.isFinite(minU) && Number.isFinite(minZ)) {
    // Marklinje under byggnaden, och nivåer för golv och högsta punkt. Med
    // en markmodell (0.10.3) den befintliga marken, tunn och streckad: längs
    // linjen i en sektion, vid husets kontur närmast betraktaren i en fasad.
    // Med markobjekt (0.10.4) i ett förslag den färdiga marken tjock och
    // heldragen, och den befintliga streckad där den skiljer sig.
    const terrain = terrainOf(doc);
    if (terrain && !view.hide?.includes('Terrain')) {
      const u0 = Math.max(0, minU - 5000);
      const u1 = Math.min(uMax, maxU + 5000);
      const outline = isSection ? null : buildingFootprint(ctx).map((poly) => poly[0]);
      prims.push(...groundLines(ctx, terrain, fr, u0, u1, outline, isSection));
    } else if (!terrain) {
      const ground = Math.min(minZ, 0);
      prims.push({ kind: 'line', a: [minU - 1500, ground], b: [maxU + 1500, ground], pen: { weight: 0.7 }, origin: { part: 'mark' } });
    }
    // Taklutningen, där takfallet syns i sin rätta vinkel. Takfall som har
    // en taklutning som eget objekt i den här vyn hoppas över; objektet ritar sig själv.
    if (!view.hide?.includes('roofSlope')) {
      const taken = new Set(
        Object.values(doc.elements)
          .filter((e) => e.type === 'RoofSlope' && e.space === markerId)
          .map((e) => autoSlopeId((e.params as unknown as RoofSlopeParams).roof, (e.params as unknown as RoofSlopeParams).face)),
      );
      for (const pl of roofSlopes(ctx, roofs, toView)) {
        const id = autoSlopeId(pl.roof, pl.face);
        if (taken.has(id)) continue;
        slopes[id] = pl;
        const sty = view.detail === 'sketch' ? 'text' : 'arc';
        const slope = ctx.params<RoofParams>(doc.elements[pl.roof]).slope;
        for (const p of slopeSymbol(pl.at, pl.toward, slope, pl.len, sty, style.labels.heights.dimension, { objectId: id, objectType: 'RoofSlope', part: 'taklutning' }, ctx.scale, markerPen(style, 'roofSlope'))) {
          prims.push(p);
          own(id, p);
        }
      }
    }
    // Nivåmarkörer och höjdmått (0.9.2).
    const cutSlabs = isSection ? shapes.filter(({ s, demolished }) => !demolished && s.kind !== 'edges' && s.material === 'slab' && ownCuts.has(s.id)).map(({ s }) => s as Solid) : [];
    prims.push(...levelPrims(doc, ctx, style, view, { cutSlabs, roofs, maxU, maxZ, isSection, marker, view: fr.view }));
  }

  const pickables: Pickable[] = [...new Set([...byId.keys(), ...ownCuts.keys()])].map((id) => {
    const list = byId.get(id) ?? [];
    return {
      id,
      priority: typeOf(doc.elements[id]?.type ?? '')?.drawOrder ?? 0,
      regions: [...list.flatMap((p) => (p.kind === 'region' ? [p.rings as Vec2[][]] : [])), ...((ownCuts.get(id) ?? []) as Vec2[][][])],
      prims: list.filter((p) => p.kind !== 'region'),
    };
  });
  return { name: markerName(doc, marker), prims, pickables, ms: performance.now() - t0, slopes, cutFaces };
}

/**
 * Var taklutningen sätts ut i en fasad eller sektion. Bara takfall som syns
 * i sin rätta lutning får den (man ser dem från gaveln), med symbolen en bit
 * upp på takfallets kant närmast betraktaren.
 */
function roofSlopes(ctx: PlanContext, roofs: { el: Element; elevation: number }[], toView: (x: number, y: number, z: number) => V3): RoofSlopeParams[] {
  const out: RoofSlopeParams[] = [];
  for (const { el, elevation } of roofs) {
    const p = ctx.params<RoofParams>(el);
    // En kon (0.10) är många plana bitar: bara den som syns mest i sin rätta lutning får symbolen.
    let best: { q: RoofSlopeParams; err: number } | null = null;
    roofPlanes(p).forEach((rp, face) => {
      const pts = rp.rings[0].map((q) => toView(q[0], q[1], elevation + zOn(rp.top, q[0], q[1])));
      if (pts.length < 3) return;
      // Takfallets kant närmast betraktaren, från takfot till nock.
      const dmin = Math.min(...pts.map((q) => q[2]));
      const near = pts.filter((q) => q[2] < dmin + 1);
      if (near.length < 2) return;
      const low = near.reduce((a, q) => (q[1] < a[1] ? q : a));
      const high = near.reduce((a, q) => (q[1] > a[1] ? q : a));
      const du = high[0] - low[0];
      const dz = high[1] - low[1];
      if (Math.abs(du) < 100 || dz < 10) return;
      const apparent = (Math.atan2(dz, Math.abs(du)) * 180) / Math.PI;
      const err = Math.abs(apparent - p.slope);
      if (err > 0.5 || (best && best.err <= err)) return;
      const t = 0.55;
      best = {
        err,
        q: {
          roof: el.id,
          face,
          at: [Math.round(low[0] + du * t), Math.round(low[1] + dz * t)],
          toward: low[0] > high[0] ? 1 : -1,
          len: Math.round(Math.max(600, Math.abs(du) * 0.35)),
          style: 'auto',
        },
      };
    });
    if (best) out.push((best as { q: RoofSlopeParams }).q);
  }
  return out;
}
