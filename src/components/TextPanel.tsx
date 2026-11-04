import { useEffect, useState } from 'react';

export interface TextOptions {
  text: string;
  size: number;
  color: string;
  font: 'helvetica' | 'courier' | 'times';
  bold: boolean;
  italic: boolean;
}

interface Props {
  initial: TextOptions;
  onAdd: (opts: TextOptions) => void;
  onClose: () => void;
}

export function TextPanel({ initial, onAdd, onClose }: Props) {
  const [opts, setOpts] = useState<TextOptions>(initial);
  const [ref, setRef] = useState<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    ref?.focus();
  }, [ref]);

  const submit = () => {
    if (!opts.text.trim()) return;
    onAdd(opts);
  };

  return (
    <div className="panel" data-testid="text-panel">
      <h2>Add text</h2>
      <label>
        Text
        <textarea
          ref={setRef}
          rows={2}
          value={opts.text}
          onChange={(e) => setOpts({ ...opts, text: e.target.value })}
          placeholder="Type text to place on the page"
        />
      </label>
      <div className="row">
        <label>
          Size
          <input
            type="number"
            min={6}
            max={96}
            value={opts.size}
            onChange={(e) => setOpts({ ...opts, size: Math.max(6, Number(e.target.value) || 14) })}
          />
        </label>
        <label>
          Font
          <select
            value={opts.font}
            onChange={(e) => setOpts({ ...opts, font: e.target.value as TextOptions['font'] })}
          >
            <option value="helvetica">Helvetica</option>
            <option value="times">Times Roman</option>
            <option value="courier">Courier</option>
          </select>
        </label>
        <label>
          Colour
          <input
            type="color"
            value={opts.color}
            onChange={(e) => setOpts({ ...opts, color: e.target.value })}
          />
        </label>
      </div>
      <div className="row">
        <label className="check">
          <input type="checkbox" checked={opts.bold} onChange={(e) => setOpts({ ...opts, bold: e.target.checked })} />
          Bold
        </label>
        <label className="check">
          <input type="checkbox" checked={opts.italic} onChange={(e) => setOpts({ ...opts, italic: e.target.checked })} />
          Italic
        </label>
      </div>
      <div className="row actions">
        <button type="button" className="primary" onClick={submit} disabled={!opts.text.trim()}>
          Place on page
        </button>
        <button type="button" onClick={onClose}>
          Cancel
        </button>
      </div>
      <p className="hint">Then click on the page where the text should go.</p>
    </div>
  );
}
