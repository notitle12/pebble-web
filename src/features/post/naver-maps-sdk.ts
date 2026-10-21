type Coordinate = { lat(): number; lng(): number };
type MapInstance = { setCenter(point: Coordinate): void; destroy(): void };
type Marker = { setPosition(point: Coordinate): void; setMap(map: MapInstance | null): void };
export type NaverMaps = {
  LatLng: new (lat: number, lng: number) => Coordinate;
  Map: new (element: HTMLElement, options: Record<string, unknown>) => MapInstance;
  Marker: new (options: { position: Coordinate; map: MapInstance }) => Marker;
  Event: { addListener(map: MapInstance, event: string, callback: (event: { coord: Coordinate }) => void): unknown; removeListener(listener: unknown): void };
  Service: { Status: { OK: string }; geocode(options: { query: string }, callback: (status: string, response: { v2: { addresses: { x: string; y: string; roadAddress: string; jibunAddress: string }[] } }) => void): void };
};
let loading: Promise<NaverMaps> | null = null;
export function loadNaverMaps(): Promise<NaverMaps> {
  if (loading) return loading;
  loading = (async () => {
    const response = await fetch("/api/maps/config", { cache: "no-store" });
    if (!response.ok) throw new Error("지도 설정을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    const { clientId } = await response.json();
    if (typeof clientId !== "string" || !clientId) throw new Error("네이버 지도 연결을 준비 중이에요.");
    const target = window as unknown as { naver?: { maps: NaverMaps }; __pebbleNaverMapsReady?: () => void; navermap_authFailure?: () => void };
    if (target.naver?.maps?.Service) return target.naver.maps;
    return await new Promise<NaverMaps>((resolve, reject) => {
      const script = document.createElement("script");
      const finish = (error?: string) => {
        clearTimeout(timeout); delete target.__pebbleNaverMapsReady; delete target.navermap_authFailure;
        if (error || !target.naver?.maps?.Service) { script.remove(); reject(new Error(error || "지도를 불러오지 못했어요.")); }
        else resolve(target.naver.maps);
      };
      const timeout = setTimeout(() => finish("지도를 불러오지 못했어요. 잠시 후 다시 시도해 주세요."), 10000);
      target.__pebbleNaverMapsReady = () => finish();
      target.navermap_authFailure = () => finish("네이버 지도 연결을 확인하고 있어요.");
      script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?${new URLSearchParams({ ncpKeyId: clientId, submodules: "geocoder", callback: "__pebbleNaverMapsReady" })}`;
      script.async = true; script.onerror = () => finish("지도를 불러오지 못했어요. 네트워크 연결을 확인해 주세요.");
      document.head.appendChild(script);
    });
  })();
  loading.catch(() => { loading = null; });
  return loading;
}
