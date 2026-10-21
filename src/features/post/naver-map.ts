export type MapLocation = { latitude: number; longitude: number; label: string };
export function validMapLocation(value: MapLocation): boolean {
  return Number.isFinite(value.latitude) && Math.abs(value.latitude) <= 90
    && Number.isFinite(value.longitude) && Math.abs(value.longitude) <= 180
    && value.label.length <= 200 && !/[\u0000-\u001f]/.test(value.label);
}
export function buildNaverMapEmbed(value: MapLocation): string | null {
  if (!validMapLocation(value)) return null;
  return `/maps/naver?${new URLSearchParams({ lat: String(value.latitude), lng: String(value.longitude), label: value.label })}`;
}
export function parseNaverMapEmbed(src: string): MapLocation | null {
  if (!src.startsWith("/maps/naver?") || src.includes("\\")) return null;
  try {
    const url = new URL(src, "https://pebble.local.invalid");
    if (url.pathname !== "/maps/naver" || url.hash || [...url.searchParams.keys()].some(key => !["lat", "lng", "label"].includes(key))) return null;
    if (["lat", "lng", "label"].some(key => url.searchParams.getAll(key).length !== 1)) return null;
    const lat = url.searchParams.get("lat")!, lng = url.searchParams.get("lng")!;
    if (!lat.trim() || !lng.trim()) return null;
    const value = { latitude: Number(lat), longitude: Number(lng), label: url.searchParams.get("label")! };
    return validMapLocation(value) ? value : null;
  } catch { return null; }
}
