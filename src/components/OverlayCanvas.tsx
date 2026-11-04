import { useCallback, useEffect, useRef } from 'react';
import type { Edit, Tool } from '../lib/types';
import { uid } from '../lib/types';

interface Props {
  edits: Edit[];
  pageId: string;
  tool: Tool;
  color: string;
  scale: number; // current zoom
  pageViewSize: { w: number; h: number }; // viewport size at scale=1 (CSS px)
  onAddEdit: (e: Edit) => void;
  onDeleteEdit: (id: string) => void;
  onPlacementPoint?: (x: number, y: number) => void;
  pendingPlacement?: boolean;
  selectMode?: 'idle' | 'armed';
}

/** SVG overlay rendered at the same displayed size as the pdf.js canvas.
 *  All coordinates are in viewport (scale=1) space; the SVG viewBox does
 *  the zoom scaling, so hit-testing is zoom-independent. */
export function OverlayCanvas(props: Props) {
  const { edits, pageId, tool, color, scale, pageViewSize, onAddEdit, onDeleteEdit } = props;
  const svgRef = useRef<SVGSVGElement | null>(null);

  // ---- creation state ----
  const draft = useRef<Edit | null>(null);
  const draftShape = useRef<{ x: number; y: number } | null>(null);

  const toView = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      return {
        x: ((clientX - rect.left) / rect.width) * pageViewSize.w,
        y: ((clientY - rect.top) / rect.height) * pageViewSize.h,
      };
    },
    [pageViewSize],
  );

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const onPointerDown = (ev: PointerEvent) => {
      if (props.pendingPlacement) {
        const p = toView(ev.clientX, ev.clientY);
        props.onPlacementPoint?.(p.x, p.y);
        return;
      }
      if (tool === 'select') return;
      svg.setPointerCapture(ev.pointerId);
      const p = toView(ev.clientX, ev.clientY);
      if (tool === 'pen' || tool === 'highlight') {
        const id = uid('draw');
        const kind = tool === 'pen' ? 'pen' : 'highlight';
        draft.current = {
          id,
          kind,
          pageId,
          points: [p],
          color,
          width: tool === 'pen' ? 3 : 16,
          ...(tool === 'highlight' ? { opacity: 0.35 } : {}),
        } as Edit;
      } else if (tool === 'rect' || tool === 'ellipse') {
        draftShape.current = { x: p.x, y: p.y };
        draft.current = {
          id: uid('shape'),
          kind: 'shape',
          pageId,
          shape: tool,
          x: p.x,
          y: p.y,
          w: 0.01,
          h: 0.01,
          stroke: color,
          fill: null,
          strokeWidth: 2,
        } as Edit;
      }
    };

    const onPointerMove = (ev: PointerEvent) => {
      if (!draft.current) return;
      const p = toView(ev.clientX, ev.clientY);
      if (draft.current.kind === 'pen' || draft.current.kind === 'highlight') {
        const d = draft.current as Extract<Edit, { kind: 'pen' | 'highlight' }>;
        draft.current = { ...d, points: [...d.points, p] };
        redraw();
      } else if (draft.current.kind === 'shape' && draftShape.current) {
        const s = draftShape.current;
        const x = Math.min(s.x, p.x);
        const y = Math.min(s.y, p.y);
        draft.current = {
          ...(draft.current as Edit & { x: number; y: number; w: number; h: number }),
          x,
          y,
          w: Math.abs(p.x - s.x),
          h: Math.abs(p.y - s.y),
        } as Edit;
        redraw();
      }
    };

    const onPointerUp = () => {
      if (!draft.current) return;
      const d = draft.current;
      draft.current = null;
      draftShape.current = null;
      // Drop degenerate drafts.
      if ((d.kind === 'pen' || d.kind === 'highlight') && d.points.length === 0) return;
      if (d.kind === 'shape' && ((d as { w: number }).w < 2 || (d as { h: number }).h < 2)) return;
      onAddEdit(d);
      clearDraft();
    };

    function redraw() {
      // Re-render via React state would be heavy; mutate the temp node's attrs.
      const temp = svg?.querySelector('[data-draft]') as SVGElement | null;
      if (!temp || !draft.current) return;
      if (draft.current.kind === 'pen' || draft.current.kind === 'highlight') {
        const pts = (draft.current as { points: { x: number; y: number }[] }).points.map((p) => `${p.x},${p.y}`).join(' ');
        temp.setAttribute('points', pts);
      } else if (draft.current.kind === 'shape') {
        const d = draft.current as { x: number; y: number; w: number; h: number };
        temp.setAttribute('x', String(d.x));
        temp.setAttribute('y', String(d.y));
        temp.setAttribute('width', String(d.w));
        temp.setAttribute('height', String(d.h));
        if (temp.tagName === 'ellipse') {
          temp.setAttribute('cx', String(d.x + d.w / 2));
          temp.setAttribute('cy', String(d.y + d.h / 2));
          temp.setAttribute('rx', String(d.w / 2));
          temp.setAttribute('ry', String(d.h / 2));
        }
      }
    }

    function clearDraft() {
      svg?.querySelector('[data-draft]')?.remove();
    }

    const onClick = (ev: MouseEvent) => {
      if (tool !== 'select') return;
      const target = ev.target as Element;
      const id = target.getAttribute('data-edit-id');
      if (id) onDeleteEdit(id);
    };

    svg.addEventListener('pointerdown', onPointerDown);
    svg.addEventListener('pointermove', onPointerMove);
    svg.addEventListener('pointerup', onPointerUp);
    svg.addEventListener('click', onClick);
    return () => {
      svg.removeEventListener('pointerdown', onPointerDown);
      svg.removeEventListener('pointermove', onPointerMove);
      svg.removeEventListener('pointerup', onPointerUp);
      svg.removeEventListener('click', onClick);
    };
  }, [tool, color, pageId, onAddEdit, onDeleteEdit, toView, props]);

  return (
    <svg
      ref={svgRef}
      data-testid="overlay"
      className="overlay"
      viewBox={`0 0 ${pageViewSize.w} ${pageViewSize.h}`}
      width={pageViewSize.w * scale}
      height={pageViewSize.h * scale}
      style={{ position: 'absolute', inset: 0, cursor: tool === 'select' ? 'default' : 'crosshair', touchAction: 'none' }}
    >
      {edits.map((e) => (
        <EditNode key={e.id} edit={e} onDelete={onDeleteEdit} />
      ))}
      {/* live draft */}
      {draftShapeNode()}
    </svg>
  );

  function draftShapeNode() {
    if (draft.current) {
      const d = draft.current;
      if (d.kind === 'pen' || d.kind === 'highlight') {
        return (
          <polyline
            data-draft
            fill="none"
            stroke={d.color}
            strokeWidth={d.width}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={d.kind === 'highlight' ? 0.35 : 1}
            points={d.points.map((p) => `${p.x},${p.y}`).join(' ')}
            pointerEvents="none"
          />
        );
      }
      if (d.kind === 'shape' && d.shape === 'rect') {
        return <rect data-draft x={d.x} y={d.y} width={d.w} height={d.h} fill="none" stroke={d.stroke} strokeWidth={d.strokeWidth} pointerEvents="none" />;
      }
      if (d.kind === 'shape' && d.shape === 'ellipse') {
        return <ellipse data-draft cx={d.x + d.w / 2} cy={d.y + d.h / 2} rx={d.w / 2} ry={d.h / 2} fill="none" stroke={d.stroke} strokeWidth={d.strokeWidth} pointerEvents="none" />;
      }
    }
    return null;
  }
}

