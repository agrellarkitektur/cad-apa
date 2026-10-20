import type { StyleSheet } from '../core/graphics';
import type { Id, ProjectDoc } from '../core/model';
import type { ViewStates } from '../core/states';
import { buildSection, type SectionResult } from './section';

/**
 * Ett uppdrag till bakgrundstråden (0.8.2): räkna fram en fasad eller
 * sektion. `key` följer med svaret, så att ett svar som hunnit bli inaktuellt
 * kan kännas igen. Projektet skickas när det ändrats sedan förra uppdraget
 * (`doc`), annars används det som tråden redan har.
 */
export interface SectionJob {
  key: string;
  docVersion: number;
  doc?: ProjectDoc;
  markerId: Id;
  view: ViewStates;
  style: StyleSheet;
}

export interface SectionReply {
  key: string;
  result: SectionResult | null;
  /** Tråden saknade projektet i den versionen; skicka det igen. */
  needsDoc?: boolean;
  error?: string;
}

let current: { version: number; doc: ProjectDoc } | null = null;

/** Körs i tråden; egen funktion så att den kan testas utan tråd. */
export function handleSectionJob(job: SectionJob): SectionReply {
  if (job.doc) current = { version: job.docVersion, doc: job.doc };
  if (!current || current.version !== job.docVersion) return { key: job.key, result: null, needsDoc: true };
  try {
    return { key: job.key, result: buildSection(current.doc, job.markerId, job.view, job.style) };
  } catch (err) {
    return { key: job.key, result: null, error: String(err) };
  }
}

/**
 * Projektet som det skickas till tråden: underlagens filer (PDF, bilder,
 * DXF) behövs inte för fasader och sektioner och kan vara stora.
 */
export function docForWorker(doc: ProjectDoc): ProjectDoc {
  return { ...doc, assets: {} };
}
