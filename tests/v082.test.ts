import { beforeAll, describe, expect, it } from 'vitest';
import { registerBuiltInTypes } from '../src/elements';
import { sampleProject } from '../src/sample/sampleProject';
import { buildSection } from '../src/repr/section';
import { pickAt } from '../src/view2d/pick';
import type { Vec2 } from '../src/repr/primitives';

beforeAll(() => registerBuiltInTypes());

describe('markering i sektion (0.8.2)', () => {
  it('ett klick i en väggs snitt markerar väggen, inte taket', () => {
    const doc = sampleProject();
    const r = buildSection(doc, 'sektion-a', { state: 'st-bef' })!;
    const walls = r.pickables.filter((p) => doc.elements[p.id]?.type === 'Wall' && p.regions.length);
    expect(walls.length).toBeGreaterThanOrEqual(2);
    for (const w of walls) {
      // En punkt mitt i väggens snitt, på halva höjden.
      const ring = w.regions[0][0];
      const xs = ring.map((q) => q[0]);
      const zs = ring.map((q) => q[1]);
      const p: Vec2 = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2];
      expect(pickAt(r.pickables, p, 1)).toBe(w.id);
    }
    // Taket har sin egen snittyta, inte väggarnas.
    const roof = r.pickables.find((p) => doc.elements[p.id]?.type === 'Roof' && p.regions.length);
    expect(roof).toBeTruthy();
    const wallIds = new Set(walls.map((w) => w.id));
    expect(wallIds.has(roof!.id)).toBe(false);
  });
});

describe('fasader i bakgrundstråden (0.8.2)', () => {
  /** En låtsastråd som svarar i nästa varv med samma kod som den riktiga. */
  async function fakeWorker() {
    const { handleSectionJob } = await import('../src/repr/sectionJob');
    const sent: { doc: boolean }[] = [];
    const w: import('../src/ui/app/sectionQueue').WorkerLike = {
      onmessage: null,
      onerror: null,
      postMessage(job) {
        sent.push({ doc: !!job.doc });
        // Som postMessage: projektet kopieras.
        const copy = structuredClone(job);
        setTimeout(() => w.onmessage?.({ data: handleSectionJob(copy) } as MessageEvent));
      },
    };
    return { w, sent };
  }
  const tick = () => new Promise((r) => setTimeout(r, 5));

  it('ger samma fasad som direkt uträkning, och skickar projektet bara när det ändrats', async () => {
    const { createSectionQueue } = await import('../src/ui/app/sectionQueue');
    const { w, sent } = await fakeWorker();
    let ready = 0;
    // syncBelowMs 0 och en uppmätt tid: allt går via tråden.
    const q = createSectionQueue(() => ready++, { spawn: async () => w, syncBelowMs: -1 });
    const doc = sampleProject();
    const view = { state: 'st-a', compareTo: 'st-bef' };
    expect(q.get(doc, 'fasad-1', view, doc.graphics, '')).toBeNull();
    while (!ready) await tick();
    const got = q.get(doc, 'fasad-1', view, doc.graphics, '')!;
    const direct = buildSection(doc, 'fasad-1', view)!;
    const strip = (r: typeof got) => JSON.stringify(r.prims);
    expect(strip(got)).toBe(strip(direct));
    expect(got.pickables.map((p) => p.id)).toEqual(direct.pickables.map((p) => p.id));
    // En annan fasad i samma projekt: projektet skickas inte igen.
    q.get(doc, 'fasad-2', view, doc.graphics, '');
    while (ready < 2) await tick();
    expect(sent).toEqual([{ doc: true }, { doc: false }]);
    // Ett ändrat projekt skickas, och under tiden visas den förra fasaden.
    const doc2 = { ...doc, elements: { ...doc.elements } };
    delete doc2.elements['iv-2'];
    expect(q.get(doc2, 'fasad-1', view, doc2.graphics, '')).toBe(got);
    expect(q.pending).toBe(true);
    while (ready < 3) await tick();
    expect(sent[2]).toEqual({ doc: true });
    expect(q.get(doc2, 'fasad-1', view, doc2.graphics, '')).not.toBe(got);
  });

  it('bara det senaste av flera snabba ändringar räknas', async () => {
    const { createSectionQueue } = await import('../src/ui/app/sectionQueue');
    const { w, sent } = await fakeWorker();
    let ready = 0;
    const q = createSectionQueue(() => ready++, { spawn: async () => w, syncBelowMs: -1 });
    const doc = sampleProject();
    const docs = [0, 1, 2, 3, 4].map(() => ({ ...doc }));
    q.get(docs[0], 'fasad-1', { state: 'st-a' }, doc.graphics, '');
    while (!ready) await tick();
    for (const d of docs.slice(1)) q.get(d, 'fasad-1', { state: 'st-a' }, d.graphics, '');
    while (q.pending) await tick();
    // Den första, sedan den som skickades medan tråden var ledig och den
    // sista; de två mellan hoppas över.
    expect(sent).toHaveLength(3);
    expect(ready).toBe(2);
    expect(q.get(docs[4], 'fasad-1', { state: 'st-a' }, doc.graphics, '')).not.toBeNull();
  });

  it('små vyer räknas direkt, utan tråd', async () => {
    const { createSectionQueue } = await import('../src/ui/app/sectionQueue');
    const { w, sent } = await fakeWorker();
    const q = createSectionQueue(() => {}, { spawn: async () => w });
    const doc = sampleProject();
    expect(q.get(doc, 'fasad-1', { state: 'st-a' }, doc.graphics, '')).not.toBeNull();
    expect(sent).toHaveLength(0);
  });

  it('utan tråd räknas allt direkt', async () => {
    const { createSectionQueue } = await import('../src/ui/app/sectionQueue');
    const q = createSectionQueue(() => {}, { syncBelowMs: -1 });
    const doc = sampleProject();
    expect(q.get(doc, 'sektion-a', { state: 'st-a' }, doc.graphics, '')?.prims.length).toBeGreaterThan(20);
  });
});
