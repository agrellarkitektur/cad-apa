import { beforeAll, describe, expect, it } from 'vitest';
import { registerBuiltInTypes } from '../src/elements';
import { DocStore } from '../src/core/store';
import { buildPlan } from '../src/repr/plan';
import { buildSection } from '../src/repr/section';
import { drawnSegments, snapSegments } from '../src/ui/app/snapping';
import { snap } from '../src/ui/tools/snap';
import type { AppContext } from '../src/ui/app/context';
import type { Vec2 } from '../src/repr/primitives';
import { groundProject, onSlope } from './projekt';

beforeAll(() => registerBuiltInTypes());

/**
 * Granskningen efter 0.10.22 (0.10.22.1): höjdkurvorna i planen är bara
 * för smartspöt (snäppet drar inte till dem), men i fasaden och sektionen
 * snäpper man mot marklinjen (Carl Augusts svar C, 28 oktober).
 */

/** Det snäppet behöver av appen: planen eller sektionen, vyn och inställningarna. */
function fakeApp(store: DocStore, marker: string | null) {
  const vs = { state: store.doc.states.at(-1)!.id };
  const storey = store.doc.storeys[0].id;
  return {
    store,
    get plan() {
      return marker ? buildSection(store.doc, marker, vs)! : buildPlan(store.doc, storey, vs);
    },
    ui: { storey, marker, worksheet: null, tool: 'select' },
    uiSettings: { snapTrace: false },
    view: { underlayPrimitives: [], drawingScale: 100 },
    viewStates: () => vs,
  } as unknown as AppContext;
}

describe('höjdkurvorna och marklinjen (svar C)', () => {
  it('höjdkurvorna i planen är bara för spöet: snäppet drar inte till dem', () => {
    const store = new DocStore(groundProject());
    const plan = buildPlan(store.doc, 'platsen', { state: 'st-a' });
    const curves = drawnSegments(plan.prims).filter((s) => s.on === 'På höjdkurvan');
    expect(curves.length).toBeGreaterThan(0);
    expect(curves.every((s) => s.curve && s.wandOnly)).toBe(true);
    // Mitt på en höjdkurva, långt från allt annat, snäpper markören inte.
    const segs = snapSegments(fakeApp(store, null));
    const mid = (s: { a: Vec2; b: Vec2 }): Vec2 => [(s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2];
    const far = curves.find((c) => !segs.some((s) => !s.wandOnly && Math.hypot(mid(s)[0] - mid(c)[0], mid(s)[1] - mid(c)[1]) < 3000));
    expect(far).toBeDefined();
    const r = snap({ cursor: mid(far!), segments: segs, tol: 50 });
    expect(r.kind).toBe('free');
  });

  it('i sektionen snäpper man mot marklinjen, som en kurva utan ändpunkter i varje steg', () => {
    const store = onSlope();
    const segs = snapSegments(fakeApp(store, 'sektion-a'));
    const ground = segs.filter((s) => s.on === 'På marken');
    expect(ground.length).toBeGreaterThan(2);
    expect(ground.every((s) => s.curve && !s.wandOnly)).toBe(true);
    const midOf = (q: { a: Vec2; b: Vec2 }): Vec2 => [(q.a[0] + q.b[0]) / 2, (q.a[1] + q.b[1]) / 2];
    const mid = midOf(ground[Math.floor(ground.length / 2)]);
    // Strax över marken drar markören ned på marklinjen.
    const r = snap({ cursor: [mid[0], mid[1] + 30], segments: segs, tol: 50 });
    expect(r.kind).not.toBe('free');
    expect(Math.abs(r.point[1] - mid[1])).toBeLessThan(1);
    // Marklinjen ensam ger texten, utan ändpunkter i stegen.
    const alone = snap({ cursor: [mid[0], mid[1] + 30], segments: ground, tol: 50 });
    expect(alone.kind).toBe('on-wall');
    expect(alone.label).toBe('På marken');
    const atStep = snap({ cursor: ground[1].a, segments: ground, tol: 50 });
    expect(atStep.kind).toBe('on-wall');
  });
});
