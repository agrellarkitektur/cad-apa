// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Carl August Agrell / Agrell Arkitektur
import type { DocStore } from '../../core/store';
import { circleContour, flatContour, type PPoint, type ProfileTypeModel, type SubProfile } from '../../core/profileTypes';
import { addAnchorAt, addDim, addPart, addZone, filletPart, movePoint, offsetPart } from './profileTypeEdits';
import { closestOnRing, edgeDistance, insideRing, offsetContour } from '../../core/profileContour';
import { type PePlace, type ProfileEditorState, GRID, n1, edgePoints } from './profileTypes';


// ---------- Ritytan ----------

/** Punkten i tvärsnittet under pekaren, och hur många mm en skärmpixel är. */
export function canvasPoint(svg: SVGSVGElement, e: PointerEvent): { at: PPoint; px: number } | null {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
  return { at: [p.x, -p.y], px: 1 / Math.max(1e-9, ctm.a) };
}

/**
 * Snäpp (inom 8 px) efter läget (0.11.6.1): *Kant i kant* och *Ovanpå*
 * snäpper till alla delprofilers punkter och sedan till de andras kanter
 * (en vågrät eller lodrät kant med rutnätet längs kanten); *Kant i kant*
 * skjuter dessutom ut en punkt som hamnat inuti en annan delprofil till
 * dess kant. *Fritt* snäpper bara till den egna delprofilens punkter. Annars
 * rutnätet, 5 mm.
 */
export function snapPoint(m: ProfileTypeModel, at: PPoint, px: number, o: { extra?: readonly PPoint[]; skip?: { part: string; i: number }; self?: string; place?: PePlace } = {}): PPoint {
  const place = o.place ?? 'over';
  const tol = 8 * px;
  let best: PPoint | null = null;
  let bd = tol;
  const consider = (q: PPoint) => {
    const d = Math.hypot(q[0] - at[0], q[1] - at[1]);
    if (d < bd) {
      bd = d;
      best = q;
    }
  };
  for (const p of m.parts) {
    if (place === 'free' && p.id !== o.self) continue;
    p.contour.pts.forEach((q, i) => {
      if (!(o.skip && o.skip.part === p.id && o.skip.i === i)) consider(q);
    });
  }
  for (const q of o.extra ?? []) consider(q);
  const others = place === 'free' ? [] : m.parts.filter((p) => p.id !== o.self).map((p) => flatContour(p.contour));
  let res: PPoint | null = best;
  if (!res) {
    let edge: { at: PPoint; dist: number; a: PPoint; b: PPoint } | null = null;
    for (const ring of others) {
      const c = closestOnRing(ring, at);
      if (c.dist < tol && (!edge || c.dist < edge.dist)) edge = { at: c.at, dist: c.dist, a: ring[c.edge], b: ring[(c.edge + 1) % ring.length] };
    }
    if (edge) {
      const g = (v: number) => Math.round(v / GRID) * GRID;
      if (Math.abs(edge.a[1] - edge.b[1]) < 1e-6) res = [Math.min(Math.max(g(edge.at[0]), Math.min(edge.a[0], edge.b[0])), Math.max(edge.a[0], edge.b[0])), edge.a[1]];
      else if (Math.abs(edge.a[0] - edge.b[0]) < 1e-6) res = [edge.a[0], Math.min(Math.max(g(edge.at[1]), Math.min(edge.a[1], edge.b[1])), Math.max(edge.a[1], edge.b[1]))];
      else res = edge.at;
    }
  }
  res ??= [Math.round(at[0] / GRID) * GRID, Math.round(at[1] / GRID) * GRID];
  if (place === 'edge')
    for (const ring of others) {
      if (!insideRing(ring, res)) continue;
      const c = closestOnRing(ring, res);
      if (c.dist > 0.05) res = c.at;
    }
  return res;
}

/** Den närmaste kanten i delprofilen (index i punkterna) och avståndet dit. */
export function nearestEdge(part: SubProfile, at: PPoint): { edge: number; dist: number } {
  let best = { edge: 0, dist: Infinity };
  for (let i = 0; i < part.contour.pts.length; i++) {
    const pts = edgePoints(part, i);
    for (let k = 0; k + 1 < pts.length; k++) {
      const d = closestOnRing([pts[k], pts[k + 1]], at).dist;
      if (d < best.dist) best = { edge: i, dist: d };
    }
  }
  return best;
}

