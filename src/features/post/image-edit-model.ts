export type CropOperation = { type: "crop"; x: number; y: number; width: number; height: number };
export type MosaicOperation = { type: "mosaic"; x: number; y: number; width: number; height: number; blockSize: number };
export type TextOperation = { type: "text"; text: string; x: number; y: number; fontSize: number; color: string };
export type ImageEditOperation = CropOperation | MosaicOperation | TextOperation;

export type PixelSize = { width: number; height: number };

export function safeBitmapSize(width: number, height: number): boolean {
  return Number.isSafeInteger(width) && Number.isSafeInteger(height)
    && width > 0 && height > 0 && width <= 8000 && height <= 8000
    && width * height <= 20_000_000;
}

export function clampCropRect(startX: number, startY: number, endX: number, endY: number, image: PixelSize): CropOperation | null {
  const left = Math.max(0, Math.min(image.width, Math.floor(Math.min(startX, endX))));
  const top = Math.max(0, Math.min(image.height, Math.floor(Math.min(startY, endY))));
  const right = Math.max(0, Math.min(image.width, Math.ceil(Math.max(startX, endX))));
  const bottom = Math.max(0, Math.min(image.height, Math.ceil(Math.max(startY, endY))));
  if (right - left < 2 || bottom - top < 2) return null;
  return { type: "crop", x: left, y: top, width: right - left, height: bottom - top };
}

export function dimensionsAfterCrop(size: PixelSize, operation: CropOperation): PixelSize {
  return { width: Math.min(size.width, operation.width), height: Math.min(size.height, operation.height) };
}

export function createMosaicOperation(rect: CropOperation, blockSize: number): MosaicOperation {
  return { ...rect, type: "mosaic", blockSize: Math.max(4, Math.min(48, Math.round(blockSize))) };
}

export function createTextOperation(text: string, x: number, y: number, size: PixelSize, fontSize: number, color: string): TextOperation | null {
  const safeText = text.trim().slice(0, 500);
  if (!safeText) return null;
  const safeColor = /^#[\da-f]{6}$/i.test(color) ? color.toLowerCase() : "#ffffff";
  return {
    type: "text", text: safeText,
    x: Math.max(0, Math.min(size.width, Math.round(x))),
    y: Math.max(0, Math.min(size.height, Math.round(y))),
    fontSize: Math.max(16, Math.min(160, Math.round(fontSize))), color: safeColor,
  };
}
