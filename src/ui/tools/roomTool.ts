import { addElements } from '../../core/commands';
import { actionOf } from '../../core/states';
import { resolveParams } from '../../elements/registry';
import type { Shape2DParams } from '../../elements/drawing2d';
import { holeAt, isRoomBoundary, roomHoles, type SpaceParams } from '../../elements/rooms';
import type { WallParams } from '../../elements/wall';
import { pointInRings } from '../../geometry/vec';
import type { Vec2 } from '../../repr/primitives';
import type { Camera } from '../../view2d/camera';
import type { ViewPointer, ViewTool } from '../../view2d/planView';
import type { ToolHost } from './host';

/**
 * Rumsverktyget: klicka i ett utrymme som väggarna omsluter så blir det ett
 * rum. Rummet följer sedan väggarna när de flyttas, och får nummer
 * automatiskt.
 */
export class RoomTool implements ViewTool {
  cursor = 'crosshair';
  private host: ToolHost;
  private hovered: Vec2[] | null = null;
  /** Namnet nästa rum får. */
  name = 'Rum';

  constructor(host: ToolHost) {
    this.host = host;
  }

  down(): 'capture' | 'pan' {
    return 'capture';
  }

  hover(p: ViewPointer | null): void {
    this.hovered = p ? this.holeAt(p.model) : null;
  }

  drag(p: ViewPointer): void {
    this.hovered = this.holeAt(p.model);
  }

  up(p: ViewPointer, moved: boolean): void {
    if (moved && p.pointerType === 'touch') return;
    this.place(p.model);
  }

  tap(p: ViewPointer): void {
    this.place(p.model);
  }

  private cache: { key: object; state: string; holes: Vec2[][] } | null = null;

  private holes(): Vec2[][] {
    const doc = this.host.store.doc;
    const view = { state: this.host.activeState() };
    if (this.cache && this.cache.key === doc.elements && this.cache.state === view.state) return this.cache.holes;
    const here = Object.values(doc.elements).filter((e) => e.storey === this.host.storey() && actionOf(e, view) !== 'absent');
    const walls = here.filter((e) => e.type === 'Wall').map((e) => ({ id: e.id, p: resolveParams<WallParams>(doc, e) }));
    const bounds = here.filter(isRoomBoundary).map((e) => ({ id: e.id, p: resolveParams<Shape2DParams>(doc, e) }));
    const holes = roomHoles(walls, bounds);
    this.cache = { key: doc.elements, state: view.state, holes };
    return holes;
  }

  /** Rummet (utrymmet väggarna omsluter) där punkten ligger, eller null. Också för smartspöt (0.10.23). */
  holeAt(pt: Vec2): Vec2[] | null {
    return holeAt(this.holes(), pt);
  }

  private place(pt: Vec2): void {
    const doc = this.host.store.doc;
    const state = this.host.activeState();
    // Finns det redan ett rum här markeras det i stället.
    const existing = Object.values(doc.elements).find((e) => {
      if (e.type !== 'Space' || e.storey !== this.host.storey() || !e.states.includes(state)) return false;
      const p = e.params as unknown as SpaceParams;
      const ring = p.seed ? this.holeAt(p.seed) ?? p.outline : p.outline;
      return ring.length >= 3 && pointInRings(pt, [ring]);
    });
    if (existing) {
      this.host.selection.set([existing.id]);
      this.host.hint('Här finns redan ett rum. Det är markerat.');
      return;
    }
    const hole = this.holeAt(pt);
    if (!hole) {
      this.host.hint('Klicka i ett utrymme som väggarna omsluter helt.');
      return;
    }
    const [el] = addElements(
      this.host.store,
      [
        {
          type: 'Space',
          storey: this.host.storey(),
          tags: [],
          name: this.name,
          params: { outline: hole.map((q) => [Math.round(q[0]), Math.round(q[1])]), seed: [Math.round(pt[0]), Math.round(pt[1])] },
          props: {},
        },
      ],
      state,
      'Skapa rum',
    );
    this.host.selection.set([el.id]);
  }

  overlay(cam: Camera): string {
    if (!this.hovered) return '';
    const d = this.hovered.map((q, i) => `${i ? 'L' : 'M'}${cam.toScreen(q).join(' ')}`).join('') + 'Z';
    return `<path d="${d}" class="room-preview"/>`;
  }
}
