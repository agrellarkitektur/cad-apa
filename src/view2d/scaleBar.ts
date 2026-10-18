import type { Camera } from './camera';

/**
 * Skalstock i vyns hörn: fyra fält, växelvis fyllda, med en jämn längd ur
 * serien 1 · 2 · 5 · 10 … mm så att den blir 60–140 px bred.
 */
export function renderScaleBar(cam: Camera, x: number, y: number): string {
  const length = niceLength(100 / cam.scale);
  const px = length * cam.scale;
  const seg = px / 4;
  const h = 5;
  const parts: string[] = [];
  for (let i = 0; i < 4; i++) {
    parts.push(
      `<rect x="${x + i * seg}" y="${y}" width="${seg}" height="${h}" class="${i % 2 ? 'sb-light' : 'sb-dark'}"/>`,
    );
  }
  parts.push(`<rect x="${x}" y="${y}" width="${px}" height="${h}" class="sb-frame"/>`);
  parts.push(`<text x="${x}" y="${y - 6}" class="sb-label">0</text>`);
  parts.push(`<text x="${x + px}" y="${y - 6}" class="sb-label" text-anchor="middle">${formatLength(length)}</text>`);
  return parts.join('');
}

function niceLength(target: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(target)));
  for (const m of [1, 2, 5, 10]) {
    if (m * p >= target * 0.6) return m * p;
  }
  return 10 * p;
}

function formatLength(mm: number): string {
  if (mm >= 1000) return `${(mm / 1000).toLocaleString('sv-SE')} m`;
  return `${mm.toLocaleString('sv-SE')} mm`;
}
