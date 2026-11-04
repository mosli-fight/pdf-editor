// Pure helpers for normalising, merging and validating the edit model.
// Export-time (pdf-lib) conversion lives in applyEdits.ts; these helpers
// are framework-free so they can be unit-tested in Node.

import type { Edit, PageEntry, Color } from './types';

export function normRotation(r: number): 0 | 90 | 180 | 270 {
  const n = ((r % 360) + 360) % 360;
  if (n === 90 || n === 180 || n === 270) return n;
  return 0;
}

export function visiblePages(pages: PageEntry[]): PageEntry[] {
  return pages.filter((p) => !p.deleted);
}

/** Move the page at `fromIndex` (in the full array incl. deleted) to `toIndex`. */
export function movePage(pages: PageEntry[], fromIndex: number, toIndex: number): PageEntry[] {
  if (fromIndex < 0 || fromIndex >= pages.length) return pages;
  if (toIndex < 0 || toIndex >= pages.length) return pages;
  if (fromIndex === toIndex) return pages;
  const next = [...pages];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

export function rotatePage(pages: PageEntry[], index: number, deltaDeg = 90): PageEntry[] {
  const next = [...pages];
  const p = next[index];
  if (!p) return pages;
  next[index] = { ...p, rotation: normRotation(p.rotation + deltaDeg) };
  return next;
}

export function toggleDelete(pages: PageEntry[], index: number): PageEntry[] {
  const next = [...pages];
  const p = next[index];
  if (!p) return pages;
  next[index] = { ...p, deleted: !p.deleted };
  return next;
}

export function isHexColor(c: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(c) || /^#[0-9a-fA-F]{3}$/.test(c);
}

/** Normalise any CSS colour string to a #rrggbb hex where possible. */
export function normColor(c: Color): Color {
  const t = c.trim();
  if (isHexColor(t)) return t;
  // named-colour fallback used by a couple of defaults
  const named: Record<string, string> = {
    black: '#000000',
    white: '#ffffff',
    red: '#ff0000',
    blue: '#0000ff',
    yellow: '#ffff00',
  };
  return named[t.toLowerCase()] ?? '#000000';
}

/** Validate an edit's geometric fields are finite numbers. */
export function isFinitePt(x: unknown, y: unknown): boolean {
  return typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y);
}

export function sanitizeEdit(edit: Edit): Edit | null {
  switch (edit.kind) {
    case 'text': {
      if (!isFinitePt(edit.pos.x, edit.pos.y)) return null;
      if (!Number.isFinite(edit.size) || edit.size <= 0) return null;
      return { ...edit, color: normColor(edit.color), size: edit.size };
    }
    case 'pen':
    case 'highlight': {
      if (!Array.isArray(edit.points) || edit.points.length === 0) return null;
      const pts = edit.points.filter((p) => isFinitePt(p.x, p.y));
      if (pts.length === 0) return null;
      return { ...edit, points: pts, color: normColor(edit.color) };
    }
    case 'shape': {
      if (!isFinitePt(edit.x, edit.y) || !Number.isFinite(edit.w) || !Number.isFinite(edit.h))
        return null;
      if (edit.w <= 0 || edit.h <= 0) return null;
      return {
        ...edit,
        stroke: normColor(edit.stroke),
        fill: edit.fill ? normColor(edit.fill) : null,
      };
    }
    case 'image':
    case 'signature': {
      if (!isFinitePt(edit.x, edit.y) || !Number.isFinite(edit.w) || !Number.isFinite(edit.h))
        return null;
      if (edit.w <= 0 || edit.h <= 0) return null;
      if (typeof edit.dataUrl !== 'string' || edit.dataUrl.length === 0) return null;
      return edit;
    }
    default:
      return null;
  }
}

export function sanitizeEdits(edits: Edit[]): Edit[] {
  return edits.map(sanitizeEdit).filter((e): e is Edit => e !== null);
}

export function cloneEdits(edits: Edit[]): Edit[] {
  return sanitizeEdits(JSON.parse(JSON.stringify(edits)) as Edit[]);
}
