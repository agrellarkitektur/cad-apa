import type { ExportJob } from '../../core/exportJobs';
import { uniquePaths } from '../../core/exportJobs';
import { idOf, type ExportOptions } from '../../core/exportSettings';
import type { ProjectDoc } from '../../core/model';
import { bundledFontBytes, fontOf, fromBase64, isBundledFont } from '../../formats/fonts';
import { imageKey, writePdf, browserDeflate, type PdfImage, type PdfOptions, type PdfPage } from '../../formats/pdf';
import type { PdfJob, PdfReply } from '../../formats/exportWorker';
import { sheetDxf, viewDxf } from '../../repr/exportDxf';
import { pdfMeta, sheetPage, viewPage } from '../../repr/exportPages';
import { scheduleCsv, scheduleTableById, scheduleXlsx } from '../../repr/schedules';
import type { View3D } from '../../view3d/view3d';
import type { OutFile } from './exportTarget';

/**
 * Kön (0.12): jobben körs ett i taget, med förlopp och *Avbryt* mellan
 * dem. Bladen ritas här (där projektet och bilderna finns) och PDF:erna
 * skrivs i en bakgrundstråd; bilder ur 3D och glTF görs sist, ur 3D-vyn.
 */

export interface RunDeps {
  doc: ProjectDoc;
  today: string;
  autoDims: boolean;
  /** Ett underlag eller en logga som JPEG. */
  image: (src: { asset: string; page?: number }, gray: boolean) => Promise<PdfImage | null>;
  /** 3D-vyn, laddad och uppdaterad. */
  view3d: () => Promise<View3D | null>;
}

export interface RunResult {
  files: OutFile[];
  /** Rader som inte gick att göra, med anledning. */
  skipped: string[];
  cancelled: boolean;
}

// ---------------------------------------------------------------------------
// Bakgrundstråden

let worker: Worker | null = null;
let failed = false;
let seq = 0;
const waiting = new Map<number, (r: PdfReply) => void>();

async function pdfWorker(): Promise<Worker | null> {
  if (worker || failed) return worker;
  try {
    const mod = import.meta.env.MODE === 'artifact' ? await import('../../formats/exportWorker?worker&inline') : await import('../../formats/exportWorker?worker');
    worker = new mod.default();
    worker.onmessage = (e: MessageEvent<PdfReply>) => {
      waiting.get(e.data.id)?.(e.data);
      waiting.delete(e.data.id);
    };
    worker.onerror = () => {
      failed = true;
      for (const [id, done] of waiting) done({ id, error: 'Bakgrundstråden stannade.' });
      waiting.clear();
      worker = null;
    };
  } catch {
    failed = true;
  }
  return worker;
}

/** En PDF ur sidorna: i bakgrundstråden, eller här om den inte går att starta. */
async function pdfBytes(pages: PdfPage[], options: Omit<PdfOptions, 'deflate'>): Promise<Uint8Array> {
  const w = await pdfWorker();
  if (!w) return writePdf(pages, { ...options, deflate: browserDeflate() });
  const id = ++seq;
  const reply = await new Promise<PdfReply>((resolve) => {
    waiting.set(id, resolve);
    w.postMessage({ id, pages, options } satisfies PdfJob);
  });
  if ('error' in reply) throw new Error(reply.error);
  return reply.bytes;
}

// ---------------------------------------------------------------------------

/** Bilderna på sidorna som JPEG, hämtade en gång per fil, sida och gråskala. */
async function imagesFor(pages: readonly PdfPage[], cache: Map<string, PdfImage>, get: RunDeps['image']): Promise<void> {
  for (const page of pages)
    for (const p of page.prims) {
      if (p.kind !== 'image') continue;
      const key = imageKey(p.source, p.gray);
      if (cache.has(key)) continue;
      const img = await get(p.source, !!p.gray);
      if (img) cache.set(key, img);
    }
}

/** Typsnittet och dess fil för PDF:en. */
async function fontFor(doc: ProjectDoc): Promise<PdfOptions['font']> {
  const info = fontOf(doc);
  const id = doc.graphics.font;
  const custom = id && !isBundledFont(id) && info.id === id ? doc.assets[id] : undefined;
  return { info, bytes: custom ? fromBase64(custom.data) : await bundledFontBytes(info.id) };
}

