/** A bounded page window: API page indices remain zero-based. */
export function commentPageNumbers(page: number, totalPages: number): number[] {
  const count = Math.max(1, totalPages);
  const start = Math.max(0, Math.min(page - 2, count - 5));
  return Array.from({ length: Math.min(5, count) }, (_, offset) => start + offset);
}
