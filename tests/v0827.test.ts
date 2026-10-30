import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SWEDISH_STANDARD, type StyleSheet } from '../src/core/graphics';
import { visibleSegments, type Seg } from '../src/geometry/hiddenLine';
import { defaultMarkerPen } from '../src/repr/markerPens';
import { applyActionField } from '../src/ui/style/actions';
import { applyLabelField } from '../src/ui/style/labels';
import { applyPenField, resetPen } from '../src/ui/style/pens';

/**
 * Granskningen (0.8.27): rutnätet i de dolda linjerna ändrar bara hur fort
 * det går, appens stilar ligger i flera filer i samma ordning, och
 * stilmallens delar ändrar samma saker som förut.
 */

/** Ett slumpat men upprepbart bråktal 0–1. */
function lcg(seed: number): () => number {
  let n = seed;
  return () => {
    n = (n * 1103515245 + 12345) & 0x7fffffff;
    return n / 0x7fffffff;
  };
}

/**
 * En låg, bred fasad: väggbitar som rektanglar på olika djup, med sina
 * kanter, och några sneda kanter tvärs över.
 */
function scene(seed: number, width = 48000, height = 3000) {
  const r = lcg(seed);
  const tris: number[] = [];
  const segs: Seg<number>[] = [];
  for (let i = 0; i < 400; i++) {
    const x = r() * width;
    const y = r() * height * 0.5;
    const w = 300 + r() * 4000;
    const h = 200 + r() * height;
    const d = r() * 20000;
    const tilt = (r() - 0.5) * 200;
    const c = [
      [x, y, d],
      [x + w, y, d + tilt],
      [x + w, y + h, d + tilt],
      [x, y + h, d],
    ];
    tris.push(...c[0], ...c[1], ...c[2], ...c[0], ...c[2], ...c[3]);
    for (let k = 0; k < 4; k++) segs.push({ a: c[k] as [number, number, number], b: c[(k + 1) % 4] as [number, number, number], key: i * 4 + k });
  }
  for (let i = 0; i < 40; i++) segs.push({ a: [r() * width, r() * height, r() * 20000], b: [r() * width, r() * height, r() * 20000], key: 10000 + i });
  return { segs, tris };
}

describe('dolda linjer (0.8.27)', () => {
  it('ger samma linjer med vilka rutor som helst, också en enda ruta', () => {
    for (const seed of [1, 2]) {
      const { segs, tris } = scene(seed);
      const usual = visibleSegments(segs, [tris]);
      expect(usual.length).toBeGreaterThan(100);
      expect(visibleSegments(segs, [tris], 1e9)).toEqual(usual);
      expect(visibleSegments(segs, [tris], 40)).toEqual(usual);
      expect(visibleSegments(segs, [tris], 1500)).toEqual(usual);
    }
  });

  it('en hög smal bild fungerar lika bra som en låg bred', () => {
    const { segs, tris } = scene(7, 3000, 48000);
    expect(visibleSegments(segs, [tris], 1e9)).toEqual(visibleSegments(segs, [tris]));
  });
});

describe('appens stilar (0.8.27)', () => {
  it('app.css läser varje fil i src/styles en gång', () => {
    const app = readFileSync('src/styles/app.css', 'utf8');
    const imported = [...app.matchAll(/@import '\.\/([^']+)';/g)].map((m) => m[1]);
    const files = readdirSync('src/styles').filter((f) => f.endsWith('.css') && f !== 'app.css');
    expect([...imported].sort()).toEqual([...files].sort());
    expect(new Set(imported).size).toBe(imported.length);
    // Bara importerna och en kommentar: inga egna regler, som annars skulle
    // hamna före alla filer (@import måste stå först).
    expect(app.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@import '[^']+';/g, '').trim()).toBe('');
  });
});

describe('stilmallens delar (0.8.27)', () => {
  const field = (data: Record<string, string>, value: string, checked = false) =>
    ({ dataset: data, value, checked }) as unknown as HTMLInputElement;
  const fresh = (): StyleSheet => structuredClone(SWEDISH_STANDARD);

  it('varje del svarar bara för sina egna fält', () => {
    const s = fresh();
    expect(applyPenField(s, field({ lab: 'align' }, 'center'))).toBeNull();
    expect(applyLabelField(s, field({ key: 'existing', field: 'fill' }, 'hatch'))).toBeNull();
    expect(applyActionField(s, field({ pen: 'north:weight' }, '0.5'))).toBeNull();
    expect(s).toEqual(fresh());
  });

  it('pennor: förvalet sparas inte, och Förval tar bort det ändrade', () => {
    const s = fresh();
    const weight = defaultMarkerPen('sectionLine').weight;
    expect(applyPenField(s, field({ pen: 'sectionLine:weight' }, '0.7'))).toBe('Ändra pennor');
    expect(s.pens?.sectionLine?.weight).toBe(0.7);
    applyPenField(s, field({ pen: 'sectionLine:weight' }, String(weight)));
    expect(s.pens?.sectionLine).toBeUndefined();
    applyPenField(s, field({ pen: 'north:color' }, '#cc2200'));
    expect(resetPen(s, 'north')).toBe(true);
    expect(resetPen(s, 'north')).toBe(false);
    expect(s.pens).toBeUndefined();
  });

  it('åtgärder och texter', () => {
    const s = fresh();
    expect(applyActionField(s, field({ key: 'existing', field: 'fill' }, 'hatch'))).toBe('Ändra stilboken');
    expect(s.actions.existing.cutFill.kind).toBe('hatch');
    applyActionField(s, field({ key: 'new', field: 'door' }, '120'));
    expect(s.actions.new.doorAngle).toBe(90);
    expect(applyLabelField(s, field({ lab: 'room' }, '{nummer}\n{namn}'))).toBe('Ändra texter');
    expect(s.labels.room).toBe('{nummer}\n{namn}');
  });
});
