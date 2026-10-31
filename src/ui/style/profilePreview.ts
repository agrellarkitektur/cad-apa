import { anchorPoint, profileSection, profileValues, ZONE_PARAM, type ProfileTypeModel } from '../../core/profileTypes';
import { partRegions, placePoint, sweep, type Vec3 } from '../../elements/profileBody';
import type { Vec2 } from '../../repr/primitives';

/**
 * Profileditorns förhandsvisningar (0.11.6): *Sträckt* (tvärsnittet med en
 * annan höjd och bredd, med sträckzonerna) och *3D* (en bit av profilen
 * svept en meter, isometriskt, med samma svepning som ritningen).
 */

/** Färgen för en delprofil (A, B, C …). */
export const partColor = (i: number) => `hsl(${(28 + i * 67) % 360} 45% 62%)`;

/** Tvärsnittet med Höjd och Bredd ändrade med `k`, som ritningen gör det. */
export function stretchedMarkup(m: ProfileTypeModel, k: number): string {
  const base = profileSection(m, profileValues(m));
  const own: Record<string, number> = {};
  const h = base.box.maxY - base.box.minY;
  const w = base.box.maxX - base.box.minX;
  if (m.zones.some((z) => z.axis === 'height')) own[ZONE_PARAM.height] = Math.round(h * k);
  if (m.zones.some((z) => z.axis === 'width')) own[ZONE_PARAM.width] = Math.round(w * k);
  const s = profileSection(m, profileValues(m, own));
  const pad = Math.max(20, 0.15 * Math.max(s.box.maxX - s.box.minX, s.box.maxY - s.box.minY));
  const vb = [s.box.minX - pad, -s.box.maxY - pad, s.box.maxX - s.box.minX + 2 * pad, s.box.maxY - s.box.minY + 2 * pad];
  const polys = s.parts.map((p, i) => `<polygon points="${p.ring.map((q) => `${q[0]},${-q[1]}`).join(' ')}" fill="${partColor(m.parts.indexOf(p.part))}" fill-opacity=".55" stroke="currentColor" stroke-width="1.2" vector-effect="non-scaling-stroke"><title>${i}</title></polygon>`).join('');
  const note = Object.keys(own).length ? `Höjd ${own[ZONE_PARAM.height] ?? Math.round(h)} · Bredd ${own[ZONE_PARAM.width] ?? Math.round(w)} mm (ritad ${Math.round(h)} × ${Math.round(w)})` : 'Typen har ingen sträckzon: måtten är låsta.';
  return `<svg class="pe-canvas pe-static" viewBox="${vb.join(' ')}" preserveAspectRatio="xMidYMid meet">${polys}</svg><p class="note">${note}</p>`;
}

/** En bit av profilen svept 1 000 mm, isometriskt sedd snett framifrån och ovanifrån. */
export function isoMarkup(m: ProfileTypeModel): string {
  const s = profileSection(m, profileValues(m));
  const a = m.anchors.find((x) => x.no === m.anchor) ?? m.anchors[0];
  const pl = { anchor: anchorPoint(a, s.box, s.deltas) };
  const regions = partRegions(s).map((r) => ({ polys: r.polys.map((poly) => poly.map((ring) => ring.map((q) => placePoint([q[0], q[1]], pl) as Vec2))), follows: true, extend: 0 }));
  const L = Math.max(600, 3 * Math.max(s.box.maxX - s.box.minX, s.box.maxY - s.box.minY));
  const res = sweep(regions, [[0, 0, 0], [L, 0, 0]], 'plumb', { kind: 'square' }, { kind: 'square' });
  const proj = (p: Vec3): Vec2 => [(p[0] - p[1]) * 0.866, -p[2] - (p[0] + p[1]) * 0.5];
  const faces: { pts: Vec2[]; depth: number; shade: number; part: number }[] = [];
  const light = [-0.35, -0.55, 0.76];
  for (const pc of res.pieces) {
    const all = pc.poly.flat();
    const c = all.reduce((s2, p) => [s2[0] + p[0], s2[1] + p[1], s2[2] + p[2]] as Vec3, [0, 0, 0] as Vec3).map((v) => v / all.length);
    for (const f of pc.poly) {
      let n: Vec3 = [0, 0, 0];
      for (let i = 0; i < f.length; i++) {
        const p = f[i];
        const q = f[(i + 1) % f.length];
        n = [n[0] + (p[1] - q[1]) * (p[2] + q[2]), n[1] + (p[2] - q[2]) * (p[0] + q[0]), n[2] + (p[0] - q[0]) * (p[1] + q[1])];
      }
      const l = Math.hypot(...n) || 1;
      n = [n[0] / l, n[1] / l, n[2] / l];
      if (n[0] * (f[0][0] - c[0]) + n[1] * (f[0][1] - c[1]) + n[2] * (f[0][2] - c[2]) < 0) n = [-n[0], -n[1], -n[2]];
      if (-n[0] - n[1] + n[2] <= 1e-6) continue;
      const fc = f.reduce((s2, p) => s2 + p[0] + p[1] - p[2], 0) / f.length;
      faces.push({ pts: f.map(proj), depth: fc, shade: 0.55 + 0.45 * Math.max(0, n[0] * light[0] + n[1] * light[1] + n[2] * light[2]), part: pc.part });
    }
  }
  if (!faces.length) return '<p class="note">Tvärsnittet saknar yta.</p>';
  faces.sort((p, q) => q.depth - p.depth);
  const xs = faces.flatMap((f) => f.pts.map((q) => q[0]));
  const ys = faces.flatMap((f) => f.pts.map((q) => q[1]));
  const pad = 20;
  const vb = [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) - Math.min(...xs) + 2 * pad, Math.max(...ys) - Math.min(...ys) + 2 * pad];
  const body = faces
    .map((f) => {
      const idx = m.parts.indexOf(s.parts[f.part]?.part);
      return `<polygon points="${f.pts.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(' ')}" fill="${partColor(idx < 0 ? f.part : idx)}" style="filter:brightness(${f.shade.toFixed(2)})" stroke="currentColor" stroke-opacity=".35" stroke-width=".6" vector-effect="non-scaling-stroke"/>`;
    })
    .join('');
  return `<svg class="pe-canvas pe-static" viewBox="${vb.map((v) => v.toFixed(1)).join(' ')}" preserveAspectRatio="xMidYMid meet">${body}</svg><p class="note">${Math.round(L)} mm av profilen, svept som i ritningen, sedd snett framifrån.</p>`;
}
