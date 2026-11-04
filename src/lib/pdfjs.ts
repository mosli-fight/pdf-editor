// pdf.js lifecycle, worker bootstrap, and page rendering.
// The worker is bundled from node_modules (never a CDN) and only initialised
// on first use, so it does not penalise the initial page load.

import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';

let workerReady = false;

function ensureWorker() {
  if (workerReady) return;
  // pdfjs-dist ships the worker alongside the library. Vite bundles this
  // module; the URL resolves to the emitted worker asset.
  const workerUrl = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  (pdfjs as unknown as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc =
    workerUrl;
  workerReady = true;
}

export interface PdfDoc {
  /** Raw document (caller keeps it for pdf-lib export). */
  raw: PDFDocumentProxy;
  numPages: number;
  /** Unrotated page sizes in points, indexed by page number - 1. */
  sizes: { w: number; h: number }[];
}

export async function loadPdf(data: ArrayBuffer | Uint8Array): Promise<PdfDoc> {
  ensureWorker();
  const task = pdfjs.getDocument({ data: data as Uint8Array });
  const raw = await task.promise;
  const sizes: { w: number; h: number }[] = [];
  for (let i = 1; i <= raw.numPages; i++) {
    const page = await raw.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    sizes.push({ w: vp.width, h: vp.height });
    page.cleanup();
  }
  return { raw, numPages: raw.numPages, sizes };
}

/** Render page `pageNum` (1-based) into `canvas` at `scale`. Returns the
 *  viewport size in CSS px at this scale. */
export async function renderPage(
  doc: PDFDocumentProxy,
  pageNum: number,
  canvas: HTMLCanvasElement,
  scale: number,
): Promise<{ w: number; h: number }> {
  const page = await doc.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(viewport.width * dpr);
  canvas.height = Math.floor(viewport.height * dpr);
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  page.cleanup();
  return { w: viewport.width, h: viewport.height };
}
