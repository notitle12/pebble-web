"use client";
import { useId, useRef, useState } from "react";
import type { ArchitectureEdge, ArchitectureNode, ArchitectureSide, ArchitectureSpec } from "../api/post-list";
import { architectureEdgeRoute } from "../architecture-edge";
import { architectureLayout, ARCH_NODE_WIDTH, ARCH_NODE_HEIGHT, type ArchPoint } from "../architecture-layout";
export { architectureLayout, type ArchPoint } from "../architecture-layout";

const nodeColors: Record<string, string> = { CLIENT: "#e9f2ff", APP: "#edf7ef", DATABASE: "#fff1e6", CACHE: "#f5edff", STORAGE: "#e7f7f5", PROXY: "#fff8dc", CUSTOM: "#f1f3f8" };
const typeNames: Record<string, string> = { CLIENT: "클라이언트", APP: "앱 서버", DATABASE: "데이터베이스", CACHE: "캐시", STORAGE: "스토리지", PROXY: "프록시", CUSTOM: "사용자 정의" };
const groupNames: Record<string, string> = { ORACLE_CLOUD: "Oracle Cloud", AWS: "AWS", CLOUDFLARE: "Cloudflare", DOCKER: "Docker", CUSTOM: "사용자 정의" };
const short = (text: string, maxWidth = 138, fontSize = 11) => { let result = "", width = 0; for (const char of Array.from(text)) { const size = char.codePointAt(0)! > 255 ? fontSize : fontSize * .58; if (width + size > maxWidth) return `${result}…`; result += char; width += size; } return result; };
export function ArchitectureIcon({ value }: { value?: string | null }) {
  const shared = { className: `arch-tech-icon arch-icon-${(value ?? "custom").toLowerCase()}`, viewBox: "0 0 26 26", x: 10, y: 15, width: 26, height: 26 };
  if (value === "DOCKER" || value === "CONTAINER") return <svg {...shared} aria-hidden="true"><g fill="currentColor"><rect x="2" y="5" width="5" height="4" rx=".7"/><rect x="8" y="5" width="5" height="4" rx=".7"/><rect x="14" y="5" width="5" height="4" rx=".7"/><rect x="8" y="0" width="5" height="4" rx=".7"/><rect x="14" y="0" width="5" height="4" rx=".7"/><rect x="14" y="10" width="5" height="4" rx=".7"/><path d="M1 11h19c0 6-3 10-10 10-5 0-8-3-9-7z"/></g><path d="M20 13c2-2 4-1 5 0-1 2-3 3-5 2" fill="currentColor"/></svg>;
  if (value === "SPRING") return <svg {...shared} aria-hidden="true"><path d="M4 19c8-2 11-9 15-15 2 8 0 17-9 19-3 0-5-1-6-4Z" fill="currentColor"/><path d="M5 21 16 9" stroke="#fff" strokeWidth="1.5"/><path d="M13 12 12 7M10 16 6 15" stroke="#fff" strokeWidth="1.2"/></svg>;
  if (value === "POSTGRESQL" || value === "DATABASE") return <svg {...shared} aria-hidden="true"><ellipse cx="13" cy="5" rx="9" ry="3.5" fill="currentColor"/><path d="M4 5v14c0 2 4 4 9 4s9-2 9-4V5" fill="currentColor"/><path d="M4 11c0 2 4 4 9 4s9-2 9-4M4 17c0 2 4 4 9 4s9-2 9-4" fill="none" stroke="#fff" strokeWidth="1.3" opacity=".8"/></svg>;
  if (value === "REDIS" || value === "CACHE") return <svg {...shared} aria-hidden="true"><path d="m3 6 10-4 10 4-10 4zM3 11l10 4 10-4M3 16l10 4 10-4" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="m3 6 10 4 10-4M3 11v5M23 11v5" fill="none" stroke="#fff" strokeWidth="1.2"/></svg>;
  if (["AWS", "ORACLE_CLOUD", "CLOUDFLARE", "CLOUD", "WORKERS", "R2"].includes(value ?? "")) return <svg {...shared} aria-hidden="true"><path d="M6 19h14a4 4 0 0 0 .4-8A7 7 0 0 0 7 9a5 5 0 0 0-1 10Z" fill="currentColor"/><text x="13" y="16" fill="#fff" fontSize="6" fontWeight="800" textAnchor="middle">{value === "ORACLE_CLOUD" ? "OCI" : value === "CLOUDFLARE" ? "CF" : value === "AWS" ? "aws" : value === "R2" ? "R2" : "W"}</text></svg>;
  if (value === "REACT") return <svg {...shared} aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="1.5"><ellipse cx="13" cy="13" rx="11" ry="4.5"/><ellipse cx="13" cy="13" rx="11" ry="4.5" transform="rotate(60 13 13)"/><ellipse cx="13" cy="13" rx="11" ry="4.5" transform="rotate(120 13 13)"/></g><circle cx="13" cy="13" r="2" fill="currentColor"/></svg>;
  const mark = value === "NGINX" ? "N" : value === "NODEJS" ? "JS" : value === "CLIENT" ? "◎" : value === "STORAGE" ? "▤" : "◇";
  return <svg {...shared} aria-hidden="true"><circle cx="13" cy="13" r="11" fill="currentColor" opacity=".12"/><text x="13" y="18" fill="currentColor" fontSize="13" fontWeight="800" textAnchor="middle">{mark}</text></svg>;
}

