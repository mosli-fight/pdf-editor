import { describe, it, expect } from 'vitest';
import { viewportToPdf, pdfToViewport, viewportToPdfRotated } from './coordinates';

describe('viewportToPdf / pdfToViewport', () => {
  const page = { w: 612, h: 792 };

  it('maps top-left viewport origin to bottom-left pdf origin', () => {
    expect(viewportToPdf({ x: 0, y: 0 }, page)).toEqual({ x: 0, y: 792 });
    expect(viewportToPdf({ x: 612, y: 792 }, page)).toEqual({ x: 612, y: 0 });
  });

  it('round-trips', () => {
    const p = { x: 100, y: 200 };
    expect(pdfToViewport(viewportToPdf(p, page), page)).toEqual(p);
  });
});

describe('viewportToPdfRotated', () => {
  const page = { w: 612, h: 792 };

  it('rotation 0 equals viewportToPdf', () => {
    const p = { x: 100, y: 300 };
    expect(viewportToPdfRotated(p, page, 0)).toEqual(viewportToPdf(p, page));
  });

  it('page centre is fixed under 180-degree rotation', () => {
    const c = { x: page.w / 2, y: page.h / 2 };
    const out = viewportToPdfRotated(c, page, 180);
    expect(out.x).toBeCloseTo(page.w / 2, 6);
    expect(out.y).toBeCloseTo(page.h / 2, 6);
  });

  it('180-degree rotation flips both axes', () => {
    // Displayed top-left on a 180-rotated page came from PDF bottom-right.
    const out = viewportToPdfRotated({ x: 100, y: 100 }, page, 180);
    expect(out.x).toBeCloseTo(512, 6);
    expect(out.y).toBeCloseTo(100, 6);
  });

  it('90-degree rotation maps displayed origin into unrotated page bounds', () => {
    const out = viewportToPdfRotated({ x: 0, y: 0 }, page, 90);
    expect(out.x).toBeGreaterThanOrEqual(0);
    expect(out.x).toBeLessThanOrEqual(page.w);
    expect(out.y).toBeGreaterThanOrEqual(0);
    expect(out.y).toBeLessThanOrEqual(page.h);
  });
});
