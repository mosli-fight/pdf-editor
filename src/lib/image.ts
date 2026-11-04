// Image helpers: file -> data URL, downscale large images before embed.

export function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function validateImageFile(file: File): string | null {
  if (!file.type.startsWith('image/')) return 'Only image files (PNG/JPG/etc.) are supported.';
  if (file.size > 15 * 1024 * 1024) return 'Image is larger than 15 MB.';
  return null;
}

/** Downscale an image (via canvas) so its longest side <= maxSide. Returns a PNG data URL. */
export async function downscaleToDataUrl(dataUrl: string, maxSide = 1600): Promise<string> {
  const img = await loadImage(dataUrl);
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  if (scale === 1) return dataUrl;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function mimeFromDataUrl(dataUrl: string): string {
  const m = dataUrl.match(/^data:image\/([^;]+)/i);
  return m ? m[1].toLowerCase() : 'png';
}
