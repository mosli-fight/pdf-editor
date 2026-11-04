import { useEffect, useRef } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';

interface Props {
  doc: PDFDocumentProxy;
  pageNum: number; // 1-based original page number
  rotation: number; // display rotation added by user
  active: boolean;
  onClick: () => void;
  onRotate: () => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
  isFirst: boolean;
  isLast: boolean;
  label: string;
  deleted: boolean;
}

export function Thumbnail(props: Props) {
  const { doc, pageNum, rotation, active, onClick, deleted } = props;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const page = await doc.getPage(pageNum);
      const base = page.getViewport({ scale: 1 });
      const displayRot = ((page.rotate ?? 0) + rotation) % 360;
      const viewport = page.getViewport({ scale: 0.22, rotation: displayRot });
      void base;
      if (cancelled) return;
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      page.cleanup();
    })();
    return () => {
      cancelled = true;
    };
  }, [doc, pageNum, rotation]);

  return (
    <div
      className={`thumb ${active ? 'active' : ''} ${deleted ? 'deleted' : ''}`}
      data-testid="thumbnail"
      data-page={pageNum}
    >
      <button type="button" className="thumb-canvas" onClick={onClick} aria-label={`Go to page ${props.label}`}>
        <canvas ref={canvasRef} />
        <span className="thumb-label">
          {props.label}
          {deleted && ' (deleted)'}
        </span>
      </button>
      <div className="thumb-actions">
        <button type="button" title="Rotate 90°" onClick={props.onRotate} aria-label="Rotate page">
          ⟳
        </button>
        <button type="button" title={deleted ? 'Restore page' : 'Delete page'} onClick={props.onDelete} aria-label={deleted ? 'Restore page' : 'Delete page'}>
          {deleted ? '✕↩' : '✕'}
        </button>
        <button type="button" title="Move left" disabled={props.isFirst} onClick={() => props.onMove(-1)} aria-label="Move page earlier">
          ←
        </button>
        <button type="button" title="Move right" disabled={props.isLast} onClick={() => props.onMove(1)} aria-label="Move page later">
          →
        </button>
      </div>
    </div>
  );
}