/** Elementets namn i glTF: sorten och litteran eller namnet. */
function glbInfo(doc: ProjectDoc, guids: Record<string, string>) {
  return (id: string) => {
    const el = doc.elements[id];
    const def = el?.definition ? doc.definitions[el.definition] : undefined;
    const tag = el?.name || def?.name || '';
    return { name: [el?.type ?? 'Objekt', tag].filter(Boolean).join(' '), type: el?.type ?? '', ...(guids[id] ? { guid: guids[id] } : {}) };
  };
}

export async function runExport(
  jobs: readonly ExportJob[],
  options: Required<ExportOptions>,
  deps: RunDeps,
  progress: (done: number, total: number, title: string) => void,
  cancelled: () => boolean,
): Promise<RunResult> {
  const { doc, today } = deps;
  const files: OutFile[] = [];
  const skipped: string[] = [];
  const images = new Map<string, PdfImage>();
  const font = await fontFor(doc);
  const pageOpt = { layers: options.layers, workStamp: options.workStamp, today, autoDims: deps.autoDims };
  // Bilderna ur 3D sist, som renderingarna senare.
  const order = [...jobs].sort((a, b) => Number(a.kind === 'image' || a.kind === 'model') - Number(b.kind === 'image' || b.kind === 'model'));
  const paths = uniquePaths(order.map((j) => j.path));
  for (let i = 0; i < order.length; i++) {
    const job = order[i];
    progress(i, order.length, job.title);
    // Låt sidan rita om och Avbryt hinna fram mellan varje fil.
    await new Promise((r) => setTimeout(r, 0));
    if (cancelled()) return { files, skipped, cancelled: true };
    if (job.format === 'dxf') {
      const opt = { version: options.dxfVersion, today, workStamp: options.workStamp, autoDims: deps.autoDims };
      const key = job.keys[0];
      const r = job.kind === 'sheet' ? sheetDxf(doc, idOf(key), opt) : viewDxf(doc, idOf(key), opt);
      if (!r) {
        skipped.push(`${job.title}: tom eller borttagen`);
        continue;
      }
      if (r.images) skipped.push(`${job.title}: ${r.images === 1 ? 'en bild' : `${r.images} bilder`} (underlag eller logga) följer inte med i DXF:en`);
      files.push({ path: paths[i], job: job.path, data: r.bytes });
      continue;
    }
    if (job.format === 'csv' || job.format === 'xlsx') {
      // Förteckningen (0.12.2): en tabell för kalkylen; XLSX med summorna som formler (0.12.3).
      const t = scheduleTableById(doc, idOf(job.keys[0]));
      if (!t) {
        skipped.push(`${job.title}: borttagen`);
        continue;
      }
      files.push({ path: paths[i], job: job.path, data: job.format === 'xlsx' ? scheduleXlsx(t) : new TextEncoder().encode(scheduleCsv(t)) });
      continue;
    }
    if (job.format === 'pdf') {
      const pages: PdfPage[] = [];
      for (const key of job.keys) {
        const p = job.kind === 'sheet' ? sheetPage(doc, idOf(key), pageOpt) : viewPage(doc, idOf(key), pageOpt);
        if (p) pages.push(p);
        else skipped.push(`${job.title}: tom eller borttagen`);
      }
      if (!pages.length) continue;
      // En fil per blad har inga bokmärken; den samlade har ett per blad.
      if (pages.length === 1) delete pages[0].bookmark;
      await imagesFor(pages, images, deps.image);
      if (cancelled()) return { files, skipped, cancelled: true };
      const meta = job.keys.length === 1 ? pdfMeta(doc, job.keys[0], today) : { subject: doc.project.name, fields: { Projekt: doc.project.name, Datum: today } };
      const used = new Map([...images].filter(([k]) => pages.some((p) => p.prims.some((q) => q.kind === 'image' && imageKey(q.source, q.gray) === k))));
      files.push({ path: paths[i], job: job.path, data: await pdfBytes(pages, { title: job.title, images: used, font, meta }) });
      continue;
    }
    const v = await deps.view3d();
    if (!v) {
      skipped.push(`${job.title}: 3D-vyn kunde inte startas`);
      continue;
    }
    if (job.format === 'png' || job.format === 'jpeg') {
      const [w, h] = options.imageSize;
      const blob = await v.snapshot(w, h, job.format === 'png' ? 'image/png' : 'image/jpeg');
      files.push({ path: paths[i], job: job.path, data: new Uint8Array(await blob.arrayBuffer()) });
    } else if (job.format === 'glb') {
      files.push({ path: paths[i], job: job.path, data: new Uint8Array(await v.exportGlb(glbInfo(doc, doc.guids ?? {}))) });
    }
  }
  progress(order.length, order.length, '');
  return { files, skipped, cancelled: false };
}
