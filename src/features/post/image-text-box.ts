import { imageTextLines, type CropHandle, type PixelSize } from "./image-edit-model.ts";

export type ImageTextBox = { x: number; y: number; width: number; height: number };

/** Calculate an auto-growing text box in source-image pixels. */
export function autoImageTextBox(
  text: string,
  x: number,
  y: number,
  size: PixelSize,
  fontSize: number,
  measure: (line: string) => number,
): PixelSize {
  if (
    typeof text !== "string" ||
    ![x, y, size?.width, size?.height, fontSize].every(Number.isFinite) ||
    typeof measure !== "function" ||
    size.width <= 0 || size.height <= 0 || fontSize <= 0
  ) return { width: 0, height: 0 };

  const left = Math.max(0, Math.min(size.width, x));
  const top = Math.max(0, Math.min(size.height, y));
  const availableWidth = Math.max(0, size.width - left);
  const availableHeight = Math.max(0, size.height - top);
  const naturalWidth = text.split("\n").reduce((width, line) => {
    const measured = measure(line);
    return Number.isFinite(measured) && measured >= 0 ? Math.max(width, measured) : width;
  }, 0);
  const width = Math.min(availableWidth, Math.max(fontSize * 2, naturalWidth + 2));
  const lineHeight = Math.max(1, Math.round(fontSize * 1.25));
  const lines = imageTextLines(text, Math.max(0, width - 2), line => {
    const measured = measure(line);
    return Number.isFinite(measured) && measured >= 0 ? measured : Number.MAX_SAFE_INTEGER;
  });
  const height = Math.min(availableHeight, lines.length * lineHeight + 2);
  return { width, height };
}

/** Resize or move a text box while keeping the opposite edge anchored. */
export function resizeImageTextBox(
  rect: ImageTextBox,
  handle: CropHandle,
  dx: number,
  dy: number,
  size: PixelSize,
  fontSize: number,
): ImageTextBox {
  if (
    !rect || ![rect.x, rect.y, rect.width, rect.height, dx, dy, size?.width, size?.height, fontSize].every(Number.isFinite) ||
    size.width <= 0 || size.height <= 0 || fontSize <= 0 || rect.width < 0 || rect.height < 0
  ) return rect;
  if (!["move", "n", "s", "e", "w", "nw", "ne", "sw", "se"].includes(handle)) return rect;

  const round = (value: number) => Math.round(value);
  const x = Math.max(0, Math.min(size.width, rect.x));
  const y = Math.max(0, Math.min(size.height, rect.y));
  const right = Math.max(x, Math.min(size.width, rect.x + rect.width));
  const bottom = Math.max(y, Math.min(size.height, rect.y + rect.height));
  const requestedMinWidth = Math.min(fontSize, size.width);
  const requestedMinHeight = Math.min(Math.max(1, Math.round(fontSize * 1.25)), size.height);
  let left = x, top = y, nextRight = right, nextBottom = bottom;

  if (handle === "move") {
    const width = right - x, height = bottom - y;
    return {
      x: round(Math.max(0, Math.min(size.width - width, x + dx))),
      y: round(Math.max(0, Math.min(size.height - height, y + dy))),
      width: round(width), height: round(height),
    };
  }

  if (handle.includes("w")) left = Math.max(0, Math.min(nextRight - Math.min(requestedMinWidth, nextRight), x + dx));
  if (handle.includes("e")) nextRight = Math.max(left + Math.min(requestedMinWidth, size.width - left), Math.min(size.width, right + dx));
  if (handle.includes("n")) top = Math.max(0, Math.min(nextBottom - Math.min(requestedMinHeight, nextBottom), y + dy));
  if (handle.includes("s")) nextBottom = Math.max(top + Math.min(requestedMinHeight, size.height - top), Math.min(size.height, bottom + dy));

  return { x: round(left), y: round(top), width: round(nextRight - left), height: round(nextBottom - top) };
}
