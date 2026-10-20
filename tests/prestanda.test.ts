import { beforeAll, describe, expect, it } from 'vitest';
import { registerBuiltInTypes } from '../src/elements';
import { copyElements, deleteElements, moveElements } from '../src/core/commands';
import { DocStore } from '../src/core/store';
import { doorNumbersFor, roomNumbersFor } from '../src/elements/rooms';
import { createContext } from '../src/repr/context';
import { buildModel3d } from '../src/repr/model3d';
import { buildPlan } from '../src/repr/plan';
import { buildSection } from '../src/repr/section';
import { sampleProject } from '../src/sample/sampleProject';
import { roomGrid, wallGrid } from './projekt';

/**
 * Prestanda (0.8 del 2.1). Ett rutnät av rum, 4 × 4 m, med innerväggar i
 * exempelprojektets typ. 16 × 16 rum ger 544 väggar, ungefär ett mindre
 * flerbostadshus på ett plan gånger fyra. Gränserna är generösa så att
 * testet inte felar på en belastad maskin, men en algoritm som växer med
 * kvadraten på antalet väggar (fasaden tog 6–10 s före 0.8 del 2.1) fångas.
 *
 * Alla test som mäter tid ligger här. Filen körs ensam efter de andra
 * (`sequence.groupOrder` i vite.config.ts), så att mätningen inte delar
 * processorn med andra testfiler; på GitHub körs flera filer samtidigt.
 */
beforeAll(() => registerBuiltInTypes());

const ms = (f: () => unknown): number => {
  const t = performance.now();
  f();
  return performance.now() - t;
};

describe('prestanda', () => {
  it('312 väggar med dörrar, fönster och rum: plan, 3D, rumsnummer och fasad', () => {
    // Före 0.8.1 tog fasaden 2,5 s och planen 0,15 s; nu 0,6 s och 0,08 s.
    const doc = roomGrid(12);
    const storey = doc.storeys[0].id;
    const view = { state: doc.states[1].id, compareTo: doc.states[0].id };
    let plan: ReturnType<typeof buildPlan> | undefined;
    const planMs = ms(() => (plan = buildPlan(doc, storey, view)));
    const model3dMs = ms(() => buildModel3d(doc, storey, view));
    let numbers = new Map<string, string>();
    const numbersMs = ms(() => {
      const { ctx } = createContext(doc, storey, view, doc.graphics, () => true);
      numbers = roomNumbersFor(ctx);
      doorNumbersFor(ctx);
    });
    let fasad: ReturnType<typeof buildSection> = null;
    const fasadMs = ms(() => (fasad = buildSection(doc, 'fasad-1', view)));
    expect(plan!.prims.length).toBeGreaterThan(312);
    expect(numbers.size).toBe(144);
    expect(fasad!.prims.length).toBeGreaterThan(0);
    expect(planMs).toBeLessThan(1000);
    expect(model3dMs).toBeLessThan(1000);
    expect(numbersMs).toBeLessThan(500);
    expect(fasadMs).toBeLessThan(1600);
  }, 60000);

  it('684 väggar: flytta, kopiera och ta bort alla i ett steg', () => {
    // Före 0.8.1 kopierade varje ändring i en transaktion alla objekt:
    // kopiera och ta bort tog 1,3 s, nu ca 0,03 s.
    const store = new DocStore(roomGrid(18));
    const walls = Object.values(store.doc.elements)
      .filter((e) => e.type === 'Wall')
      .map((e) => e.id);
    expect(walls.length).toBe(684);
    const before = Object.keys(store.doc.elements).length;
    const t = ms(() => {
      moveElements(store, walls, [100, 0]);
      deleteElements(store, copyElements(store, walls));
    });
    expect(Object.keys(store.doc.elements).length).toBe(before);
    expect(t).toBeLessThan(400);
  }, 60000);

  it('544 väggar: planen under 2 s och en fasad under 3 s', () => {
    const { doc, walls } = wallGrid(16);
    expect(walls).toBe(544);
    const view = { state: doc.states[1].id, compareTo: doc.states[0].id };
    let t = performance.now();
    const plan = buildPlan(doc, doc.storeys[0].id, view);
    const planMs = performance.now() - t;
    t = performance.now();
    const fasad = buildSection(doc, 'fasad-1', view);
    const fasadMs = performance.now() - t;
    expect(plan.prims.length).toBeGreaterThan(walls);
    expect(fasad?.prims.length ?? 0).toBeGreaterThan(0);
    expect(planMs).toBeLessThan(2000);
    expect(fasadMs).toBeLessThan(3000);
  }, 60000);

  it('exemplets fasader och sektion på under en tiondels sekund var (0.7)', () => {
    const doc = sampleProject();
    const view = { state: 'st-a', compareTo: 'st-bef' };
    const ids = ['fasad-1', 'fasad-2', 'fasad-3', 'fasad-4', 'sektion-a'];
    // Första gången kompileras koden; mät sedan och ta den bästa av tre
    // gånger, så att en enstaka skräpsamling inte fäller testet.
    for (const id of ids) buildSection(doc, id, view);
    for (const id of ids) {
      let best = Infinity;
      for (let k = 0; k < 3; k++) {
        const r = buildSection(doc, id, view)!;
        expect(r.prims.length).toBeGreaterThan(20);
        best = Math.min(best, r.ms);
      }
      expect(best).toBeLessThan(100);
    }
  });
});