/** Hur långt Förskjut ska flytta till punkten: från kantens linje, eller från konturen (minus inuti). */
export function offsetDistance(part: SubProfile, edge: number | undefined, q: PPoint): number {
  if (edge !== undefined) return Math.round(edgeDistance(part.contour, edge, q) * 10) / 10;
  const ring = flatContour(part.contour);
  const c = closestOnRing(ring, q);
  return Math.round((insideRing(ring, q) ? -c.dist : c.dist) * 10) / 10;
}

/** Läget som styr snäppet för verktyget (det valda delprofilens när man drar, Läge för nya, annars Ovanpå). */
export function placeFor(st: ProfileEditorState): PePlace {
  return st.tool === 'line' || st.tool === 'rect' || st.tool === 'circle' ? (st.place ?? 'edge') : 'over';
}

/** Pekaren i ritytan: rita, välj och dra. Sant om det hörde hit. */
export function profileCanvasPointer(store: DocStore, st: ProfileEditorState, e: PointerEvent, render: () => void): boolean {
  const svg = (e.target as Element).closest?.('svg[data-pe-canvas]') as SVGSVGElement | null;
  if (!svg && !(st.drag && e.type !== 'pointerdown')) return false;
  const def = st.def;
  const m = def ? store.doc.definitions[def]?.profile : undefined;
  if (!def || !m) return false;
  const root = svg ?? (document.querySelector('svg[data-pe-canvas]') as SVGSVGElement | null);
  if (!root) return false;
  const c = canvasPoint(root, e);
  if (!c) return false;
  const sel = m.parts.find((p) => p.id === st.part) ?? null;
  const dragSnap = (drag: { part: string; i: number }) => snapPoint(m, c.at, c.px, { skip: drag, self: drag.part, place: m.parts.find((p) => p.id === drag.part)?.place ?? 'edge' });
  if (e.type === 'pointermove') {
    if (st.drag) {
      const at = dragSnap(st.drag);
      const v = root.querySelector<SVGCircleElement>(`[data-pe-vertex="${st.drag.i}"]`);
      v?.setAttribute('cx', String(at[0]));
      v?.setAttribute('cy', String(-at[1]));
      const poly = root.querySelector<SVGPolygonElement>(`[data-pe-pick="${CSS.escape(st.drag.part)}"]`);
      const part = m.parts.find((p) => p.id === st.drag!.part);
      if (poly && part) {
        const pts = part.contour.pts.map((q, i) => (i === st.drag!.i ? at : q));
        poly.setAttribute('points', flatContour({ ...part.contour, pts }).map((q) => `${q[0]},${-q[1]}`).join(' '));
      }
      return true;
    }
    rubber(root, st, snapPoint(m, c.at, c.px, { extra: st.pending, place: placeFor(st) }), sel);
    return true;
  }
  if (e.type === 'pointerup') {
    if (!st.drag) return false;
    const drag = st.drag;
    st.drag = null;
    const at = dragSnap(drag);
    const part = m.parts.find((p) => p.id === drag.part);
    const was = part?.contour.pts[drag.i];
    if (was && (was[0] !== at[0] || was[1] !== at[1])) movePoint(store, def, drag.part, drag.i, at);
    else render();
    return true;
  }
  if (e.type !== 'pointerdown' || e.button !== 0) return false;
  e.preventDefault();
  st.note = undefined;
  const pick = (e.target as Element).closest('[data-pe-pick]')?.getAttribute('data-pe-pick');
  if (st.tool === 'select') {
    const v = (e.target as Element).closest('[data-pe-vertex]')?.getAttribute('data-pe-vertex');
    if (v !== null && v !== undefined && st.part) {
      st.drag = { part: st.part, i: Number(v) };
      return true;
    }
    if (pick) {
      st.part = pick;
      render();
    }
    return true;
  }
  const at = snapPoint(m, c.at, c.px, { extra: st.pending, place: placeFor(st) });
  const close = (a: PPoint, b: PPoint) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 8 * c.px;
  switch (st.tool) {
    case 'line':
      if (st.pending.length >= 3 && close(at, st.pending[0])) {
        const id = addPart(store, def, { pts: st.pending }, st.place ?? 'edge');
        st.pending = [];
        if (id) st.part = id;
      } else st.pending.push(at);
      break;
    case 'rect':
      if (!st.pending.length) st.pending.push(at);
      else {
        const [a] = st.pending;
        st.pending = [];
        const id = addPart(store, def, { pts: [a, [at[0], a[1]], at, [a[0], at[1]]] }, st.place ?? 'edge');
        if (id) st.part = id;
      }
      break;
    case 'circle':
      if (!st.pending.length) st.pending.push(at);
      else {
        const [a] = st.pending;
        st.pending = [];
        const r = Math.hypot(at[0] - a[0], at[1] - a[1]);
        const id = r >= 1 ? addPart(store, def, circleContour(a[0], a[1], 2 * r), st.place ?? 'edge') : null;
        if (id) st.part = id;
      }
      break;
    case 'offset': {
      if (st.offset && sel && st.offset.part === sel.id) {
        const d = offsetDistance(sel, st.offset.edge, at);
        if (!offsetPart(store, def, sel.id, d, st.offset.edge)) st.note = 'Det går inte att förskjuta så långt: konturen skulle vända sig.';
        st.offset = null;
        break;
      }
      const ne = sel ? nearestEdge(sel, c.at) : null;
      if (ne && ne.dist < 8 * c.px) st.offset = { part: sel!.id, edge: ne.edge };
      else if (pick && pick !== st.part) st.part = pick;
      else if (sel) st.offset = { part: sel.id };
      break;
    }
    case 'fillet': {
      const i = sel ? sel.contour.pts.findIndex((q) => close(q, c.at)) : -1;
      if (sel && i >= 0) {
        const r = filletPart(store, def, sel.id, i, st.radius ?? 20);
        if (r === null) st.note = 'Bara hörn mellan två raka kanter kan rundas.';
        else if (r < (st.radius ?? 20) - 0.05) st.note = `Radien minskades till ${n1(r)} mm så att bågen ryms.`;
      } else if (pick) st.part = pick;
      break;
    }
    case 'dim':
      if (st.pending.length < 2) st.pending.push(at);
      else {
        const [a, b] = st.pending;
        st.pending = [];
        const h = Math.abs(b[1] - a[1]) > Math.abs(b[0] - a[0]);
        if (!addDim(store, def, h ? 'height' : 'width', h ? a[1] : a[0], h ? b[1] : b[0], h ? at[0] : at[1])) st.note = 'Måttet är kortare än 1 mm.';
      }
      break;
    case 'anchor':
      addAnchorAt(store, def, at);
      break;
    case 'zoneH':
    case 'zoneW':
      if (!st.pending.length) st.pending.push(at);
      else {
        const [a] = st.pending;
        st.pending = [];
        const h = st.tool === 'zoneH';
        addZone(store, def, h ? 'height' : 'width', h ? a[1] : a[0], h ? at[1] : at[0]);
      }
      break;
  }
  render();
  return true;
}

