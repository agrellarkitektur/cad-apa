import type { Rings } from '../geometry/boolean';
import { BoxIndex } from '../geometry/boxIndex';
import type { Vec2 } from './primitives';

/** En bit av en kontur och objektet den hör till (null = inget eget). */
export interface OwnedOutline {
  id: string | null;
  points: Vec2[];
  closed: boolean;
}

/**
 * Konturen runt sammanslagna ytor (väggarna, snitten) delad efter vilket
 * objekt varje kant kommer ifrån (0.8.31), så att en vägg med egen penna
 * får den på sina kanter medan ytan förblir en, utan skarvar. En kant hör
 * till den första biten i `pieces` som har en kant längs den (mitten
 * inom `tol` mm från kanten och samma riktning); en kant utan bit får
 * `id` null. Utan något i `owned` delas ingenting.
 *
 * En ring som hör till ett enda objekt blir en sluten linje; annars börjar
 * varje bit där ägaren byts.
 */
export function ownedOutlines(regions: readonly Rings[], pieces: readonly { id: string; rings: Rings }[], owned: ReadonlySet<string>, tol = 0.5): OwnedOutline[] {
  // Bara ytor med en egen penna behöver delas; då får alla kanter sin ägare.
  if (!owned.size) return regions.flatMap((rings) => rings.map((r): OwnedOutline => ({ id: null, points: [...r], closed: true })));
  const { split, ownerOf } = edgeOwners(pieces, tol);

  const out: OwnedOutline[] = [];
  for (const rings of regions)
    for (const raw of rings) {
      const ring: Vec2[] = raw.flatMap((p, i) => split(p, raw[(i + 1) % raw.length]).slice(0, -1));
      const n = ring.length;
      if (n < 2) continue;
      const owners = ring.map((p, i) => ownerOf(p, ring[(i + 1) % n]));
      if (owners.every((o) => o === owners[0])) {
        out.push({ id: owners[0], points: [...raw], closed: true });
        continue;
      }
      // Börja där ägaren byts, så att ingen bit delas vid ringens början.
      const start = owners.findIndex((o, i) => o !== owners[(i + n - 1) % n]);
      let cur: OwnedOutline | null = null;
      for (let k = 0; k < n; k++) {
        const i = (start + k) % n;
        const a = ring[i];
        const b = ring[(i + 1) % n];
        if (cur && cur.id === owners[i]) cur.points.push(b);
        else out.push((cur = { id: owners[i], points: [a, b], closed: false }));
      }
    }
  return out;
}

/**
 * Vem en kant i en sammanslagen kontur kommer ifrån (0.8.31; för väggarnas
 * kantlinjer i 3D sedan 0.10.1). `ownerOf` ger den första biten som har en
 * kant längs kanten (mitten inom `tol` mm och samma riktning, åt något
 * håll), annars null. Den sammanslagna konturen har färre hörn än bitarna
 * (raka kanter genom flera väggar blir en), så `split` delar en kant där en
 * bits kant börjar eller slutar; ändpunkterna är med.
 */
export function edgeOwners(pieces: readonly { id: string; rings: Rings }[], tol = 0.5): { split: (a: Vec2, b: Vec2) => Vec2[]; ownerOf: (a: Vec2, b: Vec2) => string | null } {
  const segs: { id: string; a: Vec2; b: Vec2 }[] = [];
  for (const piece of pieces) {
    for (const ring of piece.rings) for (let i = 0; i < ring.length; i++) segs.push({ id: piece.id, a: ring[i], b: ring[(i + 1) % ring.length] });
  }
  const index = new BoxIndex(2000);
  segs.forEach((s, i) => index.add(i, [Math.min(s.a[0], s.b[0]) - tol, Math.min(s.a[1], s.b[1]) - tol, Math.max(s.a[0], s.b[0]) + tol, Math.max(s.a[1], s.b[1]) + tol]));
  const ownerOf = (a: Vec2, b: Vec2): string | null => {
    const m: Vec2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (const i of index.at(m)) {
      const s = segs[i];
      const dx = s.b[0] - s.a[0];
      const dy = s.b[1] - s.a[1];
      const sl = Math.hypot(dx, dy);
      if (sl < 1e-9 || l < 1e-9) continue;
      // Samma riktning (åt något håll) och mitten på kanten.
      if (Math.abs(dx * (b[1] - a[1]) - dy * (b[0] - a[0])) > 1e-3 * sl * l) continue;
      const t = ((m[0] - s.a[0]) * dx + (m[1] - s.a[1]) * dy) / (sl * sl);
      if (t < -1e-6 || t > 1 + 1e-6) continue;
      const d = Math.abs((m[0] - s.a[0]) * dy - (m[1] - s.a[1]) * dx) / sl;
      if (d <= tol) return s.id;
    }
    return null;
  };
  const split = (a: Vec2, b: Vec2): Vec2[] => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy;
    if (l2 < 1e-12) return [a, b];
    const l = Math.sqrt(l2);
    const box: [number, number, number, number] = [Math.min(a[0], b[0]) - tol, Math.min(a[1], b[1]) - tol, Math.max(a[0], b[0]) + tol, Math.max(a[1], b[1]) + tol];
    const ts = new Set<number>();
    for (const i of index.near(box)) {
      for (const q of [segs[i].a, segs[i].b]) {
        if (Math.abs((q[0] - a[0]) * dy - (q[1] - a[1]) * dx) / l > tol) continue;
        const t = ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / l2;
        if (t > 1e-6 && t < 1 - 1e-6) ts.add(t);
      }
    }
    return [a, ...[...ts].sort((x, y) => x - y).map((t): Vec2 => [a[0] + dx * t, a[1] + dy * t]), b];
  };
  return { split, ownerOf };
}
