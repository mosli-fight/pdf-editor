import { describe, it, expect } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { applyEdits } from './applyEdits';
import type { PageEntry, Edit } from './types';

async function makeSource(numPages: number): Promise<{ bytes: Uint8Array; sizes: { w: number; h: number }[] }> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const sizes: { w: number; h: number }[] = [];
  for (let i = 0; i < numPages; i++) {
    const p = doc.addPage([612, 792]);
    p.drawText(`Page ${i + 1}`, { x: 72, y: 720, size: 18, font });
    sizes.push({ w: 612, h: 792 });
  }
  return { bytes: await doc.save(), sizes };
}

function pages(n: number): PageEntry[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    origIndex: i,
    rotation: 0,
    deleted: false,
  }));
}

describe('applyEdits', () => {
  it('exports a valid PDF with no edits (page count preserved)', async () => {
    const { bytes, sizes } = await makeSource(2);
    const out = await applyEdits({ sourceBytes: bytes, pages: pages(2), editsByPage: {}, pageSizes: sizes });
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(2);
  });

  it('deletes pages', async () => {
    const { bytes, sizes } = await makeSource(3);
    const p = pages(3).map((e) => (e.id === 'p1' ? { ...e, deleted: true } : e));
    const out = await applyEdits({ sourceBytes: bytes, pages: p, editsByPage: {}, pageSizes: sizes });
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(2);
  });

  it('reorders pages', async () => {
    const { bytes, sizes } = await makeSource(3);
    const p = pages(3);
    const reordered = [p[2], p[0], p[1]];
    const out = await applyEdits({ sourceBytes: bytes, pages: reordered, editsByPage: {}, pageSizes: sizes });
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(3);
    // Rotation of first page should follow the entry
  });

  it('rotates a page', async () => {
    const { bytes, sizes } = await makeSource(1);
    const p = [{ ...pages(1)[0], rotation: 90 as const }];
    const out = await applyEdits({ sourceBytes: bytes, pages: p, editsByPage: {}, pageSizes: sizes });
    const doc = await PDFDocument.load(out);
    expect(doc.getPage(0).getRotation().angle).toBe(90);
  });

  it('adds text and pen strokes without corrupting the PDF', async () => {
    const { bytes, sizes } = await makeSource(1);
    const text: Edit = {
      id: 't1',
      kind: 'text',
      pageId: 'p0',
      pos: { x: 100, y: 200 },
      text: 'Hello',
      size: 16,
      color: '#ff0000',
      font: 'helvetica',
      bold: true,
      italic: false,
    };
    const pen: Edit = {
      id: 'pen1',
      kind: 'pen',
      pageId: 'p0',
      points: [{ x: 50, y: 300 }, { x: 150, y: 320 }, { x: 250, y: 300 }],
      color: '#0000ff',
      width: 3,
    };
    const shape: Edit = {
      id: 's1',
      kind: 'shape',
      pageId: 'p0',
      shape: 'rect',
      x: 300,
      y: 400,
      w: 100,
      h: 50,
      stroke: '#00aa00',
      fill: null,
      strokeWidth: 2,
    };
    const out = await applyEdits({
      sourceBytes: bytes,
      pages: pages(1),
      editsByPage: { p0: [text, pen, shape] },
      pageSizes: sizes,
    });
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(1);
    expect(out[0]).toBe(37); // '%' of %PDF
    expect(out[1]).toBe(80); // 'P'
  });

  it('throws when all pages deleted', async () => {
    const { bytes, sizes } = await makeSource(1);
    const p = pages(1).map((e) => ({ ...e, deleted: true }));
    await expect(
      applyEdits({ sourceBytes: bytes, pages: p, editsByPage: {}, pageSizes: sizes }),
    ).rejects.toThrow(/All pages/);
  });
});
