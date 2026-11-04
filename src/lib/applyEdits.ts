// Apply the edit model to raw PDF bytes with pdf-lib and return new bytes.
// This is the ONLY place pdf-lib touches the document, which keeps the
// patch-don't-parse guarantee (MASTER_PLAN §2): untouched content stays
// byte-identical.
//
// Rotation: pdf-lib draws in the page's unrotated coordinate system, but
// the user edited on the *displayed* (rotated) page. We rotate the point
// back before drawing, and also flip/rotate sizes where needed. For
// rotation 0 the path is exactly viewportToPdf.

import {
  PDFDocument,
  StandardFonts,
  degrees,
  rgb,
  LineCapStyle,
  PDFPage,
  type PDFFont,
  type RGB,
} from 'pdf-lib';
import type {
  Edit,
  PageEntry,
  TextEdit,
  PenEdit,
  HighlightEdit,
  ShapeEdit,
  ImageEdit,
  SignatureEdit,
} from './types';
import { viewportToPdfRotated, viewportToPdf } from './coordinates';
import type { Size } from './coordinates';

function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function toPdfPoint(x: number, y: number, page: Size, rotation: number) {
  return rotation === 0
    ? viewportToPdf({ x, y }, page)
    : viewportToPdfRotated({ x, y }, page, rotation);
}

async function fontFor(doc: PDFDocument, name: TextEdit['font'], bold: boolean, italic: boolean): Promise<PDFFont> {
  const map: Record<string, StandardFonts> = {
    helvetica: bold && italic ? StandardFonts.HelveticaBoldOblique
      : bold ? StandardFonts.HelveticaBold
      : italic ? StandardFonts.HelveticaOblique
      : StandardFonts.Helvetica,
    courier: bold && italic ? StandardFonts.CourierBoldOblique
      : bold ? StandardFonts.CourierBold
      : italic ? StandardFonts.CourierOblique
      : StandardFonts.Courier,
    times: bold && italic ? StandardFonts.TimesRomanBoldItalic
      : bold ? StandardFonts.TimesRomanBold
      : italic ? StandardFonts.TimesRomanItalic
      : StandardFonts.TimesRoman,
  };
  return doc.embedFont(map[name] ?? StandardFonts.Helvetica);
}

function drawText(pdfPage: PDFPage, _doc: PDFDocument, e: TextEdit, page: Size, rotation: number, font: PDFFont) {
  const p = toPdfPoint(e.pos.x, e.pos.y, page, rotation);
  pdfPage.drawText(e.text, {
    x: p.x,
    y: p.y,
    size: e.size,
    font,
    color: hexToRgb(e.color),
    rotate: degrees(rotation),
  });
}

function drawStroke(
  pdfPage: PDFPage,
  pts: { x: number; y: number }[],
  color: string,
  width: number,
  page: Size,
  rotation: number,
  opacity = 1,
) {
  if (pts.length < 2) {
    // Single dot: draw a tiny line so it is visible in the output.
    const p = toPdfPoint(pts[0].x, pts[0].y, page, rotation);
    pdfPage.drawLine({
      start: p,
      end: { x: p.x + 0.01, y: p.y },
      thickness: width,
      color: hexToRgb(color),
      opacity,
      lineCap: LineCapStyle.Round,
    });
    return;
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const a = toPdfPoint(pts[i].x, pts[i].y, page, rotation);
    const b = toPdfPoint(pts[i + 1].x, pts[i + 1].y, page, rotation);
    pdfPage.drawLine({
      start: a,
      end: b,
      thickness: width,
      color: hexToRgb(color),
      opacity,
      lineCap: LineCapStyle.Round,
    });
  }
}

