import { useDropzonePad } from './useSignaturePad';

interface Props {
  onDone: (dataUrl: string) => void;
  onClose: () => void;
}

export function SignaturePad({ onDone, onClose }: Props) {
  const { canvasRef, clear, hasInk, onPointerDown, onPointerMove, onPointerUp } = useDropzonePad();

  return (
    <div className="panel" data-testid="sig-panel">
      <h2>Draw your signature</h2>
      <canvas
        ref={canvasRef}
        className="sig-canvas"
        width={640}
        height={220}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        aria-label="Signature drawing area"
      />
      <div className="row actions">
        <button type="button" className="primary" disabled={!hasInk} onClick={() => onDone(canvasRef.current!.toDataURL('image/png'))}>
          Use this signature
        </button>
        <button type="button" onClick={clear}>
          Clear
        </button>
        <button type="button" onClick={onClose}>
          Cancel
        </button>
      </div>
      <p className="hint">Draw with the mouse or touch. The signature becomes a transparent PNG placed on the page.</p>
    </div>
  );
}
