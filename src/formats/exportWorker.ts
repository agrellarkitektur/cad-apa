/// <reference lib="webworker" />
import { browserDeflate, writePdf, type PdfOptions, type PdfPage } from './pdf';

/**
 * Bakgrundstråden för exporten (0.12): skriver PDF:erna, så att sidan går
 * att använda och *Avbryt* hinner fram medan stora blad packas. Bladen ritas
 * i huvudtråden (där projektet och bilderna finns) och skickas hit som
 * primitiver. Se `src/ui/app/exportRun.ts`.
 */
export interface PdfJob {
  id: number;
  pages: PdfPage[];
  options: Omit<PdfOptions, 'deflate'>;
}

export type PdfReply = { id: number; bytes: Uint8Array } | { id: number; error: string };

self.onmessage = async (e: MessageEvent<PdfJob>) => {
  const { id, pages, options } = e.data;
  try {
    const bytes = await writePdf(pages, { ...options, deflate: browserDeflate() });
    (self as unknown as Worker).postMessage({ id, bytes } satisfies PdfReply, [bytes.buffer]);
  } catch (err) {
    self.postMessage({ id, error: String((err as Error)?.message ?? err) } satisfies PdfReply);
  }
};
