"use client";
import { useId, useRef } from "react";
import type { ArchitectureNode, ArchitectureSpec } from "../api/post-list";
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
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function ArchitectureBlock({ spec, title, interactive = false, selectedNode, selectedGroup, connecting = false, onSelectNode, onSelectGroup, onConnect, onMoveNode, onMoveGroup, onResizeGroup }: {
  spec: ArchitectureSpec; title: string | null; interactive?: boolean; selectedNode?: string | null; selectedGroup?: string | null; connecting?: boolean;
  onSelectNode?: (id: string) => void; onSelectGroup?: (id: string) => void; onConnect?: (id: string) => void;
  onMoveNode?: (id: string, point: ArchPoint, finished?: boolean) => void; onMoveGroup?: (id: string, point: ArchPoint) => void;
  onResizeGroup?: (id: string, size: { width: number; height: number }) => void;
}) {
  const id = `architecture-${useId().replace(/:/g, "")}`;
  const { positions, groups, width, height } = architectureLayout(spec);
  const dragRef = useRef<PointerDrag | null>(null);
  const resizeRef = useRef<ResizeDrag | null>(null);
  const suppressClickRef = useRef(false);
  const nodeById = new Map(spec.nodes.map((node) => [node.id, node]));
  const groupById = new Map(spec.groups.map((group) => [group.id, group]));
  const endpointBox = (endpointId: string) => {
    const point = positions.get(endpointId);
    if (point) return { ...point, width: ARCH_NODE_WIDTH, height: ARCH_NODE_HEIGHT };
    return groups.get(endpointId);
  };
  const pointerScale = (svg: SVGSVGElement | null) => {
    const bounds = svg?.getBoundingClientRect();
    return { scaleX: bounds && width ? bounds.width / width : 1, scaleY: bounds && height ? bounds.height / height : 1 };
  };
  function beginNodeDrag(event: React.PointerEvent<SVGGElement>, node: ArchitectureNode) {
    if (!interactive || !onMoveNode) return;
    suppressClickRef.current = false; event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId);
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
    suppressClickRef.current = drag.moved; dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function beginGroupDrag(event: React.PointerEvent<SVGElement>, groupId: string) {
    if (!interactive || !onMoveGroup) return;
    const box = groups.get(groupId); if (!box) return;
    suppressClickRef.current = false; event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId);
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
    suppressClickRef.current = !cancelled && dragRef.current.moved; dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function beginResize(event: React.PointerEvent<SVGGElement>, groupId: string) {
    if (!interactive || !onResizeGroup) return;
    const box = groups.get(groupId); if (!box) return;
    suppressClickRef.current = false; event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId);
    resizeRef.current = { id: groupId, pointerId: event.pointerId, start: { x: event.clientX, y: event.clientY }, size: { width: box.width, height: box.height }, ...pointerScale(event.currentTarget.ownerSVGElement) };
  }
  function moveResize(event: React.PointerEvent<SVGGElement>) {
    const drag = resizeRef.current; if (!drag || drag.pointerId !== event.pointerId || !onResizeGroup) return;
    onResizeGroup(drag.id, { width: clamp(Math.round(drag.size.width + (event.clientX - drag.start.x) / (drag.scaleX || 1)), 200, 4200), height: clamp(Math.round(drag.size.height + (event.clientY - drag.start.y) / (drag.scaleY || 1)), 120, 4200) });
  }
  function endResize(event: React.PointerEvent<SVGGElement>) {
    if (resizeRef.current?.pointerId !== event.pointerId) return;
    resizeRef.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function connectHandle(endpointId: string, label: string, box: { x: number; y: number; width: number; height: number }) {
    if (!interactive || !onConnect) return null;
    const sides = [
      { name: "위쪽", x: box.x + box.width / 2, y: box.y },
      { name: "오른쪽", x: box.x + box.width, y: box.y + box.height / 2 },
      { name: "아래쪽", x: box.x + box.width / 2, y: box.y + box.height },
      { name: "왼쪽", x: box.x, y: box.y + box.height / 2 },
    ];
    return sides.map(side => <g key={`connect-${endpointId}-${side.name}`} data-architecture-endpoint={endpointId} className={`arch-connect-handle${connecting ? " is-connecting" : ""}`} transform={`translate(${side.x} ${side.y})`} role="button" tabIndex={0} aria-label={`${label} ${side.name} 연결 포인트`} onPointerDown={(event) => { suppressClickRef.current = false; event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); }} onPointerUp={(event) => { event.stopPropagation(); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} onClick={(event) => { event.stopPropagation(); if (suppressClickRef.current) { suppressClickRef.current = false; return; } onConnect(endpointId); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); onConnect(endpointId); } }}><circle className="arch-connect-hit" r="13"/><circle className="arch-connect-dot" r="5"/><title>{`${label} ${side.name} 연결 포인트`}</title></g>);
  }
  return <section className="architecture-block" aria-label={title ?? "시스템 아키텍처 다이어그램"}>
    {title !== null && <div className="architecture-heading"><h2>{title}</h2><p>구성 요소와 데이터 흐름</p></div>}
    <div className="architecture-scroll" role="region" tabIndex={0} aria-label="가로 스크롤 가능한 아키텍처 다이어그램">
      <svg className="architecture-svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="group" aria-label={title ?? "시스템 아키텍처"}>
        <defs><marker id={`${id}-arrow`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#78869a" /></marker></defs>
        {[...spec.groups].sort((a, b) => Number(a.type === "DOCKER") - Number(b.type === "DOCKER")).map((group) => { const box = groups.get(group.id)!; const color = group.type === "DOCKER" ? "arch-group-docker" : group.type === "CUSTOM" ? "arch-group-custom" : ""; const label = `${groupNames[group.type]} · ${group.label}`; const selected = selectedGroup === group.id; return <g key={group.id} className={`arch-group-wrap${interactive && (onMoveGroup || onSelectGroup) ? " is-interactive" : ""}${selected ? " is-selected" : ""}`}>
          <rect className={`arch-group ${color}`} x={box.x} y={box.y} width={box.width} height={box.height} rx="18" onPointerDown={(event) => beginGroupDrag(event, group.id)} onPointerMove={moveGroupDrag} onPointerUp={(event) => endGroupDrag(event)} onPointerCancel={(event) => endGroupDrag(event, true)} onLostPointerCapture={(event) => endGroupDrag(event, true)} onClick={() => { if (suppressClickRef.current) { suppressClickRef.current = false; return; } if (interactive) onSelectGroup?.(group.id); }} />
          <text data-architecture-endpoint={group.id} className="arch-group-label" x={box.x + 14} y={box.y + 24} tabIndex={interactive ? 0 : undefined} role={interactive ? "button" : undefined} aria-label={interactive ? label : undefined} onPointerDown={(event) => beginGroupDrag(event, group.id)} onPointerMove={moveGroupDrag} onPointerUp={(event) => endGroupDrag(event)} onPointerCancel={(event) => endGroupDrag(event, true)} onLostPointerCapture={(event) => endGroupDrag(event, true)} onClick={() => { if (suppressClickRef.current) { suppressClickRef.current = false; return; } if (interactive) onSelectGroup?.(group.id); }} onKeyDown={(event) => { if (!interactive) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelectGroup?.(group.id); return; } const delta = event.shiftKey ? 20 : 5; const vectors: Record<string, ArchPoint> = { ArrowLeft: { x: -delta, y: 0 }, ArrowRight: { x: delta, y: 0 }, ArrowUp: { x: 0, y: -delta }, ArrowDown: { x: 0, y: delta } }; const vector = vectors[event.key]; if (vector && onMoveGroup) { event.preventDefault(); onMoveGroup(group.id, { x: clamp(box.x + vector.x, 0, 4000), y: clamp(box.y + vector.y, 0, 4000) }); } }}>{short(label, box.width - 28, 12)}</text><title>{label}</title>
          {connectHandle(group.id, label, box)}
          {interactive && onResizeGroup && <g className="arch-group-resize" transform={`translate(${box.x + box.width} ${box.y + box.height})`} role="button" tabIndex={0} aria-label={`${label} 크기 조절`} onPointerDown={(event) => beginResize(event, group.id)} onPointerMove={moveResize} onPointerUp={endResize} onPointerCancel={endResize} onLostPointerCapture={endResize} onKeyDown={(event) => { const delta = event.shiftKey ? 20 : 5; const vectors: Record<string, { width: number; height: number }> = { ArrowLeft: { width: -delta, height: 0 }, ArrowRight: { width: delta, height: 0 }, ArrowUp: { width: 0, height: -delta }, ArrowDown: { width: 0, height: delta } }; const vector = vectors[event.key]; if (vector && onResizeGroup) { event.preventDefault(); event.stopPropagation(); onResizeGroup(group.id, { width: clamp(box.width + vector.width, 200, 4200), height: clamp(box.height + vector.height, 120, 4200) }); } }}><circle className="arch-group-resize-hit" r="12"/><path className="arch-group-resize-mark" d="M-7 7 7-7M0 7 7 0"/><title>{`${label} 크기 조절`}</title></g>}
        </g>; })}
        {spec.edges.map((edge) => { const from = endpointBox(edge.source), to = endpointBox(edge.target); if (!from || !to) return null; const sx = from.x + from.width / 2, sy = from.y + from.height / 2, tx = to.x + to.width / 2, ty = to.y + to.height / 2; const dx = tx - sx, dy = ty - sy; const length = Math.hypot(dx, dy); let path: string, labelX: number, labelY: number; if (length < 1) { const right = from.x + from.width + 8, left = to.x - 8, lane = from.y - 48; path = `M${right} ${sy} C${right + 88} ${sy},${right + 88} ${lane},${sx} ${lane} C${sx - 100} ${lane},${left - 88} ${sy},${left} ${sy}`; labelX = sx; labelY = lane - 7; } else { const ux = dx / length, uy = dy / length; const fromScale = Math.min((from.width / 2) / Math.abs(ux || .0001), (from.height / 2) / Math.abs(uy || .0001)); const toScale = Math.min((to.width / 2) / Math.abs(ux || .0001), (to.height / 2) / Math.abs(uy || .0001)); const startX = sx + ux * (fromScale + 4), startY = sy + uy * (fromScale + 4); const endX = tx - ux * (toScale + 8), endY = ty - uy * (toScale + 8); const bend = (startX + endX) / 2; path = `M${startX} ${startY} C${bend} ${startY},${bend} ${endY},${endX} ${endY}`; labelX = bend; labelY = (startY + endY) / 2 - 5; } return <g key={edge.id}><title>{`${nodeById.get(edge.source)?.label ?? groupById.get(edge.source)?.label} → ${nodeById.get(edge.target)?.label ?? groupById.get(edge.target)?.label}${edge.label ? ` · ${edge.label}` : ""}`}</title><path className="arch-edge" markerEnd={`url(#${id}-arrow)`} d={path} />{edge.label && <text className="arch-edge-label" x={labelX} y={labelY}>{short(edge.label, 112, 10)}</text>}</g>; })}
        {spec.nodes.map((node) => { const point = positions.get(node.id)!; const selected = selectedNode === node.id; return <g key={node.id} data-architecture-endpoint={node.id} className={`arch-node-wrap${interactive ? " arch-node-draggable" : ""}${selected ? " is-selected" : ""}`} transform={`translate(${point.x} ${point.y})`} onPointerDown={(event) => beginNodeDrag(event, node)} onPointerMove={moveNodeDrag} onPointerUp={(event) => endNodeDrag(event)} onPointerCancel={(event) => endNodeDrag(event, true)} onLostPointerCapture={(event) => endNodeDrag(event, true)} onClick={() => { if (suppressClickRef.current) { suppressClickRef.current = false; return; } if (interactive) onSelectNode?.(node.id); }} onKeyDown={(event) => { if (!interactive) return; const delta = event.shiftKey ? 20 : 5; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelectNode?.(node.id); return; } const vectors: Record<string, ArchPoint> = { ArrowLeft: { x: -delta, y: 0 }, ArrowRight: { x: delta, y: 0 }, ArrowUp: { x: 0, y: -delta }, ArrowDown: { x: 0, y: delta } }; const vector = vectors[event.key]; if (vector && onMoveNode) { event.preventDefault(); event.stopPropagation(); onMoveNode(node.id, { x: clamp(point.x + vector.x, 0, 4000), y: clamp(point.y + vector.y, 0, 4000) }, true); } }} tabIndex={interactive ? 0 : undefined} role={interactive ? "button" : undefined} aria-label={`${node.label}, ${typeNames[node.type]}`}><rect width={ARCH_NODE_WIDTH} height={ARCH_NODE_HEIGHT} rx="15" fill={nodeColors[node.type]} className="arch-node" /><ArchitectureIcon value={node.icon} /><text className="arch-node-type" x="80" y="29">{typeNames[node.type]}</text><text className="arch-node-label" x="80" y="55">{short(node.label, 136, 11)}</text></g>; })}
        {spec.nodes.map((node) => { const point = positions.get(node.id)!; return connectHandle(node.id, node.label, { ...point, width: ARCH_NODE_WIDTH, height: ARCH_NODE_HEIGHT }); })}
      </svg>
    </div>
    {!interactive && <div className="architecture-description"><h3>경계 그룹</h3>{spec.groups.length ? <ul>{spec.groups.map((group) => <li key={group.id}>{groupNames[group.type]} · {group.label}{group.parentId ? ` (내부: ${spec.groups.find((parent) => parent.id === group.parentId)?.label})` : ""}</li>)}</ul> : <p>경계 그룹이 없습니다.</p>}<h3>구성 요소</h3><ul>{spec.nodes.map((node) => <li key={node.id}><strong>{node.label}</strong> — {typeNames[node.type]}{node.groupId ? ` · ${spec.groups.find((group) => group.id === node.groupId)?.label}` : ""}</li>)}</ul><h3>연결</h3>{spec.edges.length ? <ol>{spec.edges.map((edge) => <li key={edge.id}>{nodeById.get(edge.source)?.label ?? groupById.get(edge.source)?.label} → {nodeById.get(edge.target)?.label ?? groupById.get(edge.target)?.label}{edge.label ? ` · ${edge.label}` : ""}</li>)}</ol> : <p>표시할 연결이 없습니다.</p>}</div>}
  </section>;
}
