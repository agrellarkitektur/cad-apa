/**
 * PDF-underlag (0.8 del 2). PDF-filen sparas som den är i projektet, och
 * sidan ritas som en bild med pdf.js när den behövs. pdf.js är stort och
 * laddas först när det första PDF-underlaget öppnas.
 */

// Legacy-bygget: det har ersättningar för nya JavaScript-funktioner som
// Safari på iPhone och äldre Chrome saknar (t.ex. Map.getOrInsertComputed).
type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

let lib: Promise<{ m: PdfJs; worker: InstanceType<PdfJs['PDFWorker']> }> | null = null;

/** pdf.js och en arbetare som delas av alla PDF:er och lever kvar. */
function pdfjs() {
  lib ??= (async () => {
    const m = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const { default: PdfWorker } = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?worker&inline');
    return { m, worker: m.PDFWorker.create({ port: new PdfWorker() }) };
  })();
  return lib;
}

/** Öppna en PDF. pdf.js tar över bufferten, så den får en egen kopia. */
async function open(bytes: Uint8Array) {
  const { m, worker } = await pdfjs();
  const task = m.getDocument({ data: bytes.slice(), worker });
  const doc = await task.promise;
  // Arbetaren skapades här, inte av dokumentet, så den lever kvar när dokumentet stängs.
  return Object.assign(doc, { close: () => void task.destroy() });
}

/** Antalet sidor och sidornas storlek i PDF-punkter (1/72 tum). */
export async function pdfInfo(bytes: Uint8Array): Promise<{ pages: number; size: (page: number) => Promise<[number, number]> }> {
  const doc = await open(bytes);
  return {
    pages: doc.numPages,
    size: async (n) => {
      const page = await doc.getPage(n);
      const v = page.getViewport({ scale: 1 });
      doc.close();
      return [v.width, v.height];
    },
  };
}

/**
 * En sida som bild (PNG), så stor att den längsta sidan blir högst `maxPx`
 * bildpunkter. Telefoner klarar inte hur stora bilder som helst.
 */
export async function renderPdfPage(bytes: Uint8Array, pageNo: number, maxPx: number): Promise<Blob> {
  const doc = await open(bytes);
  try {
    const page = await doc.getPage(Math.max(1, Math.min(doc.numPages, pageNo)));
    const v1 = page.getViewport({ scale: 1 });
    const scale = maxPx / Math.max(v1.width, v1.height);
    const v = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(v.width);
    canvas.height = Math.round(v.height);
    const ctx = canvas.getContext('2d')!;
    // Vit bakgrund: PDF-sidor är ofta genomskinliga.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: v, canvas }).promise;
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Sidan kunde inte ritas.'))), 'image/png'));
  } finally {
    doc.close();
  }
}
