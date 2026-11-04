// Generate a non-copyrighted sample PDF for manual testing.
// Run with: npm run gen:fixture
// Output: public/sample.pdf (and tests/fixtures/sample-1page.pdf + sample-10page.pdf)

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { writeFileSync, mkdirSync } from 'node:fs';

async function make(numPages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const times = await doc.embedFont(StandardFonts.TimesRoman);
  for (let i = 0; i < numPages; i++) {
    const page = doc.addPage([612, 792]);
    page.drawRectangle({ x: 48, y: 48, width: 516, height: 696, borderWidth: 1, borderColor: rgb(0.6, 0.6, 0.6) });
    page.drawText(`Sample page ${i + 1} of ${numPages}`, { x: 72, y: 720, size: 20, font: helv });
    page.drawText('Generated fixture — not copyrighted material.', { x: 72, y: 690, size: 11, font: times, color: rgb(0.35, 0.35, 0.35) });
    page.drawText('Try: add text, draw, highlight, insert an image, sign,', { x: 72, y: 660, size: 12, font: helv });
    page.drawText('delete/rotate/reorder pages, then Download.', { x: 72, y: 644, size: 12, font: helv });
    page.drawText(`Content on page ${i + 1}: lorem-ish placeholder text to render.`, { x: 72, y: 600, size: 11, font: times });
  }
  return doc.save();
}

async function main() {
  mkdirSync('public', { recursive: true });
  mkdirSync('tests/fixtures', { recursive: true });
  const one = await make(1);
  const ten = await make(10);
  writeFileSync('public/sample.pdf', one);
  writeFileSync('tests/fixtures/sample-1page.pdf', one);
  writeFileSync('tests/fixtures/sample-10page.pdf', ten);
  console.log('wrote public/sample.pdf (1 page), tests/fixtures/sample-1page.pdf, sample-10page.pdf (10 pages)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
