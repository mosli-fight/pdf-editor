import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor } from './store/useEditor';
import { loadPdf, type PdfDoc } from './lib/pdfjs';
import { applyEdits, downloadBytes } from './lib/applyEdits';
import { fileToDataUrl, validateImageFile, downscaleToDataUrl, mimeFromDataUrl } from './lib/image';
import { uid } from './lib/types';
import type { Edit, Tool } from './lib/types';
import { Dropzone } from './components/Dropzone';
import { ToolDock } from './components/ToolDock';
import { TextPanel, type TextOptions } from './components/TextPanel';
import { SignaturePanel } from './components/signature/SignaturePanel';
import { PageView } from './components/PageView';
import { Thumbnail } from './components/Thumbnail';

export default function App() {
  const ed = useEditor();
  const [pdfDoc, setPdfDoc] = useState<PdfDoc | null>(null);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [color, setColor] = useState('#ff0000');
  const [pendingText, setPendingText] = useState<TextOptions | null>(null);
  const [pendingPlacement, setPendingPlacement] = useState<{
    kind: 'text' | 'image' | 'signature';
    payload: Record<string, unknown>;
  } | null>(null);
  const [showSignature, setShowSignature] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const doc = await loadPdf(buf.slice(0));
      setPdfDoc(doc);
      ed.loadDocument(file.name, buf, doc.sizes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open that PDF.');
    } finally {
      setBusy(false);
    }
  }, [ed]);

  const onToolChange = useCallback(
    (t: Tool) => {
      ed.setTool(t);
      setPendingText(null);
      setPendingPlacement(null);
      setShowSignature(false);
      if (t === 'text') {
        setPendingText({
          text: '',
          size: 16,
          color,
          font: 'helvetica',
          bold: false,
          italic: false,
        });
        setPendingPlacement({ kind: 'text', payload: {} });
      } else if (t === 'image') {
        fileInputRef.current?.click();
      } else if (t === 'signature') {
        setShowSignature(true);
      }
    },
    [color, ed],
  );

  // Global keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input,textarea,select')) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) ed.redo(); else ed.undo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        ed.redo();
      } else if (!mod) {
        const map: Record<string, Tool> = {
          v: 'select', t: 'text', p: 'pen', h: 'highlight', r: 'rect', e: 'ellipse', i: 'image', s: 'signature',
        };
        const t = map[e.key.toLowerCase()];
        if (t && pdfDoc) onToolChange(t);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ed, pdfDoc, onToolChange]);

  // Global drag-drop (also on Dropzone).
  useEffect(() => {
    if (pdfDoc) return;
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      const f = e.dataTransfer?.files?.[0];
      if (f) handleFile(f);
    };
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', onDrop);
    return () => window.removeEventListener('drop', onDrop);
  }, [pdfDoc, handleFile]);

  const onPlacementPoint = useCallback(
    (x: number, y: number) => {
      if (!pendingPlacement || !ed.currentPageId) return;
      if (pendingPlacement.kind === 'text' && pendingText) {
        const edit: Edit = {
          id: uid('txt'),
          kind: 'text',
          pageId: ed.currentPageId,
          pos: { x, y },
          ...pendingText,
        };
        ed.addEdit(edit);
        setPendingText(null);
        setPendingPlacement(null);
      } else if (pendingPlacement.kind === 'image' || pendingPlacement.kind === 'signature') {
        const { dataUrl, source, w = 200, h = 200 } = pendingPlacement.payload as {
          dataUrl: string;
          source?: 'draw' | 'type' | 'upload';
          w: number;
          h: number;
        };
        const edit: Edit =
          pendingPlacement.kind === 'signature'
            ? {
                id: uid('sig'),
                kind: 'signature',
                pageId: ed.currentPageId,
                x,
                y,
                w,
                h,
                dataUrl,
                source: (source ?? 'draw') as 'draw' | 'type' | 'upload',
              }
            : {
                id: uid('img'),
                kind: 'image',
                pageId: ed.currentPageId,
                x,
                y,
                w,
                h,
                dataUrl,
                mime: mimeFromDataUrl(dataUrl),
              };
        ed.addEdit(edit);
        setPendingPlacement(null);
      }
    },
    [pendingPlacement, pendingText, ed],
  );

  const onPickImage = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      const err = validateImageFile(file);
      if (err) {
        setError(err);
        return;
      }
      const dataUrl = await downscaleToDataUrl(await fileToDataUrl(file));
      setPendingPlacement({
        kind: 'image',
        payload: { dataUrl, w: 240, h: 240 },
      });
      setError('Click on the page to place the image.');
      ed.setTool('select');
    },
    [ed],
  );

  const onSignatureInsert = useCallback(
    (dataUrl: string, source: 'draw' | 'type' | 'upload') => {
      setShowSignature(false);
      setPendingPlacement({
        kind: 'signature',
        payload: { dataUrl, source, w: 240, h: 80 },
      });
      setError('Click on the page to place the signature.');
      ed.setTool('select');
    },
    [ed],
  );

  const onDownload = useCallback(async () => {
    if (!ed.state) return;
    setDownloading(true);
    setError(null);
    try {
      const bytes = await applyEdits({
        sourceBytes: ed.state.sourceBytes,
        pages: ed.state.pages,
        editsByPage: ed.state.editsByPage,
        pageSizes: ed.state.pageSizes,
      });
      const name = ed.state.fileName.replace(/\.pdf$/i, '') || 'document';
      downloadBytes(bytes, `${name}-edited.pdf`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setDownloading(false);
    }
  }, [ed.state]);

  const onNew = useCallback(() => {
    setPdfDoc(null);
    setPendingText(null);
    setPendingPlacement(null);
    setShowSignature(false);
    setError(null);
  }, []);

  if (!pdfDoc || !ed.state) {
    return (
      <div className="app">
        <header className="topbar">
          <span className="brand">PDF Editor</span>
        </header>
        <Dropzone onFile={handleFile} busy={busy} />
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <footer className="privacy-note">
          100% client-side — files are processed only in this browser and never uploaded.
        </footer>
      </div>
    );
  }

  const pages = ed.state.pages;
  const currentIdx = ed.currentPage;
  const current = pages[currentIdx];
  const currentPageNum = current.origIndex + 1;

  return (
    <div className="app editor">
      <header className="topbar">
        <span className="brand">PDF Editor</span>
        <span className="file-name">{ed.state.fileName}</span>
        <span className="privacy-note small">
          100% client-side — processed only in this browser, never uploaded.
        </span>
      </header>

      <ToolDock
        tool={ed.tool}
        onTool={onToolChange}
        color={color}
        onColor={setColor}
        zoom={ed.zoom}
        onZoom={ed.setZoom}
        canUndo={ed.canUndo}
        canRedo={ed.canRedo}
        onUndo={ed.undo}
        onRedo={ed.redo}
        onDownload={onDownload}
        downloading={downloading}
        onNew={onNew}
      />

      <div className="editor-body">
        <aside className="thumbs" data-testid="thumbs">
          {pages.map((p, i) => (
            <Thumbnail
              key={p.id}
              doc={pdfDoc.raw}
              pageNum={p.origIndex + 1}
              rotation={p.rotation}
              active={i === currentIdx}
              onClick={() => ed.setCurrentPage(i)}
              onRotate={() => ed.rotatePage(i)}
              onDelete={() => ed.toggleDeletePage(i)}
              onMove={(dir) => ed.movePage(i, i + dir)}
              isFirst={i === 0}
              isLast={i === pages.length - 1}
              label={String(i + 1)}
              deleted={p.deleted}
            />
          ))}
        </aside>

        <main className="canvas-area" data-testid="canvas-area">
          {error && (
            <p className="error bar" role="alert">
              {error}
            </p>
          )}
          <PageView
            doc={pdfDoc.raw}
            pageNum={currentPageNum}
            rotation={current.rotation}
            zoom={ed.zoom}
            tool={ed.tool}
            color={color}
            pageId={current.id}
            edits={ed.currentEdits}
            onAddEdit={ed.addEdit}
            onDeleteEdit={(id) => ed.removeEdit(current.id, id)}
            onPlacementPoint={onPlacementPoint}
            pendingPlacement={!!pendingPlacement}
          />
          {pendingText && (
            <div className="panel-dock">
              <TextPanel
                initial={pendingText}
                onAdd={(opts) => setPendingText(opts)}
                onClose={() => {
                  setPendingText(null);
                  setPendingPlacement(null);
                }}
              />
            </div>
          )}
          {showSignature && (
            <div className="panel-dock">
              <SignaturePanel
                onInsert={onSignatureInsert}
                onClose={() => setShowSignature(false)}
              />
            </div>
          )}
        </main>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => onPickImage(e.target.files?.[0])}
      />
    </div>
  );
}
