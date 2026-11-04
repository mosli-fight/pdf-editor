import { describe, it, expect } from 'vitest';
import {
  normRotation,
  movePage,
  rotatePage,
  toggleDelete,
  sanitizeEdit,
  sanitizeEdits,
  normColor,
} from './serialize';
import type { PageEntry, Edit } from './types';

const mk = (id: string, origIndex: number): PageEntry => ({
  id,
  origIndex,
  rotation: 0,
  deleted: false,
});

describe('normRotation', () => {
  it('normalises to 0/90/180/270', () => {
    expect(normRotation(90)).toBe(90);
    expect(normRotation(360)).toBe(0);
    expect(normRotation(-90)).toBe(270);
    expect(normRotation(450)).toBe(90);
  });
});

describe('movePage', () => {
  const pages = [mk('a', 0), mk('b', 1), mk('c', 2)];
  it('moves forward', () => {
    const out = movePage(pages, 0, 2);
    expect(out.map((p) => p.id)).toEqual(['b', 'c', 'a']);
  });
  it('moves backward', () => {
    const out = movePage(pages, 2, 0);
    expect(out.map((p) => p.id)).toEqual(['c', 'a', 'b']);
  });
  it('no-op on same index or out of bounds', () => {
    expect(movePage(pages, 1, 1)).toBe(pages);
    expect(movePage(pages, 5, 0)).toBe(pages);
  });
  it('does not mutate input', () => {
    movePage(pages, 0, 1);
    expect(pages.map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('rotatePage / toggleDelete', () => {
  it('rotates by 90 and wraps', () => {
    expect(rotatePage([mk('a', 0)], 0)[0].rotation).toBe(90);
    const r = rotatePage([mk('a', 0)], 0, 270);
    expect(r[0].rotation).toBe(270);
    expect(rotatePage(r, 0)[0].rotation).toBe(0);
  });
  it('toggleDelete flips deleted flag', () => {
    const t = toggleDelete([mk('a', 0)], 0);
    expect(t[0].deleted).toBe(true);
    expect(toggleDelete(t, 0)[0].deleted).toBe(false);
  });
});

describe('sanitizeEdit', () => {
  it('drops edits with non-finite geometry', () => {
    const bad: Edit = {
      id: '1',
      kind: 'text',
      pageId: 'p1',
      pos: { x: NaN, y: 0 },
      text: 'hi',
      size: 14,
      color: '#000000',
      font: 'helvetica',
      bold: false,
      italic: false,
    };
    expect(sanitizeEdit(bad)).toBeNull();
  });

  it('drops pen strokes with no finite points', () => {
    const bad: Edit = {
      id: '1',
      kind: 'pen',
      pageId: 'p1',
      points: [],
      color: '#ff0000',
      width: 2,
    };
    expect(sanitizeEdit(bad)).toBeNull();
  });

  it('drops zero-size shapes', () => {
    const bad: Edit = {
      id: '1',
      kind: 'shape',
      pageId: 'p1',
      shape: 'rect',
      x: 0,
      y: 0,
      w: 0,
      h: 10,
      stroke: '#000000',
      fill: null,
      strokeWidth: 1,
    };
    expect(sanitizeEdit(bad)).toBeNull();
  });

  it('normalises colours', () => {
    expect(normColor('red')).toBe('#ff0000');
    expect(normColor('#ABC')).toBe('#ABC');
  });

  it('sanitizeEdits keeps only valid ones and deep-copies', () => {
    const good: Edit = {
      id: 'g',
      kind: 'pen',
      pageId: 'p1',
      points: [{ x: 1, y: 2 }],
      color: 'blue',
      width: 2,
    };
    const bad = { ...good, points: [] as never } as Edit;
    const out = sanitizeEdits([good, bad]);
    expect(out).toHaveLength(1);
    expect(out[0]).not.toBe(good);
    expect(out[0]).toEqual({ ...good, color: '#0000ff' });
  });
});
