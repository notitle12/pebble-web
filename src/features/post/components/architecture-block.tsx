import { useId } from "react";
import type { ArchitectureSpec } from "../api/post-list";

const nodeColors: Record<string, string> = { CLIENT: "#e9f2ff", APP: "#edf7ef", DATABASE: "#fff1e6", CACHE: "#f5edff", STORAGE: "#e7f7f5", PROXY: "#fff8dc" };
const typeNames: Record<string, string> = { CLIENT: "브라우저", APP: "앱 서버", DATABASE: "데이터베이스", CACHE: "캐시", STORAGE: "스토리지", PROXY: "프록시" };
const groupNames: Record<string, string> = { ORACLE_CLOUD: "Oracle Cloud", AWS: "AWS", CLOUDFLARE: "Cloudflare", DOCKER: "Docker" };
const compact = (value: string, maxWidth = 118, fontSize = 12) => { let result = "", width = 0; for (const char of Array.from(value)) { const charWidth = char.codePointAt(0)! > 0xff ? fontSize : fontSize * 0.58; if (width + charWidth > maxWidth - fontSize) return `${result}…`; result += char; width += charWidth; } return result; };
type Point = { x: number; y: number };

export function ArchitectureBlock({ spec, title }: { spec: ArchitectureSpec; title: string | null }) {
  const id = `architecture-${useId().replace(/:/g, "")}`;
  const cloudGroups = spec.groups.filter(group => group.type !== "DOCKER");
  const rootNodes = spec.nodes.filter(node => !node.groupId);
  const columns: Array<{ group?: typeof cloudGroups[number]; docker?: typeof spec.groups[number]; root?: boolean }> = [
    ...(rootNodes.length || !spec.groups.length ? [{ root: true }] : []),
    ...cloudGroups.map(group => ({ group })),
    ...spec.groups.filter(group => group.type === "DOCKER" && !group.parentId).map(docker => ({ docker })),
  ];
  const xStep = 280, columnWidth = 246, top = 56, rowStep = 94;
  const positions = new Map<string, Point>();
  const shapes: React.ReactNode[] = [];
  let maxHeight = 260;
  const addNode = (nodeId: string, x: number, y: number) => { positions.set(nodeId, { x, y }); };

  columns.forEach((column, columnIndex) => {
    const left = 24 + columnIndex * xStep;
    const centerX = left + columnWidth / 2;
    let y = top + 44;
    if (column.root) {
      const nodes = rootNodes;
      const boxHeight = Math.max(106, 58 + Math.max(1, nodes.length) * rowStep);
      shapes.push(<g key="root-group"><rect className="arch-group arch-group-root" x={left} y={top} width={columnWidth} height={boxHeight} rx="18" /><text className="arch-group-label" x={left + 14} y={top + 24}>외부 구성 요소</text></g>);
      nodes.forEach((node, index) => addNode(node.id, centerX, y + index * rowStep));
      maxHeight = Math.max(maxHeight, top + boxHeight + 36);
      return;
    }
    if (column.docker) {
      const nodes = spec.nodes.filter(node => node.groupId === column.docker!.id);
      const boxHeight = Math.max(112, 64 + Math.max(1, nodes.length) * rowStep);
      shapes.push(<g key={`docker-${column.docker.id}`}><rect className="arch-group arch-group-docker" x={left} y={top} width={columnWidth} height={boxHeight} rx="18" /><text className="arch-group-label" x={left + 14} y={top + 24}>{compact(`Docker · ${column.docker.label}`, 210)}</text><title>{column.docker.label}</title></g>);
      nodes.forEach((node, index) => addNode(node.id, centerX, y + index * rowStep));
      maxHeight = Math.max(maxHeight, top + boxHeight + 36);
      return;
    }
    const group = column.group!;
    const directNodes = spec.nodes.filter(node => node.groupId === group.id);
    const dockerGroups = spec.groups.filter(child => child.parentId === group.id);
    const contentHeight = directNodes.length * rowStep + dockerGroups.reduce((height, docker) => height + Math.max(116, 64 + Math.max(1, spec.nodes.filter(node => node.groupId === docker.id).length) * rowStep) + 14, 0);
    const boxHeight = Math.max(118, 68 + contentHeight);
    shapes.push(<g key={`cloud-${group.id}`}><rect className="arch-group" x={left} y={top} width={columnWidth} height={boxHeight} rx="18" /><text className="arch-group-label" x={left + 14} y={top + 24}>{compact(`${groupNames[group.type]} · ${group.label}`, 210)}</text><title>{`${groupNames[group.type]} · ${group.label}`}</title></g>);
    y = top + 44;
    directNodes.forEach(node => { addNode(node.id, centerX, y); y += rowStep; });
    dockerGroups.forEach(docker => {
      const members = spec.nodes.filter(node => node.groupId === docker.id);
      const dockerHeight = Math.max(116, 64 + Math.max(1, members.length) * rowStep);
      shapes.push(<g key={`docker-${docker.id}`}><rect className="arch-group arch-group-docker" x={left + 14} y={y - 8} width={columnWidth - 28} height={dockerHeight} rx="13" /><text className="arch-group-label" x={left + 24} y={y + 12}>Docker · {compact(docker.label)}</text><title>{docker.label}</title></g>);
      members.forEach((node, index) => addNode(node.id, centerX, y + 36 + index * rowStep));
      y += dockerHeight + 14;
    });
    maxHeight = Math.max(maxHeight, top + boxHeight + 36);
  });
  const width = Math.max(300, columns.length * xStep + 24);
  const height = maxHeight;
  return <section className="architecture-block" aria-label={title ?? "시스템 아키텍처 다이어그램"}>
    <div className="architecture-heading"><h2>{title ?? "시스템 아키텍처"}</h2><p>구성 요소와 데이터 흐름</p></div>
    <div className="architecture-scroll" role="region" tabIndex={0} aria-label="가로 스크롤 가능한 아키텍처 다이어그램">
        <svg className="architecture-svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${id}-title ${id}-desc`}>
        <title id={`${id}-title`}>{title ?? "시스템 아키텍처"}</title><desc id={`${id}-desc`}>{spec.groups.map(group => `${groupNames[group.type]} 경계 ${group.label}`).concat(spec.nodes.map(node => `${node.label} (${typeNames[node.type]})`)).join(". ")}</desc>
        <defs><marker id={`${id}-arrow`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#78869a" /></marker></defs>
        {shapes}
        {spec.edges.map(edge => { const from = positions.get(edge.source)!, to = positions.get(edge.target)!; const vertical = Math.abs(to.y - from.y) > Math.abs(to.x - from.x); const sameColumn = from.x === to.x; const down = to.y > from.y; const sx = vertical ? (sameColumn ? from.x + 72 : from.x) : from.x + (to.x >= from.x ? 72 : -72); const sy = vertical ? (down ? from.y + 48 : from.y) : from.y + 24; const tx = vertical ? (sameColumn ? to.x + 72 : to.x) : to.x + (to.x >= from.x ? -72 : 72); const ty = vertical ? (down ? to.y : to.y + 48) : to.y + 24; const routeX = sameColumn ? sx + 10 : (sx + tx) / 2; const path = sameColumn ? `M${sx} ${sy} C${routeX} ${sy}, ${routeX} ${ty}, ${tx} ${ty}` : `M${sx} ${sy} C${routeX} ${sy}, ${routeX} ${ty}, ${tx} ${ty}`; return <g key={edge.id}><title>{`${spec.nodes.find(node => node.id === edge.source)?.label} → ${spec.nodes.find(node => node.id === edge.target)?.label}${edge.label ? ` · ${edge.label}` : ""}`}</title>
          <path className="arch-edge" markerEnd={`url(#${id}-arrow)`} d={path} />
          {edge.label && <text className="arch-edge-label" x={routeX} y={(sy + ty) / 2 - 6}>{compact(edge.label, 120, 11)}</text>}
        </g>; })}
        {spec.nodes.map(node => { const point = positions.get(node.id)!; return <g key={node.id}><title>{`${node.label} · ${typeNames[node.type]}`}</title>
          <rect x={point.x - 72} y={point.y} width="144" height="48" rx="12" fill={nodeColors[node.type]} className="arch-node" />
          <text className="arch-node-type" x={point.x} y={point.y + 18}>{typeNames[node.type]}</text>
          <text className="arch-node-label" x={point.x} y={point.y + 36}>{compact(node.label)}</text>
        </g>; })}
      </svg>
    </div>
    <div className="architecture-description"><h3>경계 그룹</h3>{spec.groups.length ? <ul>{spec.groups.map(group => <li key={group.id}>{groupNames[group.type]} · {group.label}{group.parentId ? ` (내부: ${spec.groups.find(parent => parent.id === group.parentId)?.label})` : ""}</li>)}</ul> : <p>경계 그룹이 없습니다.</p>}
      <h3>구성 요소</h3><ul>{spec.nodes.map(node => <li key={node.id}><strong>{node.label}</strong> — {typeNames[node.type]}{node.groupId ? ` · ${spec.groups.find(group => group.id === node.groupId)?.label}` : ""}</li>)}</ul>
      <h3>연결</h3>{spec.edges.length ? <ol>{spec.edges.map(edge => <li key={edge.id}>{spec.nodes.find(node => node.id === edge.source)?.label} → {spec.nodes.find(node => node.id === edge.target)?.label}{edge.label ? ` · ${edge.label}` : ""}</li>)}</ol> : <p>표시할 연결이 없습니다.</p>}</div>
  </section>;
}
