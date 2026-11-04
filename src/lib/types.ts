// Shared edit-model types. Edits are stored in *viewport* coordinates
// (pdf.js convention: CSS pixels, origin top-left, at scale = 1) so they
// are zoom-independent and survive pagination. Conversion to PDF points
// happens only at export time (see serialize.ts / coordinates.ts).

export interface Pt {
  x: number;
  y: number;
}

export type Color = string; // hex, e.g. "#ff0000"

export interface TextEdit {
  id: string;
  kind: 'text';
  pageId: string;
  /** Top-left anchor in viewport coords. */
  pos: Pt;
  text: string;
  size: number; // pt in viewport scale (== pdf pt at scale 1)
  color: Color;
  font: 'helvetica' | 'courier' | 'times';
  bold: boolean;
  italic: boolean;
}

export type StrokePoint = Pt;

export interface PenEdit {
  id: string;
  kind: 'pen';
  pageId: string;
  points: StrokePoint[];
  color: Color;
  width: number; // px in viewport coords
}

export interface HighlightEdit {
  id: string;
  kind: 'highlight';
  pageId: string;
  points: StrokePoint[];
  color: Color;
  width: number;
  opacity: number; // 0..1, typically 0.35
}

export interface ShapeEdit {
  id: string;
  kind: 'shape';
  pageId: string;
  shape: 'rect' | 'ellipse';
  x: number; // top-left in viewport coords
  y: number;
  w: number;
  h: number;
  stroke: Color;
  fill: Color | null; // null = transparent
  strokeWidth: number;
}

export interface ImageEdit {
  id: string;
  kind: 'image';
  pageId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** data URL (png/jpeg) captured at insert time; kept in memory only. */
  dataUrl: string;
  mime: string;
}

export interface SignatureEdit {
  id: string;
  kind: 'signature';
  pageId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  dataUrl: string; // rendered signature image (png)
  source: 'draw' | 'type' | 'upload';
}

export type Edit =
  | TextEdit
  | PenEdit
  | HighlightEdit
  | ShapeEdit
  | ImageEdit
  | SignatureEdit;

export type EditKind = Edit['kind'];

export interface PageEntry {
  /** Stable id for this logical page slot. */
  id: string;
  /** 0-based index into the ORIGINAL pdf page list. */
  origIndex: number;
  /** Total rotation applied by the user, degrees CW, normalised to 0/90/180/270. */
  rotation: number;
  deleted: boolean;
}

export type Tool =
  | 'select'
  | 'text'
  | 'pen'
  | 'highlight'
  | 'rect'
  | 'ellipse'
  | 'image'
  | 'signature';

export interface DocumentEdits {
  /** Edits keyed by pageId. */
  edits: Record<string, Edit[]>;
}

export function emptyDoc(): DocumentEdits {
  return { edits: {} };
}

let counter = 0;
export function uid(prefix = 'e'): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}
