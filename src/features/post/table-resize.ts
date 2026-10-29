/**
 * Internal boundaries borrow spare space from their next neighbor. Once that
 * neighbor reaches its minimum, growing the first segment grows the table.
 * Shrinking an internal segment gives space back without shrinking the table.
 * The final, outer boundary changes just the final segment.
 */
export function resizeTableSegments(sizes: number[], boundary: number, delta: number, minimums: number[], maximum = Infinity) {
  if (!sizes.length || maximum <= 0 || Number.isNaN(maximum) || !Number.isInteger(boundary) || boundary < 0 || boundary >= sizes.length || !Number.isFinite(delta)
    || minimums.length !== sizes.length || sizes.some(size => !Number.isFinite(size) || size <= 0 || size > maximum)
    || minimums.some((minimum, index) => !Number.isFinite(minimum) || minimum <= 0 || minimum > sizes[index])) return null;
  const next = [...sizes], neighbor = boundary + 1;
  const lower = Math.max(minimums[boundary] - sizes[boundary], neighbor < sizes.length ? sizes[neighbor] - maximum : -Infinity);
  const change = Math.max(lower, Math.min(maximum - sizes[boundary], Math.round(delta)));
  next[boundary] += change;
  if (neighbor < sizes.length) next[neighbor] = Math.max(minimums[neighbor], sizes[neighbor] - change);
  return next;
}
