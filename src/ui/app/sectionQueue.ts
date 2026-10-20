import type { StyleSheet } from '../../core/graphics';
import type { Id, ProjectDoc } from '../../core/model';
import type { ViewStates } from '../../core/states';
import { buildSection, type SectionResult } from '../../repr/section';
import { docForWorker, type SectionJob, type SectionReply } from '../../repr/sectionJob';

/** Det appen behöver av en Worker; i testerna en låtsastråd. */
export interface WorkerLike {
  postMessage(job: SectionJob): void;
  onmessage: ((e: MessageEvent<SectionReply>) => void) | null;
  onerror: ((e: unknown) => void) | null;
}

export interface SectionQueueOptions {
  /** Startar tråden. Utan den (eller om den inte går att starta) räknas allt direkt. */
  spawn?: () => Promise<WorkerLike>;
  /** Vyer som brukar gå fortare än så räknas direkt, utan tråd (ms). */
  syncBelowMs?: number;
}

/**
 * Fasader och sektioner i bakgrundstråden (0.8.2). `get` svarar direkt med
 * det som finns: den färdiga vyn om den redan är uträknad för just det här
 * projektet, annars den förra versionen av samma vy (eller null) medan den
 * nya räknas. När tråden är klar anropas `onReady`, och nästa `get` får den
 * nya vyn.
 *
 * Små vyer, som brukar ta mindre än `syncBelowMs`, räknas direkt som förut:
 * då blinkar inget, och tråden används bara när det märks.
 */
export function createSectionQueue(onReady: () => void, opt: SectionQueueOptions = {}) {
  const syncBelowMs = opt.syncBelowMs ?? 30;
  const versions = new WeakMap<ProjectDoc, number>();
  let nextVersion = 1;
  const versionOf = (doc: ProjectDoc) => {
    let v = versions.get(doc);
    if (v === undefined) versions.set(doc, (v = nextVersion++));
    return v;
  };

  /** Senast uträknade vyn per markör, med nyckeln den räknades för. */
  const done = new Map<Id, { key: string; result: SectionResult | null }>();
  /** Hur lång tid vyn tog senast, per markör. */
  const took = new Map<Id, number>();
  /** Det som senast efterfrågats per markör: svar med annan nyckel är inaktuella. */
  const wanted = new Map<Id, string>();

  let worker: WorkerLike | null = null;
  let starting: Promise<void> | null = null;
  let broken = !opt.spawn;
  let sentVersion = 0;
  let busy: SectionJob | null = null;
  let queued: SectionJob | null = null;
  /** Projekten som jobben gäller, så att det kan skickas på nytt om tråden saknar det. */
  const docs = new Map<number, ProjectDoc>();

  const send = (job: SectionJob) => {
    if (!worker) return;
    busy = job;
    if (job.docVersion !== sentVersion) {
      const doc = docs.get(job.docVersion);
      if (doc) job = { ...job, doc: docForWorker(doc) };
      sentVersion = job.docVersion;
    }
    worker.postMessage(job);
    // Projektversioner som ingen väntar på längre glöms.
    for (const v of [...docs.keys()]) if (v !== job.docVersion && v !== queued?.docVersion) docs.delete(v);
  };

  const finish = (reply: SectionReply) => {
    const job = busy;
    busy = null;
    if (job && reply.needsDoc) {
      sentVersion = 0;
      send(job);
      return;
    }
    if (job) {
      if (reply.result) took.set(job.markerId, reply.result.ms);
      if (wanted.get(job.markerId) === job.key) done.set(job.markerId, { key: job.key, result: reply.result });
    }
    if (queued) {
      const next = queued;
      queued = null;
      send(next);
    }
    if (job && wanted.get(job.markerId) === job.key) onReady();
  };

  const start = (): Promise<void> => {
    if (!starting && opt.spawn) {
      starting = opt
        .spawn()
        .then((w) => {
          worker = w;
          w.onmessage = (e) => finish(e.data);
          w.onerror = () => {
            // Tråden fungerar inte (t.ex. ett fel i den): räkna direkt i stället.
            broken = true;
            worker = null;
            busy = null;
            queued = null;
            onReady();
          };
          if (queued) {
            const next = queued;
            queued = null;
            send(next);
          }
        })
        .catch(() => {
          broken = true;
          onReady();
        });
    }
    return starting ?? Promise.resolve();
  };

  function computeNow(doc: ProjectDoc, markerId: Id, view: ViewStates, style: StyleSheet, key: string): SectionResult | null {
    const result = buildSection(doc, markerId, view, style);
    if (result) took.set(markerId, result.ms);
    done.set(markerId, { key, result });
    return result;
  }

  return {
    /**
     * Fasaden eller sektionen för det här projektet och vyläget: färdig,
     * eller den förra medan den nya räknas. `styleKey` ska ändras när
     * stilmallen ändras på annat sätt än genom projektet.
     */
    get(doc: ProjectDoc, markerId: Id, view: ViewStates, style: StyleSheet, styleKey: string): SectionResult | null {
      const version = versionOf(doc);
      const key = `${version}|${markerId}|${styleKey}|${JSON.stringify(view)}`;
      wanted.set(markerId, key);
      const have = done.get(markerId);
      if (have?.key === key) return have.result;
      // En vy som inte räknats än gissas ta lika lång tid som den längsta
      // hittills, eller (första gången) ungefär en halv ms per objekt i modellen (inte på arbetsblad och mallblad).
      const guess = took.get(markerId) ?? (took.size ? Math.max(...took.values()) : modelCount(doc) * 0.5);
      if (broken || guess < syncBelowMs) return computeNow(doc, markerId, view, style, key);
      docs.set(version, doc);
      const job: SectionJob = { key, docVersion: version, markerId, view, style };
      if (busy?.key === key || queued?.key === key) return have?.result ?? null;
      if (worker && !busy) send(job);
      else {
        queued = job;
        void start();
      }
      return have?.result ?? null;
    },
    /** Räknas något i tråden just nu, eller väntar på att räknas? */
    get pending(): boolean {
      return !!busy || !!queued;
    },
    /** Hur lång tid vyn tog senast (ms), om den räknats. */
    lastMs(markerId: Id): number | undefined {
      return took.get(markerId);
    },
  };
}

export type SectionQueue = ReturnType<typeof createSectionQueue>;

/** Startar den riktiga tråden. I demon (en enda fil) ligger tråden i filen. */
export async function spawnSectionWorker(): Promise<WorkerLike> {
  const mod =
    import.meta.env.MODE === 'artifact'
      ? await import('../../repr/sectionWorker?worker&inline')
      : await import('../../repr/sectionWorker?worker');
  return new mod.default() as unknown as WorkerLike;
}

/** Antalet objekt i modellen, utan det som är ritat på arbetsblad och mallblad. */
function modelCount(doc: ProjectDoc): number {
  const sheets = new Set(doc.worksheets.map((w) => w.id));
  let n = 0;
  for (const el of Object.values(doc.elements)) if (!el.space || !sheets.has(el.space)) n++;
  return n;
}
