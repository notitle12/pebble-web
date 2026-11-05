const MIN_IMAGE_WIDTH = 80;
const MAX_IMAGE_WIDTH = 1600;
const MAX_IMAGE_HEIGHT = 16000;

function safeDimension(value: unknown, max: number): number | null {
  const number = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
  return Number.isSafeInteger(number) && number > 0 && number <= max ? number : null;
}

export function normalizeImageDisplaySize(width: unknown, height: unknown): { width: number | null; height: number | null } {
  const safeWidth = safeDimension(width, MAX_IMAGE_WIDTH);
  const safeHeight = safeDimension(height, MAX_IMAGE_HEIGHT);
  if (safeWidth === null || safeHeight === null) return { width: null, height: null };
  return { width: safeWidth, height: safeHeight };
}

export function resizedImageDimensions(width: number, aspectRatio: number, maxWidth = MAX_IMAGE_WIDTH): { width: number; height: number } {
  const safeMax = Number.isFinite(maxWidth) ? Math.max(MIN_IMAGE_WIDTH, Math.min(MAX_IMAGE_WIDTH, Math.floor(maxWidth))) : MAX_IMAGE_WIDTH;
  const ratio = Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 1;
  const requested = Number.isFinite(width) ? Math.round(width) : MIN_IMAGE_WIDTH;
  // Very tall images may need to be narrower than the usual handle minimum.
  const nextWidth = Math.max(1, Math.min(Math.max(MIN_IMAGE_WIDTH, Math.min(safeMax, requested)), Math.floor(MAX_IMAGE_HEIGHT * ratio)));
  return { width: nextWidth, height: Math.max(1, Math.min(MAX_IMAGE_HEIGHT, Math.round(nextWidth / ratio))) };
}
