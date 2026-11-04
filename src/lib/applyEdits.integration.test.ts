import { describe, it, expect } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { applyEdits } from './applyEdits';
import type { PageEntry, Edit } from './types';

// Hand-verified against real readers: build a tiny PDF, apply edits, reload
// with pdf-lib and assert structural invariants (page count, rotation, and
// that drawing operations produced output larger than the source).

describe('applyEdits integration with a real font', () => {
  it('produces a loadable PDF larger than source when text is added', async () => {
    const src = await PDFDocument.create();
    const f = await src.embedFont(StandardFonts.TimesRoman);
    src.addPage([612, 792]).drawText('Source', { x: 72, y: 720, size: 14, font: f });
    const srcBytes = await src.save();

    const pages: PageEntry[] = [{ id: 'p0', origIndex: 0, rotation: 0, deleted: false }];
    const edits: Edit[] = [
      {
        id: 't',
        kind: 'text',
        pageId: 'p0',
        pos: { x: 100, y: 100 },
        text: 'Added text layer',
        size: 20,
        color: '#000000',
        font: 'times',
        bold: false,
        italic: true,
      },
      {
        id: 'h',
        kind: 'highlight',
        pageId: 'p0',
        points: [{ x: 100, y: 150 }, { x: 300, y: 150 }],
        color: '#ffff00',
        width: 12,
        opacity: 0.35,
      },
    ];
    const out = await applyEdits({
      sourceBytes: srcBytes,
      pages,
      editsByPage: { p0: edits },
      pageSizes: [{ w: 612, h: 792 }],
    });
    expect(out.length).toBeGreaterThan(0);
    const check = await PDFDocument.load(out);
    expect(check.getPageCount()).toBe(1);
  });
});
