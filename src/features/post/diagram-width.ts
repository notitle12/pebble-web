export const MIN_DIAGRAM_WIDTH = 25;
export const MAX_DIAGRAM_WIDTH = 100;

export function clampDiagramWidth(value: number): number {
  return Math.max(MIN_DIAGRAM_WIDTH, Math.min(MAX_DIAGRAM_WIDTH, Math.round(value)));
}

export function resizedDiagramWidth(startWidth: number, deltaX: number, containerWidth: number): number {
  if (!Number.isFinite(containerWidth) || containerWidth <= 0) return clampDiagramWidth(startWidth);
  return clampDiagramWidth(startWidth + deltaX / containerWidth * 100);
}
