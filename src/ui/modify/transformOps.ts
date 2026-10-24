import { moveElements } from '../../core/commands';
import { rotateElements } from '../../core/transforms';
import { mirrorAbout, multiplyElements } from '../../core/wallEdit';
import { angleDeg, dist, left, sub } from '../../geometry/vec';
import type { Vec2 } from '../../repr/primitives';
import type { Camera } from '../../view2d/camera';
import { lengthLabel } from '../tools/overlay';
import { ghostOf, svgLine } from './draw';
import type { OpId } from './ops';
import type { ModifyState } from './state';

/**
 * Flytta, Vrid, Spegla och Kopiera i rad (0.8.15, ur tool.ts): val som utgår
 * från en baspunkt (0.8.13) och gäller allt markerat.
 */
export const BASE_OPS = new Set<OpId>(['move', 'rotate', 'mirror', 'multiply']);

/** Utför valet; svarar true när verktyget är klart, false när det väntar kvar. */
export function commitTransform(s: ModifyState, base: Vec2, at: Vec2 | null, typed: number | null): boolean {
  const store = s.host.store;
  const ids = s.ctx.ids;
  switch (s.op) {
    case 'move': {
      if (!at) return false;
      const d = sub(at, base);
      if (Math.hypot(d[0], d[1]) < 1) return false;
      moveElements(store, ids, [Math.round(d[0]), Math.round(d[1])]);
      return true;
    }
    case 'rotate': {
      let deg: number;
      if (typed !== null) deg = typed;
      else if (at && s.ref) deg = Math.round((angleDeg(sub(at, base)) - angleDeg(sub(s.ref, base))) * 10) / 10;
      else return false;
      rotateElements(store, ids, [Math.round(base[0]), Math.round(base[1])], deg);
      return true;
    }
    case 'mirror':
      if (!at || dist(at, base) < 1) return false;
      mirrorAbout(store, ids, base, at);
      return true;
    case 'multiply': {
      if (!at) return false;
      const d = sub(at, base);
      if (Math.hypot(d[0], d[1]) < 1) return false;
      multiplyElements(store, ids, [Math.round(d[0]), Math.round(d[1])], typed ?? s.value);
      return true;
    }
    default:
      return true;
  }
}

/** Förhandsvisningen med markören vid `at`. */
export function overlayTransform(s: ModifyState, cam: Camera, base: Vec2, at: Vec2 | null, out: string[]): void {
  if (!at) return;
  const ids = s.ctx.ids;
  const line = (pts: readonly Vec2[], cls?: string) => svgLine(cam, pts, cls);
  switch (s.op) {
    case 'move':
    case 'multiply': {
      const d = sub(at, base);
      const n = s.op === 'multiply' ? Math.max(1, Math.min(50, Math.round(s.value))) : 1;
      for (let k = 1; k <= n; k++) out.push(ghostOf(s.host, ids, (q) => [q[0] + d[0] * k, q[1] + d[1] * k], cam));
      out.push(line([base, at]));
      break;
    }
    case 'rotate':
      out.push(line([base, at]));
      if (s.ref) {
        out.push(line([base, s.ref], 'snap-guide'));
        const deg = angleDeg(sub(at, base)) - angleDeg(sub(s.ref, base));
        const r = (deg * Math.PI) / 180;
        const c = Math.cos(r);
        const sn = Math.sin(r);
        out.push(ghostOf(s.host, ids, (q) => [base[0] + (q[0] - base[0]) * c - (q[1] - base[1]) * sn, base[1] + (q[0] - base[0]) * sn + (q[1] - base[1]) * c], cam));
        out.push(lengthLabel(cam, base, at, `${(Math.round((((deg % 360) + 360) % 360) * 10) / 10).toLocaleString('sv-SE')}°`));
      }
      break;
    case 'mirror':
      if (dist(at, base) > 1) {
        const len = dist(at, base);
        const u: Vec2 = [(at[0] - base[0]) / len, (at[1] - base[1]) / len];
        const n = left(u);
        out.push(line([[base[0] - u[0] * 20000, base[1] - u[1] * 20000], [base[0] + u[0] * 20000, base[1] + u[1] * 20000]], 'snap-guide'));
        out.push(
          ghostOf(
            s.host,
            ids,
            (q) => {
              const o = (q[0] - base[0]) * n[0] + (q[1] - base[1]) * n[1];
              return [q[0] - 2 * o * n[0], q[1] - 2 * o * n[1]];
            },
            cam,
          ),
        );
      }
      break;
    default:
      break;
  }
}
