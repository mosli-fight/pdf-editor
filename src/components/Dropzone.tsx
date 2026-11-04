import { useCallback, useRef, useState } from 'react';

interface Props {
  onFile: (file: File) => void;
  busy?: boolean;
}

const MAX_MB = 100;

export function Dropzone({ onFile, busy }: Props) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = useCallback(
    (files: FileList | null) => {
      setError(null);
      const f = files?.[0];
      if (!f) return;
      if (f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name)) {
        setError('That is not a PDF file. Please choose a .pdf.');
        return;
      }
      if (f.size === 0) {
        setError('That file is empty.');
        return;
      }
      if (f.size > MAX_MB * 1024 * 1024) {
        setError(`Files larger than ${MAX_MB} MB cannot be opened in the browser. This is a technical limit, not a paywall.`);
        return;
      }
      onFile(f);
    },
    [onFile],
  );

  return (
    <div
      data-testid="dropzone"
      className={`dropzone ${dragging ? 'dragging' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        accept(e.dataTransfer.files);
      }}
    >
      <div className="dropzone-inner">
        <h1>PDF Editor</h1>
        <p className="tagline">Edit any PDF in your browser.</p>
        <p className="privacy">
          <strong>100% client-side.</strong> Your file is processed only in this browser and is{' '}
          <strong>never uploaded</strong> — no signup, no watermark, no task cap. Files up to{' '}
          {MAX_MB} MB.
        </p>
        <button
          type="button"
          className="primary"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          data-testid="open-file"
        >
          {busy ? 'Opening…' : 'Open a PDF'}
        </button>
        <p className="hint">or drag &amp; drop a PDF anywhere on this page</p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          onChange={(e) => accept(e.target.files)}
        />
        <p className="sample">
          <a href="/sample.pdf" download>
            Download a sample PDF
          </a>{' '}
          to try it out.
        </p>
      </div>
    </div>
  );
}
