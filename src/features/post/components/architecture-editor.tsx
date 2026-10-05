"use client";
import { useEffect, useRef, useState } from "react";
import { parseArchitectureSpec, type ArchitectureSpec, type ArchitectureSide, type ArchitectureEdge } from "../api/post-list";
import { moveArchitectureNode, moveArchitectureGroup, resizeArchitectureGroup } from "../architecture-editing";
import { ArchitectureBlock, ArchitectureIcon, architectureLayout, type ArchPoint } from "./architecture-block";

const sample: ArchitectureSpec = { schemaVersion: 1, groups: [
  { id: "cloudflare", type: "CLOUDFLARE", label: "Edge network" }, { id: "oracle", type: "ORACLE_CLOUD", label: "Production" }, { id: "docker", type: "DOCKER", label: "App cluster", parentId: "oracle" },
], nodes: [
  { id: "browser", type: "CLIENT", label: "Web browser", icon: "CLIENT", position: { x: 56, y: 176 } }, { id: "worker", type: "APP", label: "Edge worker", icon: "WORKERS", groupId: "cloudflare", position: { x: 324, y: 84 } },
  { id: "r2", type: "STORAGE", label: "Object storage", icon: "R2", groupId: "cloudflare", position: { x: 324, y: 262 } }, { id: "spring", type: "APP", label: "Spring API", icon: "SPRING", groupId: "docker", position: { x: 638, y: 114 } },
  { id: "postgres", type: "DATABASE", label: "PostgreSQL", icon: "POSTGRESQL", groupId: "docker", position: { x: 638, y: 302 } }, { id: "redis", type: "CACHE", label: "Redis cache", icon: "REDIS", groupId: "docker", position: { x: 868, y: 302 } },
], edges: [ { id: "browser-worker", source: "browser", target: "worker", label: "HTTPS" }, { id: "worker-api", source: "worker", target: "spring", label: "API" },
  { id: "worker-r2", source: "worker", target: "r2", label: "Media" }, { id: "api-db", source: "spring", target: "postgres", label: "SQL" }, { id: "api-cache", source: "spring", target: "redis", label: "캐시" } ] };