function EditNode({ edit, onDelete }: { edit: Edit; onDelete: (id: string) => void }) {
  const common = {
    'data-edit-id': edit.id,
    style: { cursor: 'pointer' },
    onClick: (e: React.MouseEvent) => {
      if (e.altKey || e.metaKey) onDelete(edit.id);
    },
  } as const;

  switch (edit.kind) {
    case 'text': {
      const fontFamily =
        edit.font === 'courier' ? 'Courier New, monospace' : edit.font === 'times' ? 'Times New Roman, serif' : 'Helvetica, Arial, sans-serif';
      return (
        <text
          {...common}
          x={edit.pos.x}
          y={edit.pos.y}
          fontSize={edit.size}
          fill={edit.color}
          fontFamily={fontFamily}
          fontWeight={edit.bold ? 'bold' : 'normal'}
          fontStyle={edit.italic ? 'italic' : 'normal'}
        >
          {edit.text}
        </text>
      );
    }
    case 'pen':
    case 'highlight': {
      return (
        <polyline
          {...common}
          fill="none"
          stroke={edit.color}
          strokeWidth={edit.width}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={edit.kind === 'highlight' ? edit.opacity : 1}
          points={edit.points.map((p) => `${p.x},${p.y}`).join(' ')}
        />
      );
    }
    case 'shape': {
      if (edit.shape === 'rect') {
        return (
          <rect
            {...common}
            x={edit.x}
            y={edit.y}
            width={edit.w}
            height={edit.h}
            fill={edit.fill ?? 'none'}
            stroke={edit.stroke}
            strokeWidth={edit.strokeWidth}
          />
        );
      }
      return (
        <ellipse
          {...common}
          cx={edit.x + edit.w / 2}
          cy={edit.y + edit.h / 2}
          rx={edit.w / 2}
          ry={edit.h / 2}
          fill={edit.fill ?? 'none'}
          stroke={edit.stroke}
          strokeWidth={edit.strokeWidth}
        />
      );
    }
    case 'image':
    case 'signature': {
      return <image {...common} x={edit.x} y={edit.y} width={edit.w} height={edit.h} href={edit.dataUrl} />;
    }
    default:
      return null;
  }
}
