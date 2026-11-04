// Simple undo/redo stack over immutable state snapshots.

export interface History<S> {
  present: S;
  past: S[];
  future: S[];
}

export function initHistory<S>(initial: S): History<S> {
  return { present: initial, past: [], future: [] };
}

export function pushHistory<S>(h: History<S>, next: S, limit = 100): History<S> {
  if (next === h.present) return h;
  const past = [...h.past, h.present].slice(-limit);
  return { present: next, past, future: [] };
}

export function undo<S>(h: History<S>): History<S> {
  if (h.past.length === 0) return h;
  const past = [...h.past];
  const present = past.pop()!;
  return { present, past, future: [h.present, ...h.future] };
}

export function redo<S>(h: History<S>): History<S> {
  if (h.future.length === 0) return h;
  const future = [...h.future];
  const present = future.shift()!;
  return { present, past: [...h.past, h.present], future };
}

export function canUndo<S>(h: History<S>): boolean {
  return h.past.length > 0;
}

export function canRedo<S>(h: History<S>): boolean {
  return h.future.length > 0;
}
