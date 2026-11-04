import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { OverlayCanvas } from './OverlayCanvas';
import type { Edit, Tool } from '../lib/types';

interface Props {
  doc: PDFDocumentProxy;
  pageNum: number; // 1-based original page number
  rotation: number; // user-added rotation (0/90/180/270)
  zoom: number;
  tool: Tool;
  color: string;
  pageId: string;
  edits: Edit[];
  onAddEdit: (e: Edit) => void;
  onDeleteEdit: (id: string) => void;
  onPlacementPoint?: (x: number, y: number) => void;
  pendingPlacement?: boolean;
}

export function PageView(props: Props) {
  const { doc, pageNum, rotation, zoom } = props;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [viewSize, setViewSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const page = await doc.getPage(pageNum);
      const displayRot = ((page.rotate ?? 0) + rotation) % 360;
      const viewport = page.getViewport({ scale: zoom, rotation: displayRot });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      page.cleanup();
      if (!cancelled) {
        const atScale1 = page.getViewport({ scale: 1, rotation: displayRot });
        setViewSize({ w: atScale1.width, h: atScale1.height });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [doc, pageNum, zoom, rotation]);

  if (!viewSize) {
    return (
      <div className="page-view">
        <canvas ref={canvasRef} className="page-canvas" />
      </div>
    );
  }

  return (
    <div className="page-view">
      <div className="page-stack" style={{ width: viewSize.w * zoom, height: viewSize.h * zoom }}>
        <canvas ref={canvasRef} className="page-canvas" style={{ position: 'absolute', inset: 0 }} />
        <OverlayCanvas
          edits={props.edits}
          pageId={props.pageId}
          tool={props.tool}
          color={props.color}
          scale={zoom}
          pageViewSize={viewSize}
          onAddEdit={props.onAddEdit}
          onDeleteEdit={props.onDeleteEdit}
          onPlacementPoint={props.onPlacementPoint}
          pendingPlacement={props.pendingPlacement}
        />
      </div>
    </div>
  );
}
