import type { Vec2 } from '../../repr/primitives';
import type { Camera } from '../../view2d/camera';
import type { SnapSegment } from '../tools/snap';
import type { AppContext } from './context';

/**
 * Segmentpunkter (0.8.18): tillfälliga punkter att snäppa till, som
 * måttbandet lägger när en mätning delas i lika delar. De sparas inte i
 * projektet och gäller vyn de lades i (våningen, fasaden, sektionen eller
 * bladet), tills man väljer Rensa segmentpunkter.
 */
export function installSegmentPoints(app: AppContext) {
  const byPlace = new Map<string, Vec2[]>();
  const placeKey = () => {
    const u = app.ui;
    return u.worksheet ? `blad:${u.worksheet}` : u.marker ? `vy:${u.marker}` : `plan:${u.storey}`;
  };
  const current = () => byPlace.get(placeKey()) ?? [];

  app.view.decorator = (cam: Camera) => {
    if (app.ui.mode === '3d') return '';
    return current()
      .map((p) => {
        const [x, y] = cam.toScreen(p);
        return `<path d="M${x - 4} ${y - 4}L${x + 4} ${y + 4}M${x + 4} ${y - 4}L${x - 4} ${y + 4}" class="segment-point"/>`;
      })
      .join('');
  };

  return {
    /** Punkterna i vyn som är öppen. */
    get points(): readonly Vec2[] {
      return current();
    },
    /** Totalt antal, i alla vyer. */
    get count(): number {
      let n = 0;
      for (const v of byPlace.values()) n += v.length;
      return n;
    },
    add(pts: readonly Vec2[]): void {
      if (!pts.length) return;
      byPlace.set(placeKey(), [...current(), ...pts.map((p) => [p[0], p[1]] as Vec2)]);
      app.view.requestRender();
    },
    clear(): void {
      byPlace.clear();
      app.view.requestRender();
    },
    /** Som snäppunkter. */
    segments(): SnapSegment[] {
      return current().map((p) => ({ id: 'segmentpunkt', a: p, b: p, point: 'division' as const }));
    },
  };
}

export type SegmentPoints = ReturnType<typeof installSegmentPoints>;