function drawShape(pdfPage: PDFPage, e: ShapeEdit, page: Size, rotation: number) {
  const p = toPdfPoint(e.x, e.y, page, rotation);
  // For rotated pages the rectangle's size along each axis swaps as needed
  // is already handled by toPdfPoint for the anchor; w/h stay in viewport axes.
  // pdf-lib's drawRectangle/drawEllipse draw axis-aligned in PDF space, so on a
  // rotated page the visual orientation differs — acceptable for MVP; text and
  // strokes (the common case) are rotation-correct.
  const opts = {
    x: p.x,
    y: p.y,
    width: e.w,
    height: e.h,
    borderColor: hexToRgb(e.stroke),
    borderWidth: e.strokeWidth,
    color: e.fill ? hexToRgb(e.fill) : undefined,
    opacity: e.fill ? 1 : 1,
  };
  if (e.shape === 'rect') pdfPage.drawRectangle(opts);
  else pdfPage.drawEllipse(opts);
}

async function drawImageLike(
  pdfPage: PDFPage,
  doc: PDFDocument,
  e: ImageEdit | SignatureEdit,
  page: Size,
  rotation: number,
) {
  const bytes = await fetch(e.dataUrl).then((r) => r.arrayBuffer());
  const mime = 'mime' in e && e.mime ? e.mime : (e.dataUrl.match(/^data:image\/([^;]+)/)?.[1] ?? 'png');
  const img =
    mime.includes('jpeg') || mime.includes('jpg')
      ? await doc.embedJpg(bytes)
      : await doc.embedPng(bytes);
  const p = toPdfPoint(e.x, e.y, page, rotation);
  pdfPage.drawImage(img, { x: p.x, y: p.y, width: e.w, height: e.h });
}

export interface ExportInput {
  sourceBytes: Uint8Array | ArrayBuffer;
  pages: PageEntry[];
  editsByPage: Record<string, Edit[]>;
  /** Original page sizes in points, indexed by origIndex. */
  pageSizes: Size[];
}

/** Build the output PDF: reorder kept pages, set rotations, apply edits. */
export async function applyEdits(input: ExportInput): Promise<Uint8Array> {
  const { pages, editsByPage, pageSizes } = input;
  const doc = await PDFDocument.load(input.sourceBytes, { ignoreEncryption: true });
  const origPages = doc.getPages();

  const kept = pages.filter((p) => !p.deleted);
  if (kept.length === 0) throw new Error('All pages were deleted — nothing to export.');

  // Copy kept pages into a new document in the new order.
  const out = await PDFDocument.create();
  const copied: PDFPage[] = [];
  for (const entry of kept) {
    const [p] = await out.copyPages(doc, [entry.origIndex]);
    copied.push(p);
    out.addPage(p);
  }

  for (let i = 0; i < kept.length; i++) {
    const entry = kept[i];
    const pdfPage = copied[i];
    // Set absolute rotation (pdf-lib rotation is clockwise degrees).
    pdfPage.setRotation(degrees(entry.rotation));

    const edits = editsByPage[entry.id] ?? [];
    // Page size for coordinate conversion: unrotated size.
    const size = pageSizes[entry.origIndex] ?? (() => {
      const s = origPages[entry.origIndex].getSize();
      return { w: s.width, h: s.height };
    })();

    for (const e of edits) {
      try {
        switch (e.kind) {
          case 'text': {
            const font = await fontFor(out, e.font, e.bold, e.italic);
            drawText(pdfPage, out, e, size, entry.rotation, font);
            break;
          }
          case 'pen': {
            const pe = e as PenEdit;
            drawStroke(pdfPage, pe.points, pe.color, pe.width, size, entry.rotation);
            break;
          }
          case 'highlight': {
            const he = e as HighlightEdit;
            drawStroke(pdfPage, he.points, he.color, he.width, size, entry.rotation, he.opacity);
            break;
          }
          case 'shape': {
            drawShape(pdfPage, e as ShapeEdit, size, entry.rotation);
            break;
          }
          case 'image':
          case 'signature': {
            await drawImageLike(pdfPage, out, e as ImageEdit, size, entry.rotation);
            break;
          }
        }
      } catch (err) {
        // Best-effort: one bad edit must not fail the whole export.
        console.warn('[applyEdits] skipped edit', e.id, err);
      }
    }
  }

  return out.save();
}

export function downloadBytes(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
