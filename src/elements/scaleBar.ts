import type { Id } from '../core/model';
import type { Primitive, Vec2 } from '../repr/primitives';
import type { ElementType, PlanContext } from './registry';

/**
 * Skalstock på ett blad (0.8.12, format 11). Ritas i mm på papperet, som
 * det andra som är ritat på bladet, och går att flytta när som helst.
 * Skalan hämtas från en vy på samma blad (`view`) eller anges själv
 * (`scale`).
 *
 * Utseendet följer Carl Augusts skalstockar (DXF:en *skalstockar till
 * cad-apa*): en 100 mm lång linje med långa streck (0,7) vid de numrerade
 * lägena, mellanstreck (0,35) och korta streck (0,18) i första fältet,
 * rubriken SKALA 1:n ovanför, talen under och enheten under dem. Hans tolv
 * skalor finns som de är i `BARS`; andra skalor tar indelningen från den
 * närmaste av dem med samma siffror (1:200 från 1:2000), och de som inte
 * har någon sådan delas in efter jämna tal.
 */
export interface ScaleBarParams {
  /** Linjens vänstra ände, mm på papperet. */
  pos: [number, number];
  /** Skalans nämnare när ingen vy är vald. */
  scale: number;
  /** En vy på bladet (dess id på bladet) som skalan hämtas från. */
  view?: Id;
}

/** Strecken: längd och linjebredd, mm på papperet. */
const TICK = { M: [5, 0.7], m: [4, 0.35], s: [3, 0.18], S: [4, 0.18] } as const;

/** Carl Augusts skalstockar: strecken (läge i mm och slag) och talen, i meter (1:1 i millimeter). */
const BARS: Record<number, { ticks: string; labels: string[] }> = {
  1: { ticks: '0M 1s 2s 3s 4s 5m 6s 7s 8s 9s 10M 15m 20M 25m 30M 35m 40M 45m 50M 55m 60M 65m 70M 75m 80M 85m 90M 95m 100M', labels: ['0', '10', '20', '50', '100'] },
  5: { ticks: '0M 2s 4s 6s 8s 10m 12s 14s 16s 18s 20M 30m 40M 50m 60M 70m 80M 90m 100M', labels: ['0', '0,1', '0,2', '0,5'] },
  10: { ticks: '0M 1s 2s 3s 4s 5m 6s 7s 8s 9s 10M 15m 20M 25m 30M 35m 40M 45m 50M 55m 60M 65m 70M 75m 80M 85m 90M 95m 100M', labels: ['0', '0,1', '0,2', '0,5', '1,0'] },
  20: { ticks: '0M 0.5s 1s 1.5s 2s 2.5m 3s 3.5s 4s 4.5s 5M 7.5m 10M 12.5m 15M 17.5m 20M 22.5m 25M 27.5m 30M 32.5m 35M 37.5m 40M 42.5m 45M 47.5m 50M 75M 100M', labels: ['0', '0,1', '0,5', '1', '1,5', '2'] },
  25: { ticks: '0M 2s 4m 6s 8m 10s 12m 14s 16m 18s 20M 24m 28m 32m 36m 40M 60M 80M 100M', labels: ['0', '0,5', '1', '1,5', '2', '2,5'] },
  50: { ticks: '0M 2s 4s 6s 8s 10S 12s 14s 16s 18s 20M 30m 40M 50m 60M 70m 80M 90m 100M', labels: ['0', '1', '2', '5'] },
  100: { ticks: '0M 1s 2s 3s 4s 5m 6s 7s 8s 9s 10M 15m 20M 25m 30M 35m 40M 45m 50M 60M 70M 80M 90M 100M', labels: ['0', '1', '2', '5', '10'] },
  1000: { ticks: '0M 1s 2s 3s 4s 5m 6s 7s 8s 9s 10M 15m 20M 25m 30M 35m 40M 45m 50M 60M 70M 80M 90M 100M', labels: ['0', '5', '10', '20', '50', '100'] },
  2000: { ticks: '0M 0.5s 1s 1.5s 2s 2.5m 3s 3.5s 4s 4.5s 5M 7.5m 10M 12.5m 15M 17.5m 20M 22.5m 25M 30M 35M 40M 45M 50M 75M 100M', labels: ['0', '10', '20', '50', '100', '150', '200'] },
  2500: { ticks: '0M 2s 4m 6s 8m 10s 12m 14s 16m 18s 20M 24m 28m 32m 36m 40M 60M 80M 100M', labels: ['0', '50', '100', '150', '200', '250'] },
  4000: { ticks: '0M 0.25s 0.5s 0.75s 1s 1.25m 1.5s 1.75s 2s 2.25s 2.5M 3.75m 5M 6.25m 7.5M 8.75m 10M 11.25m 12.5M 15M 17.5M 20M 22.5M 25M 37.5M 50M 75M 100M', labels: ['0', '10', '50', '100', '150', '200', '300', '400'] },
  5000: { ticks: '0M 2s 4s 6s 8s 10m 12s 14s 16s 18s 20M 30m 40M 60M 80M 100M', labels: ['0', '50', '100', '200', '500'] },
};

/** En skalstock färdig att rita: strecken, talen och enheten, mm från linjens vänstra ände. */
export interface ScaleBarLayout {
  length: number;
  ticks: { x: number; kind: keyof typeof TICK }[];
  labels: { x: number; text: string }[];
  unit: 'METER' | 'MILLIMETER';
}

