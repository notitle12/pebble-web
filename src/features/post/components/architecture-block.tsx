"use client";
import { useId, useRef } from "react";
import type { ArchitectureNode, ArchitectureSpec } from "../api/post-list";

const nodeColors: Record<string, string> = { CLIENT: "#e9f2ff", APP: "#edf7ef", DATABASE: "#fff1e6", CACHE: "#f5edff", STORAGE: "#e7f7f5", PROXY: "#fff8dc", CUSTOM: "#f1f3f8" };
const typeNames: Record<string, string> = { CLIENT: "클라이언트", APP: "앱 서버", DATABASE: "데이터베이스", CACHE: "캐시", STORAGE: "스토리지", PROXY: "프록시", CUSTOM: "사용자 정의" };
const groupNames: Record<string, string> = { ORACLE_CLOUD: "Oracle Cloud", AWS: "AWS", CLOUDFLARE: "Cloudflare", DOCKER: "Docker", CUSTOM: "사용자 정의" };
import { architectureLayout, ARCH_NODE_WIDTH, ARCH_NODE_HEIGHT, type ArchPoint } from "../architecture-layout";
export { architectureLayout, type ArchPoint } from "../architecture-layout";

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
export function ArchitectureBlock({ spec, title, interactive = false, selectedNode, onSelectNode, onMoveNode }: { spec: ArchitectureSpec; title: string | null; interactive?: boolean; selectedNode?: string | null; onSelectNode?: (id: string) => void; onMoveNode?: (id: string, point: ArchPoint) => void }) {
  const id = `architecture-${useId().replace(/:/g, "")}`;
  const { positions, groups, width, height } = architectureLayout(spec);
  const dragRef = useRef<{ id: string; pointerId: number; start: { x: number; y: number }; point: ArchPoint } | null>(null);
  const nodeById = new Map(spec.nodes.map((node) => [node.id, node]));
  function beginDrag(event: React.PointerEvent<SVGGElement>, node: ArchitectureNode) {
    if (!interactive || !onMoveNode) return;
    event.preventDefault(); event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { id: node.id, pointerId: event.pointerId, start: { x: event.clientX, y: event.clientY }, point: positions.get(node.id)! };
  }
  function moveDrag(event: React.PointerEvent<SVGGElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !onMoveNode) return;
    const svg = event.currentTarget.ownerSVGElement;
    const bounds = svg?.getBoundingClientRect();
    const scaleX = bounds ? bounds.width / width : 1;
    const scaleY = bounds ? bounds.height / height : 1;
    onMoveNode(drag.id, { x: Math.max(0, Math.min(4000, Math.round(drag.point.x + (event.clientX - drag.start.x) / (scaleX || 1)))), y: Math.max(0, Math.min(4000, Math.round(drag.point.y + (event.clientY - drag.start.y) / (scaleY || 1)))) });
  }
  function endDrag(event: React.PointerEvent<SVGGElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  return <section className="architecture-block" aria-label={title ?? "시스템 아키텍처 다이어그램"}>
    {title !== null && <div className="architecture-heading"><h2>{title}</h2><p>구성 요소와 데이터 흐름</p></div>}
    <div className="architecture-scroll" role="region" tabIndex={0} aria-label="가로 스크롤 가능한 아키텍처 다이어그램">
      <svg className="architecture-svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="group" aria-label={title ?? "시스템 아키텍처"}>
        <defs><marker id={`${id}-arrow`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#78869a" /></marker></defs>
        {[...spec.groups].sort((a, b) => Number(a.type === "DOCKER") - Number(b.type === "DOCKER")).map((group) => { const box = groups.get(group.id)!; const color = group.type === "DOCKER" ? "arch-group-docker" : group.type === "CUSTOM" ? "arch-group-custom" : ""; return <g key={group.id}><rect className={`arch-group ${color}`} x={box.x} y={box.y} width={box.width} height={box.height} rx="18" /><text className="arch-group-label" x={box.x + 14} y={box.y + 24}>{short(`${groupNames[group.type]} · ${group.label}`, box.width - 28, 12)}</text><title>{`${groupNames[group.type]} · ${group.label}`}</title></g>; })}
        {spec.edges.map((edge) => { const from = positions.get(edge.source)!, to = positions.get(edge.target)!; const sx = from.x + ARCH_NODE_WIDTH / 2, sy = from.y + ARCH_NODE_HEIGHT / 2, tx = to.x + ARCH_NODE_WIDTH / 2, ty = to.y + ARCH_NODE_HEIGHT / 2; const dx = tx - sx, dy = ty - sy; const length = Math.hypot(dx, dy); let path: string, labelX: number, labelY: number; if (length < 1) { const right = from.x + ARCH_NODE_WIDTH + 8, left = to.x - 8, lane = from.y - 48; path = `M${right} ${sy} C${right + 88} ${sy},${right + 88} ${lane},${sx} ${lane} C${sx - 100} ${lane},${left - 88} ${sy},${left} ${sy}`; labelX = sx; labelY = lane - 7; } else { const ux = dx / length, uy = dy / length; const fromScale = Math.min((ARCH_NODE_WIDTH / 2) / Math.abs(ux || .0001), (ARCH_NODE_HEIGHT / 2) / Math.abs(uy || .0001)); const toScale = fromScale; const startX = sx + ux * (fromScale + 4), startY = sy + uy * (fromScale + 4); const endX = tx - ux * (toScale + 8), endY = ty - uy * (toScale + 8); const bend = (startX + endX) / 2; path = `M${startX} ${startY} C${bend} ${startY},${bend} ${endY},${endX} ${endY}`; labelX = bend; labelY = (startY + endY) / 2 - 5; } return <g key={edge.id}><title>{`${nodeById.get(edge.source)?.label} → ${nodeById.get(edge.target)?.label}${edge.label ? ` · ${edge.label}` : ""}`}</title><path className="arch-edge" markerEnd={`url(#${id}-arrow)`} d={path} />{edge.label && <text className="arch-edge-label" x={labelX} y={labelY}>{short(edge.label, 112, 10)}</text>}</g>; })}
        {spec.nodes.map((node) => { const point = positions.get(node.id)!; const selected = selectedNode === node.id; return <g key={node.id} className={`arch-node-wrap${interactive ? " arch-node-draggable" : ""}${selected ? " is-selected" : ""}`} transform={`translate(${point.x} ${point.y})`} onPointerDown={(event) => beginDrag(event, node)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag} onClick={() => interactive && onSelectNode?.(node.id)} onKeyDown={(event) => { if (!interactive || !onMoveNode) return; const delta = event.shiftKey ? 20 : 5; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelectNode?.(node.id); return; } const vectors: Record<string, ArchPoint> = { ArrowLeft: { x: -delta, y: 0 }, ArrowRight: { x: delta, y: 0 }, ArrowUp: { x: 0, y: -delta }, ArrowDown: { x: 0, y: delta } }; const vector = vectors[event.key]; if (vector) { event.preventDefault(); event.stopPropagation(); onMoveNode(node.id, { x: Math.max(0, Math.min(4000, point.x + vector.x)), y: Math.max(0, Math.min(4000, point.y + vector.y)) }); } }} tabIndex={interactive ? 0 : undefined} role={interactive ? "button" : undefined} aria-label={`${node.label}, ${typeNames[node.type]}`}><rect width={ARCH_NODE_WIDTH} height={ARCH_NODE_HEIGHT} rx="15" fill={nodeColors[node.type]} className="arch-node" /><ArchitectureIcon value={node.icon} /><text className="arch-node-type" x="80" y="29">{typeNames[node.type]}</text><text className="arch-node-label" x="80" y="55">{short(node.label, 136, 11)}</text></g>; })}
      </svg>
    </div>
    {!interactive && <div className="architecture-description"><h3>경계 그룹</h3>{spec.groups.length ? <ul>{spec.groups.map((group) => <li key={group.id}>{groupNames[group.type]} · {group.label}{group.parentId ? ` (내부: ${spec.groups.find((parent) => parent.id === group.parentId)?.label})` : ""}</li>)}</ul> : <p>경계 그룹이 없습니다.</p>}<h3>구성 요소</h3><ul>{spec.nodes.map((node) => <li key={node.id}><strong>{node.label}</strong> — {typeNames[node.type]}{node.groupId ? ` · ${spec.groups.find((group) => group.id === node.groupId)?.label}` : ""}</li>)}</ul><h3>연결</h3>{spec.edges.length ? <ol>{spec.edges.map((edge) => <li key={edge.id}>{nodeById.get(edge.source)?.label} → {nodeById.get(edge.target)?.label}{edge.label ? ` · ${edge.label}` : ""}</li>)}</ol> : <p>표시할 연결이 없습니다.</p>}</div>}
  </section>;
}