type PointerDrag = { id: string; pointerId: number; start: { x: number; y: number }; point: ArchPoint; scaleX: number; scaleY: number; moved: boolean };
type ResizeDrag = { id: string; pointerId: number; start: { x: number; y: number }; size: { width: number; height: number }; scaleX: number; scaleY: number };
type EdgeDrag = { id: string; pointerId: number; start: { x: number; y: number }; point: ArchPoint; scaleX: number; scaleY: number; end?: "source" | "target" };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const sideNames: Record<ArchitectureSide, string> = { TOP: "위쪽", RIGHT: "오른쪽", BOTTOM: "아래쪽", LEFT: "왼쪽" };
const sides: ArchitectureSide[] = ["TOP", "RIGHT", "BOTTOM", "LEFT"];

export function ArchitectureBlock({ spec, title, interactive = false, selectedNode, selectedGroup, selectedEdge, connecting = false, onSelectNode, onSelectGroup, onSelectEdge, onConnect, onMoveNode, onMoveGroup, onResizeGroup, onMoveEdge, onReconnectEdge, onDeleteEdge, onInteractionStart, onInteractionEnd }: {
  spec: ArchitectureSpec; title: string | null; interactive?: boolean; selectedNode?: string | null; selectedGroup?: string | null; selectedEdge?: string | null; connecting?: boolean;
  onSelectNode?: (id: string) => void; onSelectGroup?: (id: string) => void; onSelectEdge?: (id: string) => void;
  onConnect?: (id: string, side: ArchitectureSide) => void;
  onMoveNode?: (id: string, point: ArchPoint, finished?: boolean) => void; onMoveGroup?: (id: string, point: ArchPoint) => void;
  onResizeGroup?: (id: string, size: { width: number; height: number }) => void;
  onMoveEdge?: (id: string, point: ArchPoint) => void; onReconnectEdge?: (id: string, end: "source" | "target", endpointId: string, side: ArchitectureSide) => void;
  onDeleteEdge?: (id: string) => void; onInteractionStart?: () => void; onInteractionEnd?: () => void;
}) {
  const id = `architecture-${useId().replace(/:/g, "")}`;
  const { positions, groups, width, height } = architectureLayout(spec);
  const dragRef = useRef<PointerDrag | null>(null);
  const resizeRef = useRef<ResizeDrag | null>(null);
  const [endpointPreview,setEndpointPreview] = useState<{id:string;end:"source"|"target";point:ArchPoint}|null>(null);
  const edgeDragRef = useRef<EdgeDrag | null>(null);
  const suppressClickRef = useRef(false);
  const nodeById = new Map(spec.nodes.map((node) => [node.id, node]));
  const groupById = new Map(spec.groups.map((group) => [group.id, group]));
  const endpointBox = (endpointId: string) => {
    const point = positions.get(endpointId);
    if (point) return { ...point, width: ARCH_NODE_WIDTH, height: ARCH_NODE_HEIGHT };
    return groups.get(endpointId);
  };
  const endpointLabel = (endpointId: string) => nodeById.get(endpointId)?.label ?? groupById.get(endpointId)?.label ?? endpointId;
  const pointerScale = (svg: SVGSVGElement | null) => {
    const bounds = svg?.getBoundingClientRect();
    return { scaleX: bounds && width ? bounds.width / width : 1, scaleY: bounds && height ? bounds.height / height : 1 };
  };
  const edgeRoutes = new Map<string, ReturnType<typeof architectureEdgeRoute>>();
  spec.edges.forEach((edge) => { const from = endpointBox(edge.source), to = endpointBox(edge.target); if (from && to) edgeRoutes.set(edge.id, architectureEdgeRoute(edge, endpointPreview?.id===edge.id && endpointPreview.end==="source" ? {...endpointPreview.point,width:0,height:0}:from, endpointPreview?.id===edge.id && endpointPreview.end==="target" ? {...endpointPreview.point,width:0,height:0}:to)); });
  function beginNodeDrag(event: React.PointerEvent<SVGGElement>, node: ArchitectureNode) {
    if (!interactive || !onMoveNode) return;
    suppressClickRef.current = false; event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); onInteractionStart?.();
    dragRef.current = { id: node.id, pointerId: event.pointerId, start: { x: event.clientX, y: event.clientY }, point: positions.get(node.id)!, ...pointerScale(event.currentTarget.ownerSVGElement), moved: false };
  }
  function moveNodeDrag(event: React.PointerEvent<SVGGElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !onMoveNode) return;
    const dx = event.clientX - drag.start.x, dy = event.clientY - drag.start.y;
    if (Math.hypot(dx, dy) > 3) drag.moved = true;
    onMoveNode(drag.id, { x: clamp(Math.round(drag.point.x + dx / (drag.scaleX || 1)), 0, 4000), y: clamp(Math.round(drag.point.y + dy / (drag.scaleY || 1)), 0, 4000) }, false);
  }
  function endNodeDrag(event: React.PointerEvent<SVGGElement>, cancelled = false) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!cancelled && onMoveNode) {
      const dx = event.clientX - drag.start.x, dy = event.clientY - drag.start.y;
      if (Math.hypot(dx, dy) > 3) drag.moved = true;
      onMoveNode(drag.id, { x: clamp(Math.round(drag.point.x + dx / (drag.scaleX || 1)), 0, 4000), y: clamp(Math.round(drag.point.y + dy / (drag.scaleY || 1)), 0, 4000) }, true);
    }
    suppressClickRef.current = drag.moved; dragRef.current = null; onInteractionEnd?.();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function beginGroupDrag(event: React.PointerEvent<SVGElement>, groupId: string) {
    if (!interactive || !onMoveGroup) return;
    const box = groups.get(groupId); if (!box) return;
    suppressClickRef.current = false; event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); onInteractionStart?.();
    dragRef.current = { id: groupId, pointerId: event.pointerId, start: { x: event.clientX, y: event.clientY }, point: { x: box.x, y: box.y }, ...pointerScale(event.currentTarget.ownerSVGElement), moved: false };
  }
  function moveGroupDrag(event: React.PointerEvent<SVGElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !onMoveGroup) return;
    const dx = event.clientX - drag.start.x, dy = event.clientY - drag.start.y;
    if (Math.hypot(dx, dy) > 3) drag.moved = true;
    onMoveGroup(drag.id, { x: clamp(Math.round(drag.point.x + dx / (drag.scaleX || 1)), 0, 4000), y: clamp(Math.round(drag.point.y + dy / (drag.scaleY || 1)), 0, 4000) });
  }
  function endGroupDrag(event: React.PointerEvent<SVGElement>, cancelled = false) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    suppressClickRef.current = !cancelled && dragRef.current.moved; dragRef.current = null; onInteractionEnd?.();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function beginResize(event: React.PointerEvent<SVGGElement>, groupId: string) {
    if (!interactive || !onResizeGroup) return;
    const box = groups.get(groupId); if (!box) return;
    suppressClickRef.current = false; event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); onInteractionStart?.();
    resizeRef.current = { id: groupId, pointerId: event.pointerId, start: { x: event.clientX, y: event.clientY }, size: { width: box.width, height: box.height }, ...pointerScale(event.currentTarget.ownerSVGElement) };
  }
  function moveResize(event: React.PointerEvent<SVGGElement>) {
    const drag = resizeRef.current; if (!drag || drag.pointerId !== event.pointerId || !onResizeGroup) return;
    onResizeGroup(drag.id, { width: clamp(Math.round(drag.size.width + (event.clientX - drag.start.x) / (drag.scaleX || 1)), 200, 4200), height: clamp(Math.round(drag.size.height + (event.clientY - drag.start.y) / (drag.scaleY || 1)), 120, 4200) });
  }
  function endResize(event: React.PointerEvent<SVGGElement>) {
    if (resizeRef.current?.pointerId !== event.pointerId) return;
    resizeRef.current = null; onInteractionEnd?.(); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function beginEdgeDrag(event: React.PointerEvent<SVGGElement>, edge: ArchitectureEdge, point: ArchPoint, end?: "source" | "target") {
    if (!interactive || (end ? !onReconnectEdge : !onMoveEdge)) return;
    event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); onInteractionStart?.();
    edgeDragRef.current = { id: edge.id, pointerId: event.pointerId, start: { x: event.clientX, y: event.clientY }, point, ...pointerScale(event.currentTarget.ownerSVGElement), end };
  }
  function moveEdgeDrag(event: React.PointerEvent<SVGGElement>) {
    const drag = edgeDragRef.current; if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.end) { setEndpointPreview({id:drag.id,end:drag.end,point:{x:clamp(Math.round(drag.point.x+(event.clientX-drag.start.x)/(drag.scaleX||1)),0,4200),y:clamp(Math.round(drag.point.y+(event.clientY-drag.start.y)/(drag.scaleY||1)),0,4200)}}); return; }
    if (!onMoveEdge) return;
    onMoveEdge(drag.id, { x: clamp(Math.round(drag.point.x + (event.clientX - drag.start.x) / (drag.scaleX || 1)), 0, 4200), y: clamp(Math.round(drag.point.y + (event.clientY - drag.start.y) / (drag.scaleY || 1)), 0, 4200) });
  }
  function reconnectAtPointer(event: React.PointerEvent<SVGGElement>, drag: EdgeDrag) {
    if (!drag.end || !onReconnectEdge) return;
    const hits = document.elementsFromPoint(event.clientX, event.clientY);
    const hit = hits.map(element=>element.closest("[data-architecture-endpoint]")).find(Boolean) as Element | undefined;
    const endpointId = hit?.getAttribute("data-architecture-endpoint");
    if (!hit || !endpointId) return;
    let side = hit.getAttribute("data-architecture-side") as ArchitectureSide | null;
    if (!side) {
      const rect = hit.getBoundingClientRect();
      const distances = [event.clientY - rect.top, rect.right - event.clientX, rect.bottom - event.clientY, event.clientX - rect.left];
      side = sides[distances.indexOf(Math.min(...distances))];
    }
    onReconnectEdge(drag.id, drag.end, endpointId, side);
  }
  function endEdgeDrag(event: React.PointerEvent<SVGGElement>, cancelled = false) {
    const drag = edgeDragRef.current; if (!drag || drag.pointerId !== event.pointerId) return;
    if (!cancelled) reconnectAtPointer(event, drag);
    setEndpointPreview(null); edgeDragRef.current = null; onInteractionEnd?.(); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function connectHandle(endpointId: string, label: string, box: { x: number; y: number; width: number; height: number }) {
    if (!interactive || !onConnect) return null;
    const points: Record<ArchitectureSide, ArchPoint> = { TOP: { x: box.x + box.width / 2, y: box.y }, RIGHT: { x: box.x + box.width, y: box.y + box.height / 2 }, BOTTOM: { x: box.x + box.width / 2, y: box.y + box.height }, LEFT: { x: box.x, y: box.y + box.height / 2 } };
    return sides.map((side) => <g key={`connect-${endpointId}-${side}`} data-architecture-endpoint={endpointId} data-architecture-side={side} className={`arch-connect-handle${connecting ? " is-connecting" : ""}`} transform={`translate(${points[side].x} ${points[side].y})`} role="button" tabIndex={0} aria-label={`${label} ${sideNames[side]} 연결 포인트`} onPointerDown={(event) => { suppressClickRef.current = false; event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); }} onPointerUp={(event) => { event.stopPropagation(); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} onClick={(event) => { event.stopPropagation(); if (suppressClickRef.current) { suppressClickRef.current = false; return; } onConnect(endpointId, side); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); onConnect(endpointId, side); } }}><circle className="arch-connect-hit" r="22"/><circle className="arch-connect-dot" r="5"/><title>{`${label} ${sideNames[side]} 연결 포인트`}</title></g>);
  }
  const edgeLabel = (edge: ArchitectureEdge) => `${endpointLabel(edge.source)} → ${endpointLabel(edge.target)}`;
  return <section className="architecture-block" aria-label={title ?? "시스템 아키텍처 다이어그램"}>
    {title !== null && <div className="architecture-heading"><h2>{title}</h2><p>구성 요소와 데이터 흐름</p></div>}
    <div className="architecture-scroll" role="region" tabIndex={0} aria-label="가로 스크롤 가능한 아키텍처 다이어그램">
      <svg className="architecture-svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="group" aria-label={title ?? "시스템 아키텍처"}>
        <defs><marker id={`${id}-arrow`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#78869a" /></marker></defs>
        {[...spec.groups].sort((a, b) => Number(a.type === "DOCKER") - Number(b.type === "DOCKER")).map((group) => { const box = groups.get(group.id)!; const color = group.type === "DOCKER" ? "arch-group-docker" : group.type === "CUSTOM" ? "arch-group-custom" : ""; const label = `${groupNames[group.type]} · ${group.label}`; const selected = selectedGroup === group.id; return <g key={group.id} className={`arch-group-wrap${interactive && (onMoveGroup || onSelectGroup) ? " is-interactive" : ""}${selected ? " is-selected" : ""}`}>
          <rect data-architecture-endpoint={group.id} className={`arch-group ${color}`} x={box.x} y={box.y} width={box.width} height={box.height} rx="18" onPointerDown={(event) => beginGroupDrag(event, group.id)} onPointerMove={moveGroupDrag} onPointerUp={(event) => endGroupDrag(event)} onPointerCancel={(event) => endGroupDrag(event, true)} onLostPointerCapture={(event) => endGroupDrag(event, true)} onClick={() => { if (suppressClickRef.current) { suppressClickRef.current = false; return; } if (interactive) onSelectGroup?.(group.id); }} />
          <text data-architecture-endpoint={group.id} className="arch-group-label" x={box.x + 14} y={box.y + 24} tabIndex={interactive ? 0 : undefined} role={interactive ? "button" : undefined} aria-label={interactive ? label : undefined} onPointerDown={(event) => beginGroupDrag(event, group.id)} onPointerMove={moveGroupDrag} onPointerUp={(event) => endGroupDrag(event)} onPointerCancel={(event) => endGroupDrag(event, true)} onLostPointerCapture={(event) => endGroupDrag(event, true)} onClick={() => { if (suppressClickRef.current) { suppressClickRef.current = false; return; } if (interactive) onSelectGroup?.(group.id); }} onKeyDown={(event) => { if (!interactive) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelectGroup?.(group.id); return; } const delta = event.shiftKey ? 20 : 5; const vectors: Record<string, ArchPoint> = { ArrowLeft: { x: -delta, y: 0 }, ArrowRight: { x: delta, y: 0 }, ArrowUp: { x: 0, y: -delta }, ArrowDown: { x: 0, y: delta } }; const vector = vectors[event.key]; if (vector && onMoveGroup) { event.preventDefault(); onInteractionStart?.(); onMoveGroup(group.id, { x: clamp(box.x + vector.x, 0, 4000), y: clamp(box.y + vector.y, 0, 4000) }); onInteractionEnd?.(); } }}>{short(label, box.width - 28, 12)}</text><title>{label}</title>
          {connectHandle(group.id, label, box)}
          {interactive && onResizeGroup && <g className="arch-group-resize" transform={`translate(${box.x + box.width} ${box.y + box.height})`} role="button" tabIndex={0} aria-label={`${label} 크기 조절`} onPointerDown={(event) => beginResize(event, group.id)} onPointerMove={moveResize} onPointerUp={endResize} onPointerCancel={endResize} onLostPointerCapture={endResize} onKeyDown={(event) => { const delta = event.shiftKey ? 20 : 5; const vectors: Record<string, { width: number; height: number }> = { ArrowLeft: { width: -delta, height: 0 }, ArrowRight: { width: delta, height: 0 }, ArrowUp: { width: 0, height: -delta }, ArrowDown: { width: 0, height: delta } }; const vector = vectors[event.key]; if (vector && onResizeGroup) { event.preventDefault(); event.stopPropagation(); onInteractionStart?.(); onResizeGroup(group.id, { width: clamp(box.width + vector.width, 200, 4200), height: clamp(box.height + vector.height, 120, 4200) }); onInteractionEnd?.(); } }}><circle className="arch-group-resize-hit" r="12"/><path className="arch-group-resize-mark" d="M-7 7 7-7M0 7 7 0"/><title>{`${label} 크기 조절`}</title></g>}
        </g>; })}
        {spec.edges.map((edge) => { const route = edgeRoutes.get(edge.id); if (!route) return null; const selected = interactive && selectedEdge === edge.id; const accessibleLabel = `연결 ${edgeLabel(edge)}`; return <g key={edge.id} className={`arch-edge-wrap${selected ? " is-selected" : ""}`} role={interactive ? "button" : undefined} tabIndex={interactive ? 0 : undefined} aria-label={interactive ? accessibleLabel : undefined} onClick={() => interactive && onSelectEdge?.(edge.id)} onKeyDown={(event) => { if (interactive && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onSelectEdge?.(edge.id); } }}><title>{`${edgeLabel(edge)}${edge.label ? ` · ${edge.label}` : ""}`}</title>{interactive && <path className="arch-edge-hit" d={route.path}/>}<path className="arch-edge" markerEnd={`url(#${id}-arrow)`} d={route.path}/>{edge.label && <text className="arch-edge-label" x={route.label.x} y={route.label.y}>{short(edge.label, 112, 10)}</text>}</g>; })}
        {spec.nodes.map((node) => { const point = positions.get(node.id)!; const selected = selectedNode === node.id; return <g key={node.id} data-architecture-endpoint={node.id} className={`arch-node-wrap${interactive ? " arch-node-draggable" : ""}${selected ? " is-selected" : ""}`} transform={`translate(${point.x} ${point.y})`} onPointerDown={(event) => beginNodeDrag(event, node)} onPointerMove={moveNodeDrag} onPointerUp={(event) => endNodeDrag(event)} onPointerCancel={(event) => endNodeDrag(event, true)} onLostPointerCapture={(event) => endNodeDrag(event, true)} onClick={() => { if (suppressClickRef.current) { suppressClickRef.current = false; return; } if (interactive) onSelectNode?.(node.id); }} onKeyDown={(event) => { if (!interactive) return; const delta = event.shiftKey ? 20 : 5; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelectNode?.(node.id); return; } const vectors: Record<string, ArchPoint> = { ArrowLeft: { x: -delta, y: 0 }, ArrowRight: { x: delta, y: 0 }, ArrowUp: { x: 0, y: -delta }, ArrowDown: { x: 0, y: delta } }; const vector = vectors[event.key]; if (vector && onMoveNode) { event.preventDefault(); event.stopPropagation(); onInteractionStart?.(); onMoveNode(node.id, { x: clamp(point.x + vector.x, 0, 4000), y: clamp(point.y + vector.y, 0, 4000) }, true); onInteractionEnd?.(); } }} tabIndex={interactive ? 0 : undefined} role={interactive ? "button" : undefined} aria-label={`${node.label}, ${typeNames[node.type]}`}><rect width={ARCH_NODE_WIDTH} height={ARCH_NODE_HEIGHT} rx="15" fill={nodeColors[node.type]} className="arch-node" /><ArchitectureIcon value={node.icon} /><text className="arch-node-type" x="80" y="29">{typeNames[node.type]}</text><text className="arch-node-label" x="80" y="55">{short(node.label, 136, 11)}</text></g>; })}
        {spec.nodes.map((node) => { const point = positions.get(node.id)!; return connectHandle(node.id, node.label, { ...point, width: ARCH_NODE_WIDTH, height: ARCH_NODE_HEIGHT }); })}
        {interactive && selectedEdge && (() => { const edge = spec.edges.find((item) => item.id === selectedEdge), route = edgeRoutes.get(selectedEdge); if (!edge || !route) return null; const sourceBox = endpointBox(edge.source), targetBox = endpointBox(edge.target); if (!sourceBox || !targetBox) return null; const toolbarY = route.bend.y - 43; return <g className="arch-edge-controls">
          <g className="arch-edge-waypoint" transform={`translate(${route.bend.x} ${route.bend.y})`} role="button" tabIndex={0} aria-label={`연결 경로 조절 ${edge.id}`} onPointerDown={(event) => beginEdgeDrag(event, edge, route.bend)} onPointerMove={moveEdgeDrag} onPointerUp={endEdgeDrag} onPointerCancel={(event) => endEdgeDrag(event, true)} onLostPointerCapture={(event) => endEdgeDrag(event, true)} onKeyDown={(event) => { const delta = event.shiftKey ? 20 : 5; const vectors: Record<string, ArchPoint> = { ArrowLeft: { x: -delta, y: 0 }, ArrowRight: { x: delta, y: 0 }, ArrowUp: { x: 0, y: -delta }, ArrowDown: { x: 0, y: delta } }; const vector = vectors[event.key]; if (vector && onMoveEdge) { event.preventDefault(); event.stopPropagation(); onInteractionStart?.(); onMoveEdge(edge.id, { x: clamp(route.bend.x + vector.x, 0, 4200), y: clamp(route.bend.y + vector.y, 0, 4200) }); onInteractionEnd?.(); } }}><circle className="arch-edge-waypoint-hit" r="12"/><circle className="arch-edge-waypoint-dot" r="4"/><title>{`연결 경로 조절 ${edge.id}`}</title></g>
          <g className="arch-edge-toolbar" transform={`translate(${route.bend.x} ${toolbarY})`}><rect x="-54" y="-13" width="108" height="26" rx="8"/><text x="-10" y="4" textAnchor="middle">{short(edge.label || "연결", 54, 10)}</text><g className="arch-edge-delete" transform="translate(36 0)" role="button" tabIndex={0} aria-label={`연결 삭제 ${edge.id}`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onDeleteEdge?.(edge.id); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); onDeleteEdge?.(edge.id); } }}><circle r="9"/><path d="m-3-3 6 6m0-6-6 6"/><title>{`연결 삭제 ${edge.id}`}</title></g></g>
          <g className="arch-edge-endpoint-handle source" transform={`translate(${route.start.x} ${route.start.y})`} role="button" tabIndex={0} aria-label={`연결 시작점 조절 ${edge.id}`} onPointerDown={(event) => beginEdgeDrag(event, edge, route.start, "source")} onPointerMove={moveEdgeDrag} onPointerUp={endEdgeDrag} onPointerCancel={(event) => endEdgeDrag(event, true)} onLostPointerCapture={(event) => endEdgeDrag(event, true)}><circle r="10"/><title>{`연결 시작점 조절 ${edge.id}`}</title></g>
          <g className="arch-edge-endpoint-handle target" transform={`translate(${route.end.x} ${route.end.y})`} role="button" tabIndex={0} aria-label={`연결 도착점 조절 ${edge.id}`} onPointerDown={(event) => beginEdgeDrag(event, edge, route.end, "target")} onPointerMove={moveEdgeDrag} onPointerUp={endEdgeDrag} onPointerCancel={(event) => endEdgeDrag(event, true)} onLostPointerCapture={(event) => endEdgeDrag(event, true)}><circle r="10"/><title>{`연결 도착점 조절 ${edge.id}`}</title></g>
        </g>; })()}
      </svg>
    </div>
    {!interactive && <div className="architecture-description"><h3>경계 그룹</h3>{spec.groups.length ? <ul>{spec.groups.map((group) => <li key={group.id}>{groupNames[group.type]} · {group.label}{group.parentId ? ` (내부: ${spec.groups.find((parent) => parent.id === group.parentId)?.label})` : ""}</li>)}</ul> : <p>경계 그룹이 없습니다.</p>}<h3>구성 요소</h3><ul>{spec.nodes.map((node) => <li key={node.id}><strong>{node.label}</strong> — {typeNames[node.type]}{node.groupId ? ` · ${spec.groups.find((group) => group.id === node.groupId)?.label}` : ""}</li>)}</ul><h3>연결</h3>{spec.edges.length ? <ol>{spec.edges.map((edge) => <li key={edge.id}>{edgeLabel(edge)}{edge.label ? ` · ${edge.label}` : ""}</li>)}</ol> : <p>표시할 연결이 없습니다.</p>}</div>}
  </section>;
}