const num = (s: string) => Number(s.replace(',', '.'));
const fmt = (v: number) => String(Math.round(v * 1e6) / 1e6).replace('.', ',');

/** Skalstockens indelning för en skala (nämnaren). */
export function scaleBarLayout(scale: number): ScaleBarLayout {
  const s = scale > 0 ? scale : 100;
  const mm = s <= 2;
  // Ett tal på skalstocken (meter, eller mm för 1:1 och 1:2) ligger value·1000/s mm in.
  const at = (v: number) => (mm ? v / s : (v * 1000) / s);
  const parse = (str: string): ScaleBarLayout['ticks'] =>
    str.split(' ').map((t) => ({ x: Number(t.slice(0, -1)), kind: t.slice(-1) as keyof typeof TICK }));
  // Samma siffror som en av hans skalor (1:200 som 1:2000), helst den närmaste och annars den större.
  const keys = Object.keys(BARS).map(Number);
  const twin = keys
    .map((k) => ({ k, e: Math.log10(s / k) }))
    .filter((c) => Math.abs(c.e - Math.round(c.e)) < 1e-9)
    .sort((a, b) => Math.abs(a.e) - Math.abs(b.e) || b.k - a.k)[0];
  if (twin) {
    const bar = BARS[twin.k];
    const f = 10 ** Math.round(twin.e);
    // Talen i hans skalstock är meter (1:1 mm); här i den här skalans enhet.
    const value = (l: string) => num(l) * f * (twin.k <= 2 ? 1 : 1000) / (mm ? 1 : 1000);
    const labels = bar.labels.map((l) => {
      const v = value(l);
      return { x: at(v), text: f === 1 ? l : fmt(v) };
    });
    return { length: 100, ticks: parse(bar.ticks), labels, unit: mm ? 'MILLIMETER' : 'METER' };
  }
  // Annars: jämna tal (1, 2, 2,5 eller 5 gånger tiopotenser), 4–10 fält, linjen så lång att den slutar på ett tal.
  const total = mm ? 100 * s : (100 * s) / 1000;
  const p = 10 ** Math.floor(Math.log10(total / 5));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((x) => total / x <= 10) ?? 10 * p;
  const n = Math.max(1, Math.floor(total / step + 1e-9));
  const length = at(n * step);
  const ticks: ScaleBarLayout['ticks'] = [];
  for (let i = 0; i <= n; i++) ticks.push({ x: at(i * step), kind: 'M' });
  for (let i = 1; i < 10; i++) ticks.push({ x: at((i * step) / 10), kind: i === 5 ? 'm' : 's' });
  ticks.sort((a, b) => a.x - b.x);
  const labels = [0, 1, 2, n % 2 === 0 ? n / 2 : -1, n].filter((i, k, a) => i >= 0 && i <= n && a.indexOf(i) === k).map((i) => ({ x: at(i * step), text: fmt(i * step) }));
  return { length, ticks, labels, unit: mm ? 'MILLIMETER' : 'METER' };
}

/** Skalan skalstocken visar: vyns på bladet om en är vald och finns, annars den egna. */
export function scaleBarScale(p: ScaleBarParams, ctx: Pick<PlanContext, 'doc'>): number {
  if (p.view) {
    for (const s of ctx.doc.sheets) {
      const vp = s.viewports.find((v) => v.id === p.view);
      if (vp) return vp.scale;
    }
  }
  return p.scale > 0 ? p.scale : 100;
}

/** Texthöjden på skalstocken, mm (som i hans DXF). */
const TEXT = 3;

export const scaleBarType: ElementType<ScaleBarParams> = {
  type: 'ScaleBar',
  label: 'Skalstock',
  labelPlural: 'Skalstockar',
  drawOrder: 92,
  compares: false,
  planReads: [],
  defaults: () => ({ pos: [0, 0], scale: 100 }),
  plan(el, ctx) {
    const p = ctx.params<ScaleBarParams>(el);
    const scale = scaleBarScale(p, ctx);
    const b = scaleBarLayout(scale);
    const [x, y] = p.pos;
    const origin = { objectId: el.id, objectType: 'ScaleBar' };
    const pt = (dx: number, dy: number): Vec2 => [x + dx, y + dy];
    const out: Primitive[] = [{ kind: 'line', a: pt(0, 0), b: pt(b.length, 0), pen: { weight: 0.7 }, origin }];
    for (const t of b.ticks) {
      const [len, weight] = TICK[t.kind];
      out.push({ kind: 'line', a: pt(t.x, -len / 2), b: pt(t.x, len / 2), pen: { weight }, origin });
    }
    const pen = { weight: 0.25 };
    out.push({ kind: 'text', at: pt(0, 6), text: `SKALA 1:${scale}`, height: TEXT, pen, origin });
    for (const l of b.labels) out.push({ kind: 'text', at: pt(l.x, -8.5), text: l.text, height: TEXT, align: 'middle', pen, origin });
    out.push({ kind: 'text', at: pt(0, -13), text: b.unit, height: TEXT, pen, origin });
    return out;
  },
  pickShape(el, ctx) {
    const p = ctx.params<ScaleBarParams>(el);
    const len = scaleBarLayout(scaleBarScale(p, ctx)).length;
    const [x, y] = p.pos;
    return [[[[x - 2, y - 14], [x + len + 2, y - 14], [x + len + 2, y + 9.5], [x - 2, y + 9.5]]]];
  },
};
