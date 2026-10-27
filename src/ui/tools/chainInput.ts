import { shapePoints } from '../../elements/drawing2d';
import { bulgeThrough, STRAIGHT } from '../../geometry/arc';
import { dist } from '../../geometry/vec';
import type { Vec2 } from '../../repr/primitives';

/**
 * En sluten kontur som klickas punkt för punkt, med bågar direkt (0.10.17):
 * takets kontur och bjälklagets håltagning. När *Båge* är på blir nästa
 * kant en båge: klicka var den slutar och sedan en punkt på den (som 2D-formens
 * båge). Ett klick på första punkten sluter konturen; med *Båge* på blir
 * också den sista kanten en båge. Pilhöjderna följer 2D-formens regel: kant
 * i går från punkt i till i + 1, den sista tillbaka till den första.
 */
export class ChainInput {
  points: Vec2[] = [];
  /** Pilhöjd per kant mellan punkterna, i ritordning. */
  private bulges: number[] = [];
  /** Nästa kant är en båge. */
  arc = false;
  /** En båge väntar på punkten den ska gå igenom: dess slut (första punkten när konturen sluts). */
  private arcEnd: { at: Vec2; closing: boolean } | null = null;

  get count(): number {
    return this.points.length;
  }

  /** En båge väntar på sin mittpunkt. */
  get waiting(): boolean {
    return !!this.arcEnd;
  }

  /** Om konturen går att sluta: tre punkter, eller två när en kant är (eller blir) en båge. */
  get canClose(): boolean {
    return !this.arcEnd && (this.points.length >= 3 || (this.points.length === 2 && (this.arc || this.bulges.some((b) => b))));
  }

  /**
   * Ett klick. `closeTol` är hur nära första punkten ett klick ska vara för
   * att sluta konturen. Svarar 'closed' när konturen är sluten, annars
   * 'added' (en punkt till) eller 'wait' (bågen väntar på sin mittpunkt).
   */
  click(pt: Vec2, closeTol: number): 'added' | 'closed' | 'wait' | 'none' {
    const last = this.points.at(-1);
    if (this.arcEnd && last) {
      const b = bulgeThrough(last, this.arcEnd.at, pt);
      const bulge = Math.abs(b) >= STRAIGHT ? Math.round(b * 10) / 10 : 0;
      const { at, closing } = this.arcEnd;
      this.arcEnd = null;
      this.bulges.push(bulge);
      if (closing) return 'closed';
      this.points.push(at);
      return 'added';
    }
    if (this.points.length >= 2 && dist(pt, this.points[0]) <= closeTol && (this.points.length >= 3 || this.arc)) {
      if (this.arc) {
        this.arcEnd = { at: this.points[0], closing: true };
        return 'wait';
      }
      this.bulges.push(0);
      return 'closed';
    }
    if (last && dist(pt, last) < 1) return 'none';
    if (this.arc && last) {
      this.arcEnd = { at: pt, closing: false };
      return 'wait';
    }
    if (last) this.bulges.push(0);
    this.points.push(pt);
    return 'added';
  }

  /** Sluta konturen med en rak sista kant (Enter, Klar). */
  close(): boolean {
    if (!this.canClose) return false;
    this.bulges.push(0);
    return true;
  }

  /** Ta bort det senaste klicket. */
  undo(): void {
    if (this.arcEnd) {
      this.arcEnd = null;
      return;
    }
    this.points.pop();
    this.bulges.length = Math.max(0, this.points.length - 1);
  }

  /** En sluten kontur öppnad igen (Ångra efter att den slutits): utan den slutande kanten. */
  load(points: readonly [number, number][], bulges?: readonly number[]): void {
    this.points = points.map((q): Vec2 => [q[0], q[1]]);
    this.bulges = this.points.slice(1).map((_, i) => bulges?.[i] ?? 0);
    this.arcEnd = null;
  }

  reset(): void {
    this.points = [];
    this.bulges = [];
    this.arcEnd = null;
  }

  /** Konturen som punkter och pilhöjder (en per kant, den sista tillbaka till början), när den är sluten. */
  result(): { points: [number, number][]; bulges?: number[] } {
    const points = this.points.map((q): [number, number] => [Math.round(q[0]), Math.round(q[1])]);
    const b = this.bulges.slice(0, points.length);
    return b.some((v) => v) ? { points, bulges: b } : { points };
  }

  /** Den senaste punkten (eller bågens slut som väntar), för snäpp och skrivna punkter. */
  last(): Vec2 | undefined {
    return this.arcEnd?.at ?? this.points.at(-1);
  }

  /** Punkterna att rita som förhandsvisning med markören vid `cur`. */
  preview(cur: Vec2 | undefined, closed = false): Vec2[] {
    const pts = [...this.points];
    const b = [...this.bulges];
    if (this.arcEnd && cur) {
      const last = pts[pts.length - 1];
      b.push(bulgeThrough(last, this.arcEnd.at, cur));
      if (!this.arcEnd.closing) pts.push(this.arcEnd.at);
      else return shapePoints({ shape: 'polyline', points: pts as [number, number][], bulges: b, closed: true }).points.concat([pts[0]]);
    } else if (cur && !closed) {
      b.push(0);
      pts.push(cur);
    }
    if (pts.length < 2) return pts;
    const sp = shapePoints({ shape: 'polyline', points: pts as [number, number][], bulges: b, closed }).points;
    return closed ? [...sp, sp[0]] : sp;
  }
}
