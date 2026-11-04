import { describe, it, expect } from 'vitest';
import { initHistory, pushHistory, undo, redo, canUndo, canRedo } from './history';

describe('history', () => {
  it('undo/redo round-trips', () => {
    let h = initHistory(0);
    h = pushHistory(h, 1);
    h = pushHistory(h, 2);
    expect(h.present).toBe(2);
    expect(canUndo(h)).toBe(true);
    h = undo(h);
    expect(h.present).toBe(1);
    h = undo(h);
    expect(h.present).toBe(0);
    expect(canUndo(h)).toBe(false);
    expect(canRedo(h)).toBe(true);
    h = redo(h);
    expect(h.present).toBe(1);
    h = redo(h);
    expect(h.present).toBe(2);
    expect(canRedo(h)).toBe(false);
  });

  it('push clears future', () => {
    let h = initHistory(0);
    h = pushHistory(h, 1);
    h = undo(h);
    h = pushHistory(h, 99);
    expect(canRedo(h)).toBe(false);
    expect(h.present).toBe(99);
  });

  it('undo on empty history is a no-op', () => {
    const h = initHistory('a');
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
  });

  it('respects limit', () => {
    let h = initHistory(0);
    for (let i = 1; i <= 150; i++) h = pushHistory(h, i, 100);
    expect(h.past).toHaveLength(100);
    expect(h.present).toBe(150);
  });
});
