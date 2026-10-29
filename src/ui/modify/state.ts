import { geometryOf } from '../../core/commands';
import type { Element, Id } from '../../core/model';
import { pathOf, type EditResult } from '../../core/trimEdit';
import { distToSegment } from '../../geometry/vec';
import type { Vec2 } from '../../repr/primitives';
import { labelOf } from '../labels';
import type { ToolHost } from '../tools/host';
import type { ModifyContext, OpId } from './ops';

/**
 * Det valen i Modifiera läser av verktyget (0.8.15). `ModifyTool` i tool.ts
 * håller läget; valen ligger i grupper i egna filer (wallOps, outlineOps,
 * cutOps och transformOps) med en funktion som utför och en som ritar
 * förhandsvisningen.
 */
export interface ModifyState {
  readonly host: ToolHost;
  readonly op: OpId;
  readonly ctx: ModifyContext;
  /** Värdet i rutan: radie, avstånd, antal … */
  readonly value: number;
  /** Förskjut (0.10.17): hur många kanter, symmetriskt kring den klickade; 0 = alla. */
  readonly edges: number;
  /** Förskjut (0.10.29): det som skrivits vid objektet, som tal, eller null. */
  readonly typed: number | null;
  /** Förskjut (0.10.29): det som skrivits vid objektet, som text, eller null. */
  readonly typing: string | null;
  /** Vrid: riktningen man vrider från, när den klickats. */
  readonly ref: Vec2 | null;
  /** Hörnskarv: den första väggen eller linjen och var man klickade på den. */
  readonly first: { id: Id; at: Vec2 } | null;
  /** Var markören är, utan snäppning (Trimma och Hörnskarv tittar på vad den pekar på). */
  readonly hoverAt: Vec2 | null;
}

/** Väggen valet gäller, om det gäller en. */
export function wallOf(s: ModifyState): Element | undefined {
  return s.ctx.wallId ? s.host.store.doc.elements[s.ctx.wallId] : undefined;
}

/** Elementet bland `ids` närmast punkten (väggar räknas till livet), inom `tol`. */
export function nearestOf(host: ToolHost, ids: readonly Id[], at: Vec2, ok: (el: Element | undefined) => boolean, tol: number): Id | null {
  const doc = host.store.doc;
  let best: { id: Id; d: number } | null = null;
  for (const id of ids) {
    const el = doc.elements[id];
    if (!ok(el)) continue;
    const pts = pathOf(el);
    let d = Infinity;
    for (let i = 0; i + 1 < pts.length; i++) d = Math.min(d, distToSegment(at, pts[i], pts[i + 1]));
    if (el.type === 'Wall') d = Math.max(0, d - Number(geometryOf(doc, el).thickness) / 2);
    if (d <= tol && (!best || d < best.d)) best = { id, d };
  }
  return best?.id ?? null;
}

/** Säg varför en ändring inte gick; svarar true om den gick. */
export function reportEdit(host: ToolHost, r: EditResult): boolean {
  if (r.ok) return true;
  if (r.blocked?.length) {
    const doc = host.store.doc;
    const names = r.blocked.map((id) => labelOf(doc, doc.elements[id])).join(', ');
    host.hint(`${names} ${r.reason === 'trimmas bort' ? 'ligger i biten som skulle tas bort' : 'skulle hamna utanför väggen'}. Flytta ${r.blocked.length > 1 ? 'dem' : 'den'} först.`, 5000);
  } else host.hint(r.reason, 3500);
  return false;
}