const groupTypes = ["AWS", "ORACLE_CLOUD", "CLOUDFLARE", "DOCKER", "CUSTOM"] as const;
const nodeTypes = ["APP", "CLIENT", "DATABASE", "CACHE", "STORAGE", "PROXY", "CUSTOM"] as const;
const technologies = ["SPRING", "POSTGRESQL", "REDIS", "DOCKER", "ORACLE_CLOUD", "AWS", "CLOUDFLARE", "WORKERS", "R2", "REACT", "NODEJS", "NGINX"] as const;
const titles: Record<string, string> = { SPRING: "Spring", POSTGRESQL: "PostgreSQL", REDIS: "Redis", DOCKER: "Docker", ORACLE_CLOUD: "Oracle Cloud", AWS: "AWS", CLOUDFLARE: "Cloudflare", WORKERS: "Workers", R2: "R2", REACT: "React", NODEJS: "Node.js", NGINX: "NGINX" };
const groupTitle: Record<string, string> = { AWS: "AWS 클라우드", ORACLE_CLOUD: "Oracle Cloud", CLOUDFLARE: "Cloudflare", DOCKER: "Docker", CUSTOM: "사용자 정의 경계" };
const kindTitle: Record<string, string> = { APP: "앱 서버", CLIENT: "클라이언트", DATABASE: "데이터베이스", CACHE: "캐시", STORAGE: "스토리지", PROXY: "프록시", CUSTOM: "사용자 정의" };
const fresh = (prefix: string, existing: string[]) => { let n = existing.length + 1; while (existing.includes(`${prefix}-${n}`)) n++; return `${prefix}-${n}`; };
const allIds = (spec: ArchitectureSpec) => [...spec.groups.map((item) => item.id), ...spec.nodes.map((item) => item.id), ...spec.edges.map((item) => item.id)];
export function ArchitectureEditor({ onChange, initialValue }: { onChange?: (value: ArchitectureSpec | null) => void; initialValue?: ArchitectureSpec }) {
  const [spec, setSpec] = useState<ArchitectureSpec>(() => initialValue ?? sample);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [connectMode, setConnectMode] = useState(false);
  const [fitCanvas, setFitCanvas] = useState(true);
  const [connectSide, setConnectSide] = useState<ArchitectureSide | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const currentSpec = useRef(spec);
  const past = useRef<ArchitectureSpec[]>([]), future = useRef<ArchitectureSpec[]>([]);
  const gesture = useRef<ArchitectureSpec | null>(null);
  const [, refreshHistory] = useState(0);
  const remember = (value: ArchitectureSpec) => { past.current = [...past.current.slice(-39),value]; future.current = []; };
  const update = (fn: (current: ArchitectureSpec) => ArchitectureSpec) => {
    const before = currentSpec.current, next = fn(before);
    if (JSON.stringify(before) === JSON.stringify(next)) return;
    if (!gesture.current) remember(before);
    currentSpec.current = next; setSpec(next);
  };
  const beginInteraction = () => { if (!gesture.current) gesture.current = currentSpec.current; };
  const endInteraction = () => {
    if (gesture.current && JSON.stringify(gesture.current) !== JSON.stringify(currentSpec.current)) remember(gesture.current);
    gesture.current = null; refreshHistory(n=>n+1);
  };
  const undo = (redo = false) => {
    const source = redo ? future : past, destination = redo ? past : future;
    const next = source.current.pop(); if (!next) return;
    destination.current.push(currentSpec.current); currentSpec.current = next; gesture.current=null; setSpec(next);
    setConnectMode(false); setConnectFrom(null); setConnectSide(null); setMessage(redo ? "다시 적용했습니다." : "이전 상태로 되돌렸습니다.");
  };
  const selectEdge = (id:string) => { setSelectedEdge(id); setSelectedNode(null); setSelectedGroup(null); setConnectMode(false); setConnectFrom(null); setConnectSide(null); };
  const deleteEdge = (id:string) => { update(current=>({...current,edges:current.edges.filter(e=>e.id!==id)})); setSelectedEdge(null); setMessage("연결을 삭제했습니다. Ctrl/Cmd+Z로 되돌릴 수 있습니다."); };
  const addNode = (technology?: string) => update((current) => {
    if (current.nodes.length >= 30) return current;
    const id = fresh("node", allIds(current)); const index = current.nodes.length;
    const node = { id, type: technology === "CLIENT" ? "CLIENT" : technology === "DATABASE" || technology === "POSTGRESQL" ? "DATABASE" : technology === "CACHE" || technology === "REDIS" ? "CACHE" : technology === "STORAGE" || technology === "R2" ? "STORAGE" : technology === "NGINX" ? "PROXY" : technology ? "APP" : "CUSTOM", label: technology ? titles[technology] ?? technology : "직접 만든 요소", icon: technology ?? "SERVER", position: { x: 52 + (index % 4) * 222, y: 58 + Math.floor(index / 4) * 150 } } as ArchitectureSpec["nodes"][number];
    setSelectedNode(id); setSelectedGroup(null); setSelectedEdge(null); setMessage(`${node.label} 요소를 추가했습니다. 드래그해 배치하세요.`); return { ...current, nodes: [...current.nodes, node] };
  });
  const addGroup = (type: typeof groupTypes[number]) => update((current) => { if (current.groups.length >= 10) return current; const id = fresh("group", allIds(current)); const group = { id, type, label: groupTitle[type], ...(type === "DOCKER" ? { parentId: null } : {}) } as ArchitectureSpec["groups"][number]; setSelectedGroup(id); setSelectedNode(null); setSelectedEdge(null); setMessage(`${groupTitle[type]} 그룹을 추가했습니다.`); return { ...current, groups: [...current.groups, group] }; });
  const removeNode = (id: string) => update((current) => ({ ...current, nodes: current.nodes.filter((node) => node.id !== id), edges: current.edges.filter((edge) => edge.source !== id && edge.target !== id) }));
  const removeGroup = (id: string) => update((current) => { const removed = new Set([id, ...current.groups.filter((group) => group.parentId === id).map((group) => group.id)]); return { ...current, groups: current.groups.filter((group) => !removed.has(group.id)), edges: current.edges.filter(edge=>!removed.has(edge.source)&&!removed.has(edge.target)), nodes: current.nodes.map((node) => removed.has(node.groupId ?? "") ? { ...node, groupId: null } : node) }; });
  const moveNode = (id: string, position: ArchPoint, finished = false) => update((current) => moveArchitectureNode(current,id,position,finished));
  const moveGroup = (id: string, point: ArchPoint) => update(current => moveArchitectureGroup(current,id,point));
  const resizeGroup = (id: string, size: {width:number;height:number}) => update(current => resizeArchitectureGroup(current,id,size));
  const endpoints = [...spec.nodes, ...spec.groups];
  const selectGroup = (id: string) => { setSelectedGroup(id); setSelectedNode(null); setSelectedEdge(null); };
  const selected = spec.nodes.find((node) => node.id === selectedNode) ?? null;
  const selectedPosition = selected ? architectureLayout(spec).positions.get(selected.id) : null;
  const group = spec.groups.find((item) => item.id === selectedGroup) ?? null;
  const edge = spec.edges.find((item) => item.id === selectedEdge) ?? null;
  const connect = (target: string, side?: ArchitectureSide) => {
    if (!connectMode) { if (spec.groups.some(group=>group.id===target)) selectGroup(target); else { setSelectedNode(target); setSelectedGroup(null); setSelectedEdge(null); } return; }
    if (!connectFrom) { setSelectedEdge(null); setSelectedGroup(null); setConnectFrom(target); setConnectSide(side ?? null); setSelectedNode(null); setMessage("도착 카드를 선택하세요."); return; }
    if (connectFrom === target) { setMessage("자기 자신에게 연결할 수 없습니다."); return; }
    if (spec.edges.some((edge) => edge.source === connectFrom && edge.target === target)) { setMessage("같은 방향의 연결이 이미 있습니다."); return; }
    if (spec.edges.length >= 60) { setMessage("연결은 최대 60개까지 추가할 수 있습니다."); return; }
    const id = fresh("edge", allIds(spec)); update((current) => ({ ...current, edges: [...current.edges, { id, source: connectFrom, target, sourceSide: connectSide, targetSide: side ?? null }] })); setConnectFrom(null); setConnectMode(false); setSelectedEdge(id); setSelectedNode(null); setSelectedGroup(null); setMessage("연결을 추가했습니다.");
  };
  const issues: string[] = [];
  if (spec.groups.length > 10) issues.push("그룹은 최대 10개입니다.");
  if (spec.nodes.length < 1 || spec.nodes.length > 30) issues.push("요소는 1~30개까지 추가할 수 있습니다.");
  if (spec.edges.length > 60) issues.push("연결은 최대 60개까지 추가할 수 있습니다.");
  try { parseArchitectureSpec(spec); } catch { if (!issues.length) issues.push("이름, 참조, 아이콘, 좌표를 확인해 주세요."); }
  if (Array.from(JSON.stringify(spec)).length > 50000) issues.push("본문은 50,000자를 넘을 수 없습니다.");
  for (const item of [...spec.nodes, ...spec.groups]) {
    if (!item.label.trim()) issues.push(`“${item.id}”의 이름을 입력해 주세요.`);
  }
  const invalid = issues.length > 0;
  useEffect(() => { onChange?.(invalid ? null : spec); }, [onChange, invalid, spec]);
  const updateEdge = (id: string, patch: Partial<ArchitectureEdge>) => { const currentEdge = spec.edges.find((item) => item.id === id); if (!currentEdge) return; const candidate = { ...currentEdge, ...patch }; if ( candidate.source === candidate.target || spec.edges.some((item) => item.id !== id && item.source === candidate.source && item.target === candidate.target)) { setMessage("자기 연결 또는 중복 연결은 허용되지 않습니다."); return; } update((current) => ({ ...current, edges: current.edges.map((item) => item.id === id ? { ...item, ...patch } : item) })); };
  const updateNode = (field: string, value: unknown) => update((current) => ({ ...current, nodes: current.nodes.map((node) => node.id === selectedNode ? ({ ...node, [field]: value } as typeof node) : node) }));
  const connectPoint = (target: string, side: ArchitectureSide) => {
    if (connectMode && connectFrom) { connect(target,side); return; }
    setConnectMode(true); setConnectFrom(target); setConnectSide(side); setSelectedNode(null); setSelectedGroup(null); setSelectedEdge(null); setMessage("도착 카드 또는 경계의 연결 포인트를 선택하세요. Esc로 취소합니다.");
  };
  return <div className="architecture-editor-layout" onKeyDown={event => {
    const target = event.target as HTMLElement;
    if (target.closest("input,textarea,select,[contenteditable=true]") || event.repeat) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase()==="z") { event.preventDefault(); undo(event.shiftKey); return; }
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if ((event.key==="Delete" || event.key==="Backspace") && selectedEdge) { event.preventDefault(); deleteEdge(selectedEdge); return; }
    if (event.key === "Escape") { event.preventDefault(); setConnectMode(false); setConnectFrom(null); setConnectSide(null); setSelectedEdge(null); setSelectedNode(null); setSelectedGroup(null); setMessage("선택과 연결을 취소했습니다."); }
    if (event.key.toLowerCase() === "c") { event.preventDefault(); setConnectSide(null); setConnectMode(true); setConnectFrom(target.closest("[data-architecture-endpoint]")?.getAttribute("data-architecture-endpoint") ?? selectedNode ?? selectedGroup); setSelectedEdge(null); setMessage("시작·도착 카드 또는 경계를 선택하세요. Esc로 취소합니다."); }
  }}>
    <aside className="architecture-palette" aria-label="기술 카드"><div className="architecture-panel-title"><div><span className="architecture-eyebrow">시스템 구성</span><h2>기술 카드</h2></div><span className="architecture-count">{spec.nodes.length}/30</span></div><p>기술 카드를 선택해 캔버스에 추가하세요.</p><div className="architecture-tech-grid">{technologies.map((technology) => <button key={technology} type="button" disabled={spec.nodes.length >= 30} onClick={() => addNode(technology)}><span className={`architecture-tech-mark tech-${technology.toLowerCase()}`}><ArchitectureIcon value={technology} /></span><span>{titles[technology]}</span><span aria-hidden="true">＋</span></button>)}</div><button className="architecture-custom-add" type="button" disabled={spec.nodes.length >= 30} onClick={() => addNode()}>＋ 사용자 정의 카드</button>
      <div className="architecture-palette-section"><div className="architecture-panel-title"><div><span className="architecture-eyebrow">경계 설정</span><h2>그룹</h2></div><span className="architecture-count">{spec.groups.length}/10</span></div><div className="architecture-group-buttons">{groupTypes.map((type) => <button key={type} type="button" disabled={spec.groups.length >= 10} onClick={() => addGroup(type)}>{type === "CUSTOM" ? "＋ 직접 설정" : `＋ ${groupTitle[type]}`}</button>)}</div><div className="architecture-group-list">{spec.groups.map((item) => <button key={item.id} type="button" className={selectedGroup === item.id ? "active" : ""} onClick={() => { setSelectedGroup(item.id); setSelectedNode(null); setSelectedEdge(null); }}><span className={`group-dot group-${item.type.toLowerCase()}`} />{item.label}</button>)}</div></div>
      <div className="architecture-palette-section"><div className="architecture-panel-title"><div><span className="architecture-eyebrow">방향 흐름</span><h2>연결</h2></div><span className="architecture-count">{spec.edges.length}/60</span></div><button className={`architecture-connect-button${connectMode ? " active" : ""}`} type="button" disabled={endpoints.length < 2 || spec.edges.length >= 60} onClick={() => { setConnectMode((active) => !active); setConnectFrom(null); setMessage("시작 카드를 선택한 다음 도착 카드를 선택하세요."); }}>↗ {connectMode ? "연결 취소" : "카드 연결"}</button><details className="architecture-edge-disclosure"><summary>연결 목록 보기</summary><ol className="architecture-edge-list">{spec.edges.map((edge) => <li key={edge.id}><button type="button" className="architecture-edge-select" onClick={() => selectEdge(edge.id)}>{endpoints.find((node) => node.id === edge.source)?.label} <b>→</b> {endpoints.find((node) => node.id === edge.target)?.label}</button><button type="button" aria-label={`연결 삭제 ${edge.id}`} onClick={() => deleteEdge(edge.id)}>×</button></li>)}</ol></details></div>
    </aside>
    <section className={`architecture-canvas-panel${fitCanvas ? " architecture-canvas-fit" : ""}`} aria-label="아키텍처 캔버스"><div className="architecture-canvas-toolbar"><div><span className="architecture-eyebrow">캔버스</span><h2>시스템 구성도</h2></div><button className="architecture-auto-layout" type="button" disabled={!past.current.length} onClick={()=>undo()}>되돌리기</button><button className="architecture-auto-layout" type="button" disabled={!future.current.length} onClick={()=>undo(true)}>다시 적용</button><button className="architecture-auto-layout" type="button" onClick={() => setFitCanvas((value) => !value)}>{fitCanvas ? "원래 크기" : "전체 보기"}</button><button className="architecture-auto-layout" type="button" onClick={() => update((current) => ({ ...current, groups: current.groups.map(({bounds,...group})=>group), nodes: current.nodes.map(({ position, ...node }) => node) }))}>자동 정렬</button><span className="architecture-canvas-help">선 클릭 → 경로·끝점 드래그 · Delete 삭제 · Ctrl/Cmd+Z 되돌리기</span></div><ArchitectureBlock spec={spec} title={null} interactive selectedNode={connectFrom ?? selectedNode} onSelectNode={connect} onMoveNode={moveNode} selectedGroup={selectedGroup} connecting={connectMode} onSelectGroup={connect} onConnect={connectPoint} onMoveGroup={moveGroup} onResizeGroup={resizeGroup} selectedEdge={selectedEdge} onSelectEdge={selectEdge} onDeleteEdge={deleteEdge} onMoveEdge={(id,point)=>updateEdge(id,{waypoint:{x:Math.max(0,Math.min(4200,Math.round(point.x))),y:Math.max(0,Math.min(4200,Math.round(point.y)))}})} onReconnectEdge={(id,end,target,side)=>updateEdge(id,end==="source"?{source:target,sourceSide:side,waypoint:null}:{target,targetSide:side,waypoint:null})} onInteractionStart={beginInteraction} onInteractionEnd={endInteraction} /><div className="architecture-canvas-status" role="status">{message || "선을 클릭해 경로와 끝점을 조절하세요. 카드·경계의 ●로 연결합니다."}</div></section>
    <aside className="architecture-inspector" aria-label="속성 편집"><div className="architecture-panel-title"><div><span className="architecture-eyebrow">속성 편집</span><h2>{selected ? "요소 편집" : group ? "그룹 편집" : edge ? "연결 편집" : "속성"}</h2></div><span className="architecture-inspector-icon">⌘</span></div>
      {selected && <><label>요소 이름<input value={selected.label} maxLength={100} onChange={(event) => updateNode("label", event.target.value)} /></label><label>종류<select value={selected.type} onChange={(event) => updateNode("type", event.target.value)}>{nodeTypes.map((type) => <option key={type} value={type}>{kindTitle[type]}</option>)}</select></label><label>기술 아이콘<select value={selected.icon ?? "SERVER"} onChange={(event) => updateNode("icon", event.target.value)}><option value="SERVER">서버</option>{technologies.map((technology) => <option key={technology} value={technology}>{titles[technology]}</option>)}{["DATABASE", "CACHE", "STORAGE", "CLIENT", "CLOUD", "CONTAINER"].map((item) => <option key={item} value={item}>{item[0] + item.slice(1).toLowerCase()}</option>)}</select></label><label>그룹<select value={selected.groupId ?? ""} onChange={(event) => updateNode("groupId", event.target.value || null)}><option value="">그룹 없음</option>{spec.groups.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><div className="architecture-coordinate-fields"><label>X 좌표<input type="number" min={0} max={4000} value={selected.position?.x ?? selectedPosition?.x ?? 0} onChange={(event) => updateNode("position", { x: Math.max(0, Math.min(4000, Math.round(Number(event.target.value) || 0))), y: selected.position?.y ?? selectedPosition?.y ?? 72 } )} /></label><label>Y 좌표<input type="number" min={0} max={4000} value={selected.position?.y ?? selectedPosition?.y ?? 0} onChange={(event) => updateNode("position", { x: selected.position?.x ?? selectedPosition?.x ?? 48, y: Math.max(0, Math.min(4000, Math.round(Number(event.target.value) || 0))) } )} /></label></div><button className="architecture-delete" type="button" disabled={spec.nodes.length <= 1} onClick={() => { removeNode(selected.id); setSelectedNode(null); setSelectedEdge(null); }}>요소 삭제</button></>}
      {group && <><label>그룹 이름<input value={group.label} maxLength={100} onChange={(event) => update((current) => ({ ...current, groups: current.groups.map((item) => item.id === group.id ? { ...item, label: event.target.value } : item) }))} /></label><label>그룹 종류<select value={group.type} onChange={(event) => update((current) => ({ ...current, groups: current.groups.map((item) => item.id === group.id ? { ...item, type: event.target.value as typeof item.type, ...(event.target.value === "DOCKER" ? { parentId: item.parentId ?? null } : { parentId: null }) } : item).map((item) => item.parentId === group.id && event.target.value === "DOCKER" ? { ...item, parentId: null } : item) }))}>{groupTypes.map((type) => <option key={type} value={type}>{groupTitle[type]}</option>)}</select></label>{group.type === "DOCKER" && <label>상위 그룹<select value={group.parentId ?? ""} onChange={(event) => update((current) => ({ ...current, groups: current.groups.map((item) => item.id === group.id ? { ...item, parentId: event.target.value || null } : item) }))}><option value="">최상위</option>{spec.groups.filter((item) => item.id !== group.id && item.type !== "DOCKER" && !item.parentId).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>}<button className="architecture-delete" type="button" onClick={() => { removeGroup(group.id); setSelectedGroup(null); }}>그룹 삭제</button></>}
      {edge && <><label>연결 설명<input value={edge.label ?? ""} maxLength={200} onChange={(event) => update((current) => ({ ...current, edges: current.edges.map((item) => item.id === edge.id ? { ...item, label: event.target.value || null } : item) }))} /></label><label>시작 요소<select value={edge.source} onChange={(event) => updateEdge(edge.id, { source: event.target.value })}>{endpoints.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label>도착 요소<select value={edge.target} onChange={(event) => updateEdge(edge.id, { target: event.target.value })}>{endpoints.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><div className="architecture-coordinate-fields">{(["sourceSide","targetSide"] as const).map(key=><label key={key}>{key==="sourceSide"?"시작 변":"도착 변"}<select value={edge[key]??""} onChange={event=>updateEdge(edge.id,{[key]:event.target.value||null})}><option value="">자동</option><option value="TOP">위쪽</option><option value="RIGHT">오른쪽</option><option value="BOTTOM">아래쪽</option><option value="LEFT">왼쪽</option></select></label>)}</div><button className="architecture-auto-layout" type="button" onClick={()=>updateEdge(edge.id,{source:edge.target,target:edge.source,sourceSide:edge.targetSide,targetSide:edge.sourceSide})}>방향 뒤집기</button><button className="architecture-auto-layout" type="button" onClick={()=>updateEdge(edge.id,{sourceSide:null,targetSide:null,waypoint:null})}>자동 경로로 복원</button><p>가운데 점을 드래그하면 경로를 바꿀 수 있습니다. 시작·도착점을 다른 변으로 끌어 연결을 옮기세요.</p><button className="architecture-delete" type="button" onClick={() => deleteEdge(edge.id)}>연결 삭제</button></>}{!selected && !group && !edge && <p className="architecture-empty-inspector">요소나 그룹을 선택하면 이름, 아이콘, 그룹, 좌표를 편집할 수 있습니다.</p>}
    </aside>
    {invalid && <div className="architecture-editor-error" role="alert">{issues.join(" ")}</div>}
    <p className="architecture-editor-note">개발용 미리보기입니다. 게시글 편집기 연결과 저장 기능은 아직 제공하지 않습니다.</p>
  </div>;
}
