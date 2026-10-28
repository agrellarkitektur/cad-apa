import { updateParams } from '../../core/commands';
import type { Element, ProjectDoc } from '../../core/model';
import { fromRh, groundDefaults, toRh } from '../../core/site';
import type { GroundParams } from '../../elements/ground';
import { along } from '../../elements/groundLines';
import { easeRadiusAt, rampProfile, refPoints, tidyEases, tidyLevels } from '../../elements/groundRamp';
import { resolveParams } from '../../elements/registry';
import { isRamp } from '../../elements/shapeEdit';
import type { ToolHost } from '../tools/host';
import type { ModifyContext } from './ops';

/**
 * Rampens referenslinje i Modifiera (0.10.18): höjden i en punkt (ändarna
 * och punkterna däremellan, som då styr lutningen), ta bort höjden i en
 * punkt mellan ändarna, och förläng rampen från en ände. Övergången i en
 * punkt med höjd (0.10.19): mjuk med en radie, skarp, eller som rampen.
 */

/** Rampen och referenslinjens punkt som klicket gäller, eller null. */
export function rampPoint(doc: ProjectDoc, ctx: ModifyContext): { el: Element; p: GroundParams; i: number; end: boolean } | null {
  const el = ctx.shapeId ? doc.elements[ctx.shapeId] : undefined;
  if (!el || !isRamp(el) || ctx.hole !== undefined || ctx.kind !== 'point' || ctx.index === undefined) return null;
  const p = resolveParams<GroundParams>(doc, el);
  const n = (p.line ?? []).length;
  if (ctx.index >= n) return null;
  return { el, p, i: ctx.index, end: ctx.index === 0 || ctx.index === n - 1 };
}

/** Om punkten mellan ändarna har en egen höjd. */
export function hasOwnLevel(doc: ProjectDoc, ctx: ModifyContext): boolean {
  const r = rampPoint(doc, ctx);
  return !!r && !r.end && typeof r.p.levels?.[r.i] === 'number';
}

/**
 * Höjden i punkten som förslag i värdefältet: dess egen, eller den som
 * lutningen ger där nu (avrundad till 5 mm), i meter RH 2000 när projektet
 * har en plats.
 */
export function levelSuggestion(host: ToolHost, ctx: ModifyContext): { value: number; unit: 'mm' | 'm'; h: number } | null {
  const doc = host.store.doc;
  const r = rampPoint(doc, ctx);
  if (!r) return null;
  const prof = rampProfile(r.p, groundDefaults(doc.site));
  const own = prof.levels.find((l) => l.i === r.i);
  // Sträckan dit längs referenslinjen, med bågarna (0.10.19).
  const pt = r.p.line![r.i];
  const s = along(refPoints(r.p), pt[0], pt[1]).s;
  const h = own ? own.h : Math.round(prof.hAt(s) / 5) * 5;
  return doc.site ? { value: Math.round(toRh(doc.site, h) * 1000) / 1000, unit: 'm', h } : { value: h, unit: 'mm', h };
}

/** Ge punkten höjden som skrevs (eller förslaget): ändarna `height` och `endHeight`, de andra en egen höjd. */
export function setRampLevel(host: ToolHost, ctx: ModifyContext, typed?: number | null): void {
  const doc = host.store.doc;
  const r = rampPoint(doc, ctx);
  if (!r) return;
  if (r.el.locked) {
    host.hint('Låst. Lås upp i egenskaperna för att ändra.', 3000);
    return;
  }
  const sug = levelSuggestion(host, ctx)!;
  const h = typed === null || typed === undefined || !Number.isFinite(typed) ? sug.h : doc.site ? Math.round(fromRh(doc.site, typed)) : Math.round(typed);
  if (r.end) {
    updateParams(host.store, [r.el.id], { [r.i === 0 ? 'height' : 'endHeight']: h }, 'Ändra höjden');
    return;
  }
  const levels = [...(r.p.levels ?? [])];
  while (levels.length <= r.i) levels.push(null);
  levels[r.i] = h;
  updateParams(host.store, [r.el.id], { levels: tidyLevels(levels) }, 'Höjd i punkten');
}

/** Ta bort punktens egen höjd: den följer lutningen mellan grannarna igen. */
export function clearRampLevel(host: ToolHost, ctx: ModifyContext): void {
  const doc = host.store.doc;
  const r = rampPoint(doc, ctx);
  if (!r || r.end) return;
  const levels = [...(r.p.levels ?? [])];
  levels[r.i] = null;
  updateParams(host.store, [r.el.id], { levels: tidyLevels(levels) }, 'Ta bort höjden');
}

/** Om punkten har en höjd (ändarna, eller en egen), så att övergången gäller den. */
export function hasLevel(doc: ProjectDoc, ctx: ModifyContext): boolean {
  const r = rampPoint(doc, ctx);
  return !!r && (r.end || typeof r.p.levels?.[r.i] === 'number');
}

/** Om punkten har en egen övergång (inte rampens). */
export function hasOwnEase(doc: ProjectDoc, ctx: ModifyContext): boolean {
  const r = rampPoint(doc, ctx);
  return !!r && !!r.p.eases?.[r.i];
}

/** Övergångens radie i punkten som förslag (mm): dess egen, eller rampens. */
export function easeSuggestion(host: ToolHost, ctx: ModifyContext): number {
  const doc = host.store.doc;
  const r = rampPoint(doc, ctx);
  if (!r) return groundDefaults(doc.site).easeRadius;
  const def = groundDefaults(doc.site);
  return easeRadiusAt(r.p, r.i, def) || Math.max(100, r.p.easeRadius ?? def.easeRadius);
}

/**
 * Övergången i punkten: mjuk med radien `radius` (utan radie när den är
 * rampens), skarp, eller som rampen (`kind` 'clear').
 */
export function setRampEase(host: ToolHost, ctx: ModifyContext, kind: 'soft' | 'sharp' | 'clear', radius?: number | null): void {
  const doc = host.store.doc;
  const r = rampPoint(doc, ctx);
  if (!r) return;
  if (r.el.locked) {
    host.hint('Låst. Lås upp i egenskaperna för att ändra.', 3000);
    return;
  }
  const eases = [...(r.p.eases ?? [])];
  while (eases.length <= r.i) eases.push(null);
  const base = Math.max(100, r.p.easeRadius ?? groundDefaults(doc.site).easeRadius);
  const rad = radius !== null && radius !== undefined && Number.isFinite(radius) && radius > 0 ? Math.round(radius) : base;
  eases[r.i] = kind === 'clear' ? null : kind === 'sharp' ? { ease: false } : { ease: true, ...(rad !== base ? { radius: rad } : {}) };
  updateParams(host.store, [r.el.id], { eases: tidyEases(eases) }, kind === 'clear' ? 'Övergång som rampen' : kind === 'sharp' ? 'Skarp övergång' : 'Mjuk övergång');
}
