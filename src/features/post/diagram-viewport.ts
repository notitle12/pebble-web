/** Preserve the content point under the cursor while zoom or canvas padding changes. */
export function diagramZoomScroll(scroll: number, anchor: number, ratio: number, previousPadding = 0, nextPadding = previousPadding) {
  return Math.max(0, (scroll + anchor - previousPadding) * ratio + nextPadding - anchor);
}

/** Include the unscaled canvas gutter when fitting the diagram into its viewport. */
export function diagramFitScale(width: number, height: number, viewportWidth: number, viewportHeight: number, padding = 0) {
  return Math.min(1, Math.max(1, viewportWidth - padding * 2) / width, Math.max(1, viewportHeight - padding * 2) / height);
}

/** Keep button zoom anchored on content when a wide diagram leaves vertical blank space. */
export function diagramZoomAnchor(viewportSize: number, contentSize: number, padding = 0) {
  return Math.min(viewportSize / 2, contentSize / 2 + padding);
}
