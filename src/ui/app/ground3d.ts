import type { ProjectDoc } from '../../core/model';
import { groundAt, terrainOf } from '../../core/site';
import type { ViewStates } from '../../core/states';
import { groundObjects } from '../../elements/ground';
import { typeOf } from '../../elements/registry';
import { pointInRings } from '../../geometry/vec';
import { createContext } from '../../repr/context';
import type { Vec2 } from '../../repr/primitives';
import { finishedForView } from '../../repr/terrain';
import type { Ground3DHost } from '../../view3d/view3d';

/** Hur långt över marken konturen ritas, mm, så att den inte försvinner i den. */
const LIFT = 60;
/** Konturen följer marken i bitar om högst så här mycket, mm. */
const STEP = 500;

/**
 * Markobjekten i 3D-vyn (0.10.11). De är inga egna kroppar utan formar den
 * färdiga marken, så 3D-vyn träffar marken och frågar här vilket objekt som
 * ligger där, och ritar objektets kontur på marken när det hovras eller är
 * markerat. Null utan markmodell, eller när marken är släckt under Visa.
 */
export function ground3dHost(doc: ProjectDoc, view: ViewStates): Ground3DHost | null {
  const base = terrainOf(doc);
  const storey = doc.storeys[0]?.id;
  if (!base || !storey || view.hide?.includes('Terrain')) return null;
  const finished = finishedForView(doc, view);
  const t = finished?.terrain ?? base;
  const { ctx } = createContext(doc, storey, view, doc.graphics, () => true);
  const type = typeOf('Ground');
  // Det som ritas sist ligger överst, och går före när två överlappar.
  const shapes = (view.hide?.includes('Ground') ? [] : groundObjects(ctx))
    .map((el) => ({ id: el.id, polys: type?.pickShape?.(el, ctx) ?? [] }))
    .filter((s) => s.polys.length)
    .reverse();
  const height = (p: Vec2) => groundAt(t, p[0], p[1]);
  return {
    height,
    pick: (p) => shapes.find((s) => s.polys.some((rings) => pointInRings(p, rings)))?.id ?? null,
    outline(id) {
      const s = shapes.find((x) => x.id === id);
      if (!s) return null;
      const out: number[] = [];
      for (const rings of s.polys)
        for (const ring of rings)
          for (let i = 0; i < ring.length; i++) {
            const a = ring[i];
            const b = ring[(i + 1) % ring.length];
            const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / STEP));
            let prev: number[] | null = null;
            for (let k = 0; k <= n; k++) {
              const q: Vec2 = [a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n];
              const z = height(q);
              const cur = z === null ? null : [q[0], q[1], z + LIFT];
              if (prev && cur) out.push(...prev, ...cur);
              prev = cur;
            }
          }
      return out.length ? new Float32Array(out) : null;
    },
  };
}
