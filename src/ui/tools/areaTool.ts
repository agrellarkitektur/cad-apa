import { addElements, updateParams } from '../../core/commands';
import { COMPUTED_KINDS, type AreaKind, type AreaParams } from '../../elements/areaCalc';

import type { Vec2 } from '../../repr/primitives';
import type { Camera } from '../../view2d/camera';
import type { ViewPointer, ViewTool } from '../../view2d/planView';
import type { ToolHost } from './host';
import type { RoomTool } from './roomTool';

/**
 * Areaverktyget (0.12.3): klicka i ett rum så blir det en area av det valda
 * slaget, med konturen längs de omslutande väggarnas insida. Shift+klick i
 * fler rum lägger dem till den markerade arean (en bostad, en lokal), och
 * innerväggarna mellan dem räknas med. BTA och BYA räknas fram av sig
 * själva; ett klick lägger dem på våningen för att visa konturen.
 */
export class AreaTool implements ViewTool {
  cursor = 'crosshair';
  kind: AreaKind = 'BOA';
  func = '';
  private hovered: Vec2[] | null = null;

  private readonly host: ToolHost;
  private readonly rooms: RoomTool;

  constructor(host: ToolHost, rooms: RoomTool) {
    this.host = host;
    this.rooms = rooms;
  }

  down(): 'capture' {
    return 'capture';
  }

  hover(p: ViewPointer | null): void {
    this.hovered = p && !COMPUTED_KINDS.includes(this.kind) ? this.rooms.holeAt(p.model) : null;
  }

  drag(p: ViewPointer): void {
    this.hover(p);
  }

  up(p: ViewPointer, moved: boolean): void {
    if (moved && p.pointerType === 'touch') return;
    this.place(p.model, p.shift);
  }

  tap(p: ViewPointer): void {
    this.place(p.model, p.shift);
  }

  private place(pt: Vec2, add: boolean): void {
    const store = this.host.store;
    const doc = store.doc;
    const state = this.host.activeState();
    const storey = this.host.storey();
    const here = Object.values(doc.elements).filter((e) => e.type === 'Area' && e.storey === storey && e.states.includes(state));
    if (COMPUTED_KINDS.includes(this.kind)) {
      const same = here.find((e) => (e.params as unknown as AreaParams).kind === this.kind);
      if (same) {
        this.host.selection.set([same.id]);
        this.host.hint(`${this.kind} finns redan på våningen. Den är markerad.`);
        return;
      }
      const [el] = addElements(store, [{ type: 'Area', storey, tags: [], props: {}, params: { kind: this.kind, outline: [] } }], state, `Visa ${this.kind}`);
      this.host.selection.set([el.id]);
      this.host.hint(`${this.kind} räknas fram ur modellen och följer väggarna.`, 4000);
      return;
    }
    const hole = this.rooms.holeAt(pt);
    if (!hole) {
      this.host.hint('Klicka i ett rum som väggarna omsluter. Shift+klick lägger till fler rum i den markerade arean.');
      return;
    }
    const seedsOf = (e: (typeof here)[number]) => (e.params as unknown as AreaParams).seeds ?? [];
    // Rummet hör redan till en area av samma slag: markera den.
    const taken = here.find((e) => seedsOf(e).some((s) => this.rooms.holeAt(s) === hole) && (e.params as unknown as AreaParams).kind === this.kind);
    const seed: [number, number] = [Math.round(pt[0]), Math.round(pt[1])];
    const selected = this.host.selection.list().map((id) => doc.elements[id]).find((e) => e?.type === 'Area' && e.storey === storey && !COMPUTED_KINDS.includes((e.params as unknown as AreaParams).kind));
    if (add && selected) {
      const p = selected.params as unknown as AreaParams;
      if (!p.seeds?.length) {
        this.host.hint('Den markerade arean har en egen kontur. Rita om den, eller gör en ny med ett klick.');
        return;
      }
      if (seedsOf(selected).some((s) => this.rooms.holeAt(s) === hole)) {
        // Shift+klick i ett rum som redan hör till arean tar bort det.
        const rest = seedsOf(selected).filter((s) => this.rooms.holeAt(s) !== hole);
        if (rest.length) updateParams(store, [selected.id], { seeds: rest }, 'Ta bort rummet ur arean');
        else this.host.hint('Det sista rummet tas inte bort. Ta bort arean i stället.');
        return;
      }
      updateParams(store, [selected.id], { seeds: [...seedsOf(selected), seed] }, 'Lägg till rummet i arean');
      return;
    }
    if (taken) {
      this.host.selection.set([taken.id]);
      this.host.hint('Rummet hör redan till en area. Den är markerad; Shift+klick lägger till fler rum.');
      return;
    }
    const params: AreaParams = { kind: this.kind, outline: hole.map((q) => [Math.round(q[0]), Math.round(q[1])]), seeds: [seed], ...(this.func.trim() ? { func: this.func.trim() } : {}) };
    const [el] = addElements(store, [{ type: 'Area', storey, tags: [], props: {}, params: params as unknown as Record<string, unknown> }], state, `Ny ${this.kind}`);
    this.host.selection.set([el.id]);
    this.host.hint('Shift+klick i fler rum lägger dem till arean; innerväggarna mellan dem räknas med.', 4000);
  }

  overlay(cam: Camera): string {
    if (!this.hovered) return '';
    const d = this.hovered.map((q, i) => `${i ? 'L' : 'M'}${cam.toScreen(q).join(' ')}`).join('') + 'Z';
    return `<path d="${d}" class="room-preview"/>`;
  }
}

