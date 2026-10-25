import { boxOf, difference, type Box } from '../geometry/boolean';
import { BoxIndex } from '../geometry/boxIndex';
import { pointInRings } from '../geometry/vec';
import type { Primitive, Vec2 } from './primitives';

/**
 * Det som ligger överst döljer det under (0.8.28). En 2D-forms fyllning
 * ritas bakom väggarna och linjen framför, så en övre forms fyllning kan
 * inte dölja en undre forms linje genom att ritas efter den. I stället kapas
 * de undre formernas linjer där en senare form (i ritordningen) har en
 * täckande fyllning: hel och utan genomskinlighet. En skraffering har ingen
 * bakgrund och döljer ingenting, som förut, men en bakgrund med opacitet
 * 100 % (0.8.29) är en hel yta och döljer.
 *
 * De fyllda ändformerna (pil och punkt, `part` = 'ände') kapas på samma sätt
 * (0.8.29): ytan minus de täckande ytorna, och konturen som linjerna.
 *
 * `ones` är varje elements primitiver i ritordning (längst bak först). Svaret
 * har samma form; ett element utan något att kapa får tillbaka samma lista.
 */
export function coverLines(ones: readonly (readonly Primitive[])[]): Primitive[][] {
  // De täckande ytorna, med elementets plats i ordningen.
  const covers: { at: number; rings: readonly (readonly Vec2[])[]; box: Box }[] = [];
  ones.forEach((prims, at) => {
    for (const p of prims) {
      if (p.kind === 'region' && p.fill?.kind === 'solid' && (p.fill.opacity ?? 1) >= 1) covers.push({ at, rings: p.rings, box: boxOf(p.rings as Vec2[][]) });
    }
  });
  if (!covers.length) return ones as Primitive[][];
  const index = new BoxIndex(2000);
  covers.forEach((c, i) => index.add(i, c.box));

  return ones.map((prims, at) => {
    let changed = false;
    const out: Primitive[] = [];
    for (const p of prims) {
      if (p.kind === 'region' && p.origin?.part === 'ände') {
        const over = index
          .near(boxOf(p.rings as Vec2[][]))
          .map((i) => covers[i])
          .filter((c) => c.at > at);
        if (!over.length) {
          out.push(p);
          continue;
        }
        changed = true;
        const areas = over.map((c) => c.rings);
        for (const rings of difference(p.rings as Vec2[][], areas as Vec2[][][])) out.push({ ...p, rings, outline: null, noOutline: true });
        if (p.outline && p.outline.weight > 0)
          for (const ring of p.rings) for (const piece of clipOutside([...ring, ring[0]], areas)) out.push({ kind: 'polyline', points: piece, closed: false, pen: p.outline, origin: p.origin } as Primitive);
        continue;
      }
      const pts = p.kind === 'polyline' ? (p.closed ? [...p.points, p.points[0]] : p.points) : p.kind === 'line' ? [p.a, p.b] : null;
      if (!pts || pts.length < 2 || (p.kind !== 'polyline' && p.kind !== 'line') || p.pen.weight <= 0) {
        out.push(p);
        continue;
      }
      const over = index
        .near(boxOf([pts as Vec2[]]))
        .map((i) => covers[i])
        .filter((c) => c.at > at);
      if (!over.length) {
        out.push(p);
        continue;
      }
      const pieces = clipOutsideAt(pts, over.map((c) => c.rings));
      if (pieces.length === 1 && pieces[0].points.length === pts.length && pieces[0].points.every((q, k) => q === pts[k])) {
        out.push(p);
        continue;
      }
      changed = true;
      // Biten ritas streckad som den hela linjen (0.8.30, `dashPieces`).
      const whole = p.kind === 'polyline' ? { points: p.points, closed: p.closed } : { points: pts, closed: false };
      const from = (start: number) => (p.pen.dash?.length ? { dashFrom: { ...whole, at: start } } : {});
      for (const piece of pieces) out.push({ ...p, kind: 'polyline', points: piece.points, closed: false, ...from(piece.at) } as Primitive);
    }
    return changed ? out : (prims as Primitive[]);
  });
}

/**
 * Delarna av linjen `pts` som ligger utanför alla `areas` (jämn–udda, så
 * att hål räknas). Varje sträcka delas där den korsar en kant, och en bit
 * behålls om dess mitt ligger utanför.
 */
export function clipOutside(pts: readonly Vec2[], areas: readonly (readonly (readonly Vec2[])[])[]): Vec2[][] {
  return clipOutsideAt(pts, areas).map((p) => p.points);
}

/** Som `clipOutside`, och var varje bit börjar längs linjen (mm, 0.8.30). */
export function clipOutsideAt(pts: readonly Vec2[], areas: readonly (readonly (readonly Vec2[])[])[]): { points: Vec2[]; at: number }[] {
  const inside = (q: Vec2) => areas.some((rings) => pointInRings(q, rings));
  const out: { points: Vec2[]; at: number }[] = [];
  let run: Vec2[] | null = null;
  let s = 0;
  const keep = (a: Vec2, b: Vec2) => {
    if (run && run[run.length - 1] === a) run.push(b);
    else out.push({ points: (run = [a, b]), at: s + Math.hypot(a[0] - pts[k][0], a[1] - pts[k][1]) });
  };
  let k = 0;
  for (; k + 1 < pts.length; s += Math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]), k++) {
    const a = pts[k];
    const b = pts[k + 1];
    const ts = [0, 1];
    for (const rings of areas) for (const ring of rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const t = crossing(a, b, ring[j], ring[i]);
      if (t !== null) ts.push(t);
    }
    ts.sort((x, y) => x - y);
    let prev: Vec2 = a;
    for (let i = 0; i + 1 < ts.length; i++) {
      const t0 = ts[i];
      const t1 = ts[i + 1];
      if (t1 - t0 < 1e-9) continue;
      const end: Vec2 = t1 >= 1 ? b : [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1];
      const tm = (t0 + t1) / 2;
      if (!inside([a[0] + (b[0] - a[0]) * tm, a[1] + (b[1] - a[1]) * tm])) keep(prev, end);
      else run = null;
      prev = end;
    }
  }
  return out;
}

/** Var på sträckan a–b (0–1) den korsar kanten c–d, eller null. */
function crossing(a: Vec2, b: Vec2, c: Vec2, d: Vec2): number | null {
  const rx = b[0] - a[0];
  const ry = b[1] - a[1];
  const sx = d[0] - c[0];
  const sy = d[1] - c[1];
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-12) return null;
  const qx = c[0] - a[0];
  const qy = c[1] - a[1];
  const t = (qx * sy - qy * sx) / den;
  const u = (qx * ry - qy * rx) / den;
  return t > 0 && t < 1 && u >= 0 && u <= 1 ? t : null;
}
