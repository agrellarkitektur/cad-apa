import type { ProfileDim } from '../../core/profileContour';
import { anchorPoint, boxOfPoints, profileSection, profileValues, stretchPoint, ZONE_PARAM, type PPoint, type ProfileTypeModel } from '../../core/profileTypes';
import { partRegions, placePoint, sweep, type Vec3 } from '../../elements/profileBody';
import type { Vec2 } from '../../repr/primitives';

/**
 * Profileditorns förhandsvisningar (0.11.6): *Sträckt* (tvärsnittet med en
 * annan höjd och bredd, med sträckzonerna) och *3D* (en bit av profilen
 * svept en meter, isometriskt, med samma svepning som ritningen).
 */

/** Färgen för en delprofil (A, B, C …). */
export const partColor = (i: number) => `hsl(${(28 + i * 67) % 360} 45% 62%)`;

const n1 = (v: number) => (Math.round(v * 10) / 10).toLocaleString('sv-SE');

/**
 * Måtten i ritytan (0.11.6.1): måttlinje med snedstreck i ändarna och
 * värdet, och parametern måttet pekar på. `map` lägger punkterna i en
 * sträckt bild (Sträckt), så att värdet blir det sträckta.
 */
export function dimsSvg(dims: readonly ProfileDim[], fs: number, map: (p: PPoint) => PPoint = (p) => p): string {
  return dims
    .map((d, i) => {
      const a = map(d.axis === 'height' ? [d.at, d.from] : [d.from, d.at]);
      const b = map(d.axis === 'height' ? [d.at, d.to] : [d.to, d.at]);
      const v = d.axis === 'height' ? b[1] - a[1] : b[0] - a[0];
      const t = fs * 0.35;
      const tick = (q: PPoint) => `M${q[0] - t} ${-q[1] + t}L${q[0] + t} ${-q[1] - t}`;
      const mid: PPoint = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const label = `${n1(v)}${d.param ? ` ${d.param}` : ''}`;
      const text =
        d.axis === 'height'
          ? `<text x="${mid[0] - fs * 0.4}" y="${-mid[1]}" font-size="${fs}" text-anchor="middle" transform="rotate(-90 ${mid[0] - fs * 0.4} ${-mid[1]})">${label}</text>`
          : `<text x="${mid[0]}" y="${-mid[1] - fs * 0.4}" font-size="${fs}" text-anchor="middle">${label}</text>`;
      return `<g class="pe-dimline${d.param ? ' linked' : ''}" data-pe-dim="${i}"><path d="M${a[0]} ${-a[1]}L${b[0]} ${-b[1]}${tick(a)}${tick(b)}"/>${text}</g>`;
    })
    .join('');
}

/** Tvärsnittet med Höjd och Bredd ändrade (provmåtten; utelämnade 1,5 gånger det ritade), som ritningen gör det. */
export function stretchedMarkup(m: ProfileTypeModel, trial: { height?: number; width?: number } = {}): string {
  const base = profileSection(m, profileValues(m));
  const own: Record<string, number> = {};
  const h = base.box.maxY - base.box.minY;
  const w = base.box.maxX - base.box.minX;
  if (m.zones.some((z) => z.axis === 'height')) own[ZONE_PARAM.height] = Math.round(trial.height ?? h * 1.5);
  if (m.zones.some((z) => z.axis === 'width')) own[ZONE_PARAM.width] = Math.round(trial.width ?? w * 1.5);
  const s = profileSection(m, profileValues(m, own));
  const dimPts = (m.dims ?? []).flatMap((d): PPoint[] => (d.axis === 'height' ? [[d.at, d.from], [d.at, d.to]] : [[d.from, d.at], [d.to, d.at]]).map((q) => stretchPoint(q as PPoint, s.deltas)));
  const bx = boxOfPoints([...s.parts.flatMap((p) => p.ring), ...dimPts]);
  const pad = Math.max(20, 0.15 * Math.max(bx.maxX - bx.minX, bx.maxY - bx.minY));
  const vb = [bx.minX - pad, -bx.maxY - pad, bx.maxX - bx.minX + 2 * pad, bx.maxY - bx.minY + 2 * pad];
  const polys = s.parts.map((p, i) => `<polygon points="${p.ring.map((q) => `${q[0]},${-q[1]}`).join(' ')}" fill="${partColor(m.parts.indexOf(p.part))}" fill-opacity=".55" stroke="currentColor" stroke-width="1.2" vector-effect="non-scaling-stroke"><title>${i}</title></polygon>`).join('');
  const fields = (['height', 'width'] as const)
    .filter((a) => own[ZONE_PARAM[a]] !== undefined)
    .map((a) => `<label class="field"><span>${ZONE_PARAM[a]}</span><span class="input-unit"><input type="text" data-pe-opt="trial-${a}" value="${own[ZONE_PARAM[a]]}"><i>mm</i></span></label>`)
    .join('');
  const note = fields ? `Prova ett mått: tvärsnittet sträcks i zonerna som ett objekt med de måtten (ritad ${Math.round(h)} × ${Math.round(w)} mm). Typen ändras inte.` : 'Typen har ingen sträckzon: måtten är låsta.';
  const fs = Math.max(vb[2], vb[3]) / 26;
  const dims = dimsSvg(m.dims ?? [], fs, (q) => stretchPoint(q, s.deltas));
  return `${fields ? `<div class="fields pe-trial">${fields}</div>` : ''}<svg class="pe-canvas pe-static" viewBox="${vb.join(' ')}" preserveAspectRatio="xMidYMid meet">${polys}${dims}</svg><p class="note">${note}</p>`;
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