/** Gummibandet från det klickade till pekaren, och Förskjuts förhandsvisning. */
export function rubber(svg: SVGSVGElement, st: ProfileEditorState, at: PPoint, sel: SubProfile | null): void {
  const el = svg.querySelector<SVGPathElement>('.pe-rubber');
  if (!el) return;
  const p = st.pending;
  let d = '';
  const P = (q: PPoint) => `${q[0]} ${-q[1]}`;
  if (st.tool === 'line' && p.length) d = `M${P(p[p.length - 1])}L${P(at)}`;
  else if (st.tool === 'rect' && p.length) d = `M${P(p[0])}L${P([at[0], p[0][1]])}L${P(at)}L${P([p[0][0], at[1]])}Z`;
  else if (st.tool === 'circle' && p.length) {
    const r = Math.hypot(at[0] - p[0][0], at[1] - p[0][1]);
    d = `M${p[0][0] - r} ${-p[0][1]}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
  } else if ((st.tool === 'zoneH' || st.tool === 'zoneW') && p.length) {
    const vb = svg.viewBox.baseVal;
    d = st.tool === 'zoneH' ? `M${vb.x} ${-p[0][1]}H${vb.x + vb.width}M${vb.x} ${-at[1]}H${vb.x + vb.width}` : `M${p[0][0]} ${vb.y}V${vb.y + vb.height}M${at[0]} ${vb.y}V${vb.y + vb.height}`;
  } else if (st.tool === 'dim' && p.length) {
    if (p.length === 1) d = `M${P(p[0])}L${P(at)}`;
    else {
      const h = Math.abs(p[1][1] - p[0][1]) > Math.abs(p[1][0] - p[0][0]);
      const a: PPoint = h ? [at[0], p[0][1]] : [p[0][0], at[1]];
      const b: PPoint = h ? [at[0], p[1][1]] : [p[1][0], at[1]];
      d = `M${P(p[0])}L${P(a)}M${P(p[1])}L${P(b)}M${P(a)}L${P(b)}`;
    }
  } else if (st.tool === 'offset' && st.offset && sel && st.offset.part === sel.id) {
    const c = offsetContour(sel.contour, offsetDistance(sel, st.offset.edge, at), st.offset.edge);
    if (c) d = `M${flatContour(c).map(P).join('L')}Z`;
  }
  el.setAttribute('d', d);
}
