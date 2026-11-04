// Central editor state. Kept intentionally framework-light (no zustand) to
// keep the bundle small. One History<DocumentState> drives undo/redo for both
// overlay edits and page operations.

import { useCallback, useMemo, useState } from 'react';
import type { Edit, PageEntry, Tool } from '../lib/types';
import { uid } from '../lib/types';
import { initHistory, pushHistory, undo as histUndo, redo as histRedo } from '../lib/history';
import {
  movePage as movePagePure,
  rotatePage as rotatePagePure,
  toggleDelete as toggleDeletePure,
} from '../lib/serialize';

export interface DocumentState {
  pages: PageEntry[];
  editsByPage: Record<string, Edit[]>;
  /** Unrotated page sizes in points, indexed by origIndex. */
  pageSizes: { w: number; h: number }[];
  fileName: string;
  sourceBytes: ArrayBuffer;
}

export interface EditorSnapshot {
  state: DocumentState | null;
  currentPage: number; // index into doc.pages array
  tool: Tool;
  zoom: number;
}

function initialDoc(pages: PageEntry[], editsByPage: Record<string, Edit[]>, pageSizes: { w: number; h: number }[], fileName: string, sourceBytes: ArrayBuffer): DocumentState {
  return { pages, editsByPage, pageSizes, fileName, sourceBytes };
}

export function useEditor() {
  const [history, setHistory] = useState(() => initHistory<EditorSnapshot>({ state: null, currentPage: 0, tool: 'select', zoom: 1 }));
  const { present, past, future } = history;

  const commit = useCallback((next: EditorSnapshot) => {
    setHistory((h) => pushHistory(h, next));
  }, []);

  const loadDocument = useCallback(
    (fileName: string, sourceBytes: ArrayBuffer, pageSizes: { w: number; h: number }[]) => {
      const pages: PageEntry[] = pageSizes.map((_, i) => ({
        id: `pg_${i}_${uid('')}`,
        origIndex: i,
        rotation: 0,
        deleted: false,
      }));
      const doc = initialDoc(pages, {}, pageSizes, fileName, sourceBytes);
      // Fresh history on file load.
      setHistory(initHistory<EditorSnapshot>({ state: doc, currentPage: 0, tool: 'select', zoom: 1 }));
    },
    [],
  );

  const setTool = useCallback((tool: Tool) => {
    setHistory((h) => ({ ...h, present: { ...h.present, tool } }));
  }, []);

  const setZoom = useCallback((zoom: number) => {
    const z = Math.min(4, Math.max(0.25, Math.round(zoom * 100) / 100));
    setHistory((h) => ({ ...h, present: { ...h.present, zoom: z } }));
  }, []);

  const setCurrentPage = useCallback((idx: number) => {
    setHistory((h) => {
      if (!h.present.state) return h;
      const i = Math.min(Math.max(0, idx), h.present.state.pages.length - 1);
      if (i === h.present.currentPage) return h;
      return { ...h, present: { ...h.present, currentPage: i } };
    });
  }, []);

  const addEdit = useCallback(
    (edit: Edit) => {
      const s = present.state;
      if (!s) return;
      const editsByPage: Record<string, Edit[]> = {
        ...s.editsByPage,
        [edit.pageId]: [...(s.editsByPage[edit.pageId] ?? []), edit],
      };
      commit({ ...present, state: { ...s, editsByPage } });
    },
    [present, commit],
  );

  const removeEdit = useCallback(
    (pageId: string, editId: string) => {
      const s = present.state;
      if (!s) return;
      const list = (s.editsByPage[pageId] ?? []).filter((e) => e.id !== editId);
      const editsByPage = { ...s.editsByPage, [pageId]: list };
      commit({ ...present, state: { ...s, editsByPage } });
    },
    [present, commit],
  );

  const movePage = useCallback(
    (from: number, to: number) => {
      const s = present.state;
      if (!s) return;
      const pages = movePagePure(s.pages, from, to);
      if (pages === s.pages) return;
      // Keep current page pointing at the same page object if possible.
      const curId = s.pages[present.currentPage]?.id;
      const nextIdx = Math.max(0, pages.findIndex((p) => p.id === curId));
      commit({ ...present, state: { ...s, pages }, currentPage: nextIdx === -1 ? present.currentPage : nextIdx });
    },
    [present, commit],
  );

  const rotatePage = useCallback(
    (index: number) => {
      const s = present.state;
      if (!s) return;
      commit({ ...present, state: { ...s, pages: rotatePagePure(s.pages, index) } });
    },
    [present, commit],
  );

  const toggleDeletePage = useCallback(
    (index: number) => {
      const s = present.state;
      if (!s) return;
      commit({ ...present, state: { ...s, pages: toggleDeletePure(s.pages, index) } });
    },
    [present, commit],
  );

  const undo = useCallback(() => setHistory((h) => histUndo(h)), []);
  const redo = useCallback(() => setHistory((h) => histRedo(h)), []);

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  const currentPageId = present.state?.pages[present.currentPage]?.id ?? null;
  const currentEdits = useMemo(
    () => (currentPageId ? present.state?.editsByPage[currentPageId] ?? [] : []),
    [present.state, currentPageId],
  );

  return {
    state: present.state,
    currentPage: present.currentPage,
    tool: present.tool,
    zoom: present.zoom,
    currentPageId,
    currentEdits,
    loadDocument,
    setTool,
    setZoom,
    setCurrentPage,
    addEdit,
    removeEdit,
    movePage,
    rotatePage,
    toggleDeletePage,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}
