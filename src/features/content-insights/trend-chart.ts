export type TrendRow = { label: string; values: number[] };
export function trendGeometry(rows: TrendRow[]) {
  const maximum = Math.max(1, ...rows.flatMap(row => row.values));
  return { maximum, points: rows.map((row, index) => ({
    x: rows.length === 1 ? 360 : 16 + index * 688 / (rows.length - 1),
    ys: row.values.map(value => 140 - value * 116 / maximum),
  })) };
}
/** Use the closest date across the whole plot, including narrow touch targets. */
export function trendIndexAtX(count: number, fraction: number): number | null {
  if (!count || !Number.isFinite(fraction)) return null;
  return Math.max(0, Math.min(count - 1, Math.round((fraction * 720 - 16) / 688 * (count - 1))));
}
