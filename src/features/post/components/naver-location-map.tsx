"use client";
import { useEffect, useRef, useState } from "react";
import { loadNaverMaps, type NaverMaps } from "../naver-maps-sdk";
import { validMapLocation, type MapLocation } from "../naver-map";
import styles from "./naver-location-map.module.css";

export function NaverLocationMap({ location, onSelect }: { location?: MapLocation | null; onSelect?: (value: MapLocation) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const maps = useRef<NaverMaps | null>(null);
  const map = useRef<InstanceType<NaverMaps["Map"]> | null>(null);
  const marker = useRef<InstanceType<NaverMaps["Marker"]> | null>(null);
  const select = useRef(onSelect); select.current = onSelect;
  const [ready, setReady] = useState(false), [error, setError] = useState("");
  const [query, setQuery] = useState(""), [searching, setSearching] = useState(false);
  const [results, setResults] = useState<MapLocation[]>([]);
  const [searchError, setSearchError] = useState("");
  const searchRevision = useRef(0);
  useEffect(() => {
    let active = true; let listener: unknown;
    loadNaverMaps().then(sdk => {
      if (!active || !container.current) return;
      maps.current = sdk;
      const point = new sdk.LatLng(location?.latitude ?? 37.5665, location?.longitude ?? 126.978);
      map.current = new sdk.Map(container.current, { center: point, zoom: 15, zoomControl: true });
      if (location) marker.current = new sdk.Marker({ position: point, map: map.current });
      if (select.current) listener = sdk.Event.addListener(map.current, "click", event => {
        const value = { latitude: event.coord.lat(), longitude: event.coord.lng(), label: "" };
        if (validMapLocation(value)) select.current?.(value);
      });
      setReady(true);
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "지도를 불러오지 못했어요."); });
    return () => { active = false; searchRevision.current++; if (listener && maps.current) maps.current.Event.removeListener(listener); marker.current?.setMap(null); map.current?.destroy(); };
  }, []);
  useEffect(() => {
    if (!ready || !location || !maps.current || !map.current) return;
    const point = new maps.current.LatLng(location.latitude, location.longitude);
    map.current.setCenter(point);
    if (marker.current) marker.current.setPosition(point);
    else marker.current = new maps.current.Marker({ position: point, map: map.current });
  }, [location, ready]);
  const search = () => {
    if (!maps.current || !query.trim() || searching) return;
    setSearching(true); setResults([]); setSearchError("");
    const revision = ++searchRevision.current;
    const timeout = setTimeout(() => { if (searchRevision.current === revision) { searchRevision.current++; setSearching(false); setSearchError("주소 검색에 시간이 걸리고 있어요. 다시 시도해 주세요."); } }, 10000);
    maps.current.Service.geocode({ query: query.trim() }, (status, response) => {
      clearTimeout(timeout); if (searchRevision.current !== revision) return;
      setSearching(false);
      if (status !== maps.current?.Service.Status.OK) { setSearchError("주소를 검색하지 못했어요. 잠시 후 다시 시도해 주세요."); return; }
      const items = response.v2.addresses.map(item => ({ latitude: Number(item.y), longitude: Number(item.x), label: (item.roadAddress || item.jibunAddress).slice(0, 200) })).filter(validMapLocation);
      setResults(items); if (!items.length) setSearchError("검색 결과가 없어요. 도로명이나 지번 주소로 검색해 주세요.");
    });
  };
  return <section className={styles.root} aria-label="네이버 지도">
    {onSelect && <><label>주소 검색<input placeholder="도로명 또는 지번 주소" value={query} disabled={!ready} onChange={event => { setQuery(event.target.value); searchRevision.current++; setSearching(false); setResults([]); setSearchError(""); }} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); search(); } }}/></label><button type="button" disabled={!ready || searching || !query.trim()} onClick={search}>{searching ? "검색 중…" : "주소 검색"}</button></>}
    {error ? <p role="status">{error}</p> : <>{!ready && <p role="status">지도를 불러오는 중…</p>}<div ref={container} className={styles.canvas} aria-label="위치 지도"/></>}
    {searchError && <p role="status">{searchError}</p>}
    {!!results.length && <ul>{results.map((item, index) => <li key={index}><button type="button" onClick={() => { onSelect?.(item); setResults([]); }}>{item.label}</button></li>)}</ul>}
    {onSelect && ready && <p>{location ? location.label || "지도에서 위치를 선택했어요." : "주소를 검색하거나 지도에서 원하는 위치를 클릭해 주세요."}</p>}
    {!onSelect && location && <a href={`https://map.naver.com/p/search/${encodeURIComponent(location.label || `${location.latitude},${location.longitude}`)}`} target="_blank" rel="noopener noreferrer">네이버 지도에서 보기</a>}
  </section>;
}
