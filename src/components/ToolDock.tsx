import type { Tool } from '../lib/types';

interface Props {
  tool: Tool;
  onTool: (t: Tool) => void;
  color: string;
  onColor: (c: string) => void;
  zoom: number;
  onZoom: (z: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onDownload: () => void;
  downloading: boolean;
  onNew: () => void;
}

const TOOLS: { id: Tool; label: string; icon: string; title: string }[] = [
  { id: 'select', label: 'Select', icon: '↖', title: 'Select / move edits (V)' },
  { id: 'text', label: 'Text', icon: 'T', title: 'Add text (T)' },
  { id: 'pen', label: 'Pen', icon: '✎', title: 'Draw with pen (P)' },
  { id: 'highlight', label: 'Highlight', icon: '🖍', title: 'Highlight (H)' },
  { id: 'rect', label: 'Rect', icon: '▭', title: 'Rectangle (R)' },
  { id: 'ellipse', label: 'Ellipse', icon: '○', title: 'Ellipse (E)' },
  { id: 'image', label: 'Image', icon: '🖼', title: 'Add image (I)' },
  { id: 'signature', label: 'Sign', icon: '✍', title: 'Signature (S)' },
];

export function ToolDock(props: Props) {
  const { tool, onTool } = props;
  return (
    <div className="toolbar" data-testid="toolbar" role="toolbar" aria-label="Editing tools">
      <div className="tool-group">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tool === t.id ? 'tool active' : 'tool'}
            aria-pressed={tool === t.id}
            title={t.title}
            onClick={() => onTool(t.id)}
          >
            <span aria-hidden>{t.icon}</span>
            <span className="tool-label">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="tool-group controls">
        <label className="color" title="Stroke / text colour">
          <input
            type="color"
            value={props.color}
            onChange={(e) => props.onColor(e.target.value)}
            aria-label="Colour"
          />
        </label>
        <div className="zoom">
          <button type="button" onClick={() => props.onZoom(props.zoom - 0.1)} aria-label="Zoom out">
            −
          </button>
          <span>{Math.round(props.zoom * 100)}%</span>
          <button type="button" onClick={() => props.onZoom(props.zoom + 0.1)} aria-label="Zoom in">
            +
          </button>
        </div>
        <button type="button" disabled={!props.canUndo} onClick={props.onUndo} title="Undo (Ctrl+Z)">
          ↩
        </button>
        <button type="button" disabled={!props.canRedo} onClick={props.onRedo} title="Redo (Ctrl+Y)">
          ↪
        </button>
      </div>

      <div className="tool-group actions">
        <button type="button" onClick={props.onNew} title="Close this file">
          New
        </button>
        <button
          type="button"
          className="download"
          disabled={props.downloading}
          onClick={props.onDownload}
          data-testid="download"
        >
          {props.downloading ? 'Saving…' : 'Download PDF'}
        </button>
      </div>
    </div>
  );
}
