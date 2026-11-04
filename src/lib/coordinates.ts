// Coordinate transforms between three spaces:
//  1. PDF points (origin bottom-left, y up) — what pdf-lib uses.
//  2. pdf.js viewport in CSS pixels (origin top-left, y down) at scale=1.
//  3. Overlay/canvas pixels at current zoom (viewport scaled by `scale`).
//
// Overlay edits are stored in *unscaled viewport* coordinates (space 2),
// so they re-render correctly at any zoom. At export they are converted
// to PDF points using the page size from pdf-lib.

export interface Size {
  w: number;
  h: number;
}

export interface Pt {
  x: number;
  y: number;
}

/** Viewport (CSS px, top-left origin) -> PDF points (bottom-left origin). */
export function viewportToPdf(p: Pt, page: Size): Pt {
  return { x: p.x, y: page.h - p.y };
}

/** PDF points -> Viewport (CSS px, top-left origin). */
export function pdfToViewport(p: Pt, page: Size): Pt {
  return { x: p.x, y: page.h - p.y };
}

/** Viewport (CSS px, top-left origin) -> PDF points, accounting for the
 *  page's visual rotation.
 *
 *  pdf-lib draws in the page's *unrotated* coordinate system. A point the
 *  user clicked on the *displayed* (rotated) page must therefore be rotated
 *  back by `rotation` degrees counter-clockwise around the page centre,
 *  after converting from viewport (top-left, y-down) to PDF (bottom-left,
 *  y-up) space.
 *
 *  Displayed viewport: size is (w,h) when rotation is 0/180 and (h,w) when
 *  90/270, because pdf.js rotates the viewport. We accept `page` as the
 *  *unrotated* page size and reconstruct the displayed size internally. */
export function viewportToPdfRotated(p: Pt, page: Size, rotation: number): Pt {
  const r = ((rotation % 360) + 360) % 360;
  if (r === 0) return viewportToPdf(p, page);

  // Displayed (rotated) page dimensions in viewport space.
  const dispW = r === 90 || r === 270 ? page.h : page.w;
  const dispH = r === 90 || r === 270 ? page.w : page.h;
  void dispW; void dispH;

  // Step 1: viewport -> PDF y-up space, relative to centre of the
  // *unrotated* page (which is where pdf-lib works).
  const cx = page.w / 2;
  const cy = page.h / 2;
  // Flip y: viewport y-down from the top of the displayed page.
  const pdfX = p.x;
  const pdfY = (r === 90 || r === 270 ? page.w : page.h) - p.y;
  // Step 2: rotate back by -rotation around the centre.
  const dx = pdfX - cx;
  const dy = pdfY - cy;
  const rad = (-r * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rx = dx * cos - dy * sin;
  const ry = dx * sin + dy * cos;
  return { x: rx + cx, y: ry + cy };
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function clampPt(p: Pt, size: Size): Pt {
  return { x: clamp(p.x, 0, size.w), y: clamp(p.y, 0, size.h) };
}
