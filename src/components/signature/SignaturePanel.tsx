import { useDropzonePad } from './useSignaturePad';
import { useRef, useState } from 'react';

interface Props {
  onInsert: (dataUrl: string, source: 'draw' | 'type' | 'upload') => void;
  onClose: () => void;
}

export function SignaturePanel({ onInsert, onClose }: Props) {
  const { canvasRef, clear, hasInk, onPointerDown, onPointerMove, onPointerUp } = useDropzonePad();
  const fileRef = useRef<HTMLInputElement>(null);

  const onUpload = (f: File | undefined) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => onInsert(reader.result as string, 'upload');
    reader.readAsDataURL(f);
  };

  return (
    <div className="panel wide" data-testid="sig-panel">
      <h2>Signature</h2>
      <div className="sig-tabs">
        <section>
          <h3>Draw</h3>
          <canvas
            ref={canvasRef}
            className="sig-canvas"
            width={640}
            height={180}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            aria-label="Draw signature"
          />
          <div className="row">
            <button type="button" className="primary" disabled={!hasInk} onClick={() => onInsert(canvasRef.current!.toDataURL('image/png'), 'draw')}>
              Use drawn signature
            </button>
            <button type="button" onClick={clear}>
              Clear
            </button>
          </div>
        </section>
        <section>
          <h3>Type</h3>
          <p className="hint">Renders your typed name in an italic script style.</p>
          <TypedSignature onInsert={(dataUrl) => onInsert(dataUrl, 'type')} />
        </section>
        <section>
          <h3>Upload</h3>
          <p className="hint">PNG/JPG of an existing signature image.</p>
          <button type="button" onClick={() => fileRef.current?.click()}>
            Choose image…
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg"
            hidden
            onChange={(e) => onUpload(e.target.files?.[0])}
          />
        </section>
      </div>
      <div className="row actions">
        <button type="button" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function TypedSignature({ onInsert }: { onInsert: (dataUrl: string) => void }) {
  const [name, setName] = useState('');
  const insert = () => {
    if (!name.trim()) return;
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 160;
    const ctx = canvas.getContext('2d')!;
    ctx.font = 'italic 64px "Brush Script MT", "Segoe Script", cursive';
    ctx.fillStyle = '#111';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, 20, canvas.height / 2);
    onInsert(canvas.toDataURL('image/png'));
  };
  return (
    <div>
      <label>
        Your name
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alex Morgan" />
      </label>
      <div className="row">
        <button type="button" className="primary" disabled={!name.trim()} onClick={insert}>
          Use typed signature
        </button>
      </div>
    </div>
  );
}
