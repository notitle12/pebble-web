"use client";
import { useEffect, useRef, useState } from "react";
import { parseArchitectureSpec, type ArchitectureSpec, type ArchitectureSide, type ArchitectureEdge } from "../api/post-list";
import {ARCHITECTURE_ICONS,toolboxIcon,newArchitectureNode,newArchitectureGroup} from "../architecture-tools";
import { normalizeArchitectureGroups, architectureGroupLabel } from "../architecture-groups";
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
const groupTitle: Record<string, string> = { AWS: "AWS 클라우드", ORACLE_CLOUD: "Oracle Cloud", CLOUDFLARE: "Cloudflare", DOCKER: "Docker", CLOUD: "CLOUD", CONTAINER: "CONTAINER", CUSTOM: "GROUP" };
const kindTitle: Record<string, string> = { APP: "앱 서버", CLIENT: "클라이언트", DATABASE: "데이터베이스", CACHE: "캐시", STORAGE: "스토리지", PROXY: "프록시", CUSTOM: "사용자 정의" };
const fresh = (prefix: string, existing: string[]) => { let n = existing.length + 1; while (existing.includes(`${prefix}-${n}`)) n++; return `${prefix}-${n}`; };
const allIds = (spec: ArchitectureSpec) => [...spec.groups.map((item) => item.id), ...spec.nodes.map((item) => item.id), ...spec.edges.map((item) => item.id)];
export function ArchitectureEditor({ onChange, initialValue, embedded = false, onDraftChange }: { onChange?: (value: ArchitectureSpec | null) => void; initialValue?: ArchitectureSpec; embedded?: boolean; onDraftChange?: (value:ArchitectureSpec,valid:boolean)=>void }) {
  const [spec, setSpec] = useState<ArchitectureSpec>(() => normalizeArchitectureGroups(initialValue ?? sample));
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [connectMode, setConnectMode] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [libraryTab,setLibraryTab]=useState<"nodes"|null>(null);
  const [connectionDirection,setConnectionDirection]=useState<NonNullable<ArchitectureEdge["direction"]>>("FORWARD");
  const nodeName=useRef<HTMLInputElement>(null);
  const paletteRef=useRef<HTMLElement>(null);
  useEffect(()=>{
    if(!libraryTab)return;
    paletteRef.current?.querySelector<HTMLButtonElement>(".architecture-library-popup button")?.focus();
    const outside=(event:PointerEvent)=>{if(!paletteRef.current?.contains(event.target as Node) || !(event.target as Element).closest(".architecture-library-triggers,.architecture-library-popup"))setLibraryTab(null);};
    document.addEventListener("pointerdown",outside,true);
    return ()=>document.removeEventListener("pointerdown",outside,true);
  },[libraryTab]);
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
  const addNode = (icon:string) => update((current) => {
    if(current.nodes.length>=30)return current;
    const node=newArchitectureNode(fresh("node",allIds(current)),icon,current.nodes.length);
    setSelectedNode(node.id);setSelectedGroup(null);setSelectedEdge(null);setConnectMode(false);setConnectFrom(null);setConnectSide(null);
    setMessage("아이콘을 추가했습니다. 이름과 역할을 입력해 주세요.");
    return {...current,nodes:[...current.nodes,node]};
  });
  const addGroup = () => update((current) => {
    if(current.groups.length>=10)return current;
    const group=newArchitectureGroup(fresh("group",allIds(current)));
    setSelectedGroup(group.id);setSelectedNode(null);setSelectedEdge(null);setConnectMode(false);setConnectFrom(null);setConnectSide(null);
    setMessage("그룹을 추가했습니다. 이름·역할·아이콘을 지정하고 경계를 드래그해 크기를 조절하세요.");
    return {...current,groups:[...current.groups,group]};
  });
  useEffect(()=>{if(selectedNode||selectedGroup)nodeName.current?.focus({preventScroll:true});},[selectedNode,selectedGroup]);
  const startConnection=(direction:NonNullable<ArchitectureEdge["direction"]>)=>{
    setConnectionDirection(direction);setConnectMode(true);setConnectFrom(null);setConnectSide(null);setSelectedNode(null);setSelectedGroup(null);setSelectedEdge(null);setLibraryTab(null);
    setMessage("시작 요소와 도착 요소 또는 그룹을 차례로 선택하세요. Esc로 취소합니다.");
  };
  const removeNode = (id: string) => update((current) => ({ ...current, nodes: current.nodes.filter((node) => node.id !== id), edges: current.edges.filter((edge) => edge.source !== id && edge.target !== id) }));
  const removeGroup = (id: string) => update((current) => { const removed = new Set([id, ...current.groups.filter((group) => group.parentId === id).map((group) => group.id)]); return { ...current, groups: current.groups.filter((group) => !removed.has(group.id)), edges: current.edges.filter(edge=>!removed.has(edge.source)&&!removed.has(edge.target)), nodes: current.nodes.map((node) => removed.has(node.groupId ?? "") ? { ...node, groupId: null } : node) }; });
  const moveNode = (id: string, position: ArchPoint, finished = false) => update((current) => moveArchitectureNode(current,id,position,finished));
  const moveGroup = (id: string, point: ArchPoint) => update(current => moveArchitectureGroup(current,id,point));
  const resizeGroup = (id: string, size: {width:number;height:number}) => update(current => resizeArchitectureGroup(current,id,size));
  const endpoints = [...spec.nodes, ...spec.groups];
  const selectGroup = (id: string) => { setSelectedGroup(id); setSelectedNode(null); setSelectedEdge(null); };
  const selected = spec.nodes.find((node) => node.id === selectedNode) ?? null;
  const group = spec.groups.find((item) => item.id === selectedGroup) ?? null;
  const edge = spec.edges.find((item) => item.id === selectedEdge) ?? null;
  const connect = (target: string, side?: ArchitectureSide) => {
    if (!connectMode) { if (spec.groups.some(group=>group.id===target)) selectGroup(target); else { setSelectedNode(target); setSelectedGroup(null); setSelectedEdge(null); } return; }
    if (!connectFrom) { setSelectedEdge(null); setSelectedGroup(null); setConnectFrom(target); setConnectSide(side ?? null); setSelectedNode(null); setMessage("도착 카드를 선택하세요."); return; }
    addConnection(connectFrom, connectSide, target, side ?? null);
  };
  const addConnection = (source:string, sourceSide:ArchitectureSide|null, target:string, targetSide:ArchitectureSide|null) => {
    if (source === target) { setMessage("자기 자신에게 연결할 수 없습니다."); return; }
    if (spec.edges.some(edge => edge.source === source && edge.target === target)) { setMessage("같은 방향의 연결이 이미 있습니다."); return; }
    if (spec.edges.length >= 60) { setMessage("연결은 최대 60개까지 추가할 수 있습니다."); return; }
    const id = fresh("edge", allIds(spec));
    update(current => ({...current, edges:[...current.edges,{id,source,target,sourceSide,targetSide,direction:connectionDirection}]}));
    setConnectFrom(null); setConnectSide(null); setConnectMode(false); setSelectedEdge(id); setSelectedNode(null); setSelectedGroup(null); setMessage("연결을 추가했습니다. 다른 연결점에서 끌어 계속 연결할 수 있습니다.");
  };
  const issues: string[] = [];
  if (spec.groups.length > 10) issues.push("그룹은 최대 10개입니다.");
  if (spec.nodes.length < 1 || spec.nodes.length > 30) issues.push("요소는 1~30개까지 추가할 수 있습니다.");
  if (spec.edges.length > 60) issues.push("연결은 최대 60개까지 추가할 수 있습니다.");
  try { parseArchitectureSpec(spec); } catch { if (!issues.length) issues.push("이름, 참조, 아이콘, 좌표를 확인해 주세요."); }
  if (Array.from(JSON.stringify(spec)).length > 50000) issues.push("본문은 50,000자를 넘을 수 없습니다.");
  for (const item of spec.nodes) {
    if (!item.label.trim()) issues.push(`“${item.id}”의 이름을 입력해 주세요.`);
  }
  const invalid = issues.length > 0;
  useEffect(() => { onChange?.(invalid ? null : spec); onDraftChange?.(spec,!invalid); }, [onChange,onDraftChange, invalid, spec]);
  const updateEdge = (id: string, patch: Partial<ArchitectureEdge>) => { const currentEdge = spec.edges.find((item) => item.id === id); if (!currentEdge) return; const candidate = { ...currentEdge, ...patch }; if ( candidate.source === candidate.target || spec.edges.some((item) => item.id !== id && item.source === candidate.source && item.target === candidate.target)) { setMessage("자기 연결 또는 중복 연결은 허용되지 않습니다."); return; } update((current) => ({ ...current, edges: current.edges.map((item) => item.id === id ? { ...item, ...patch } : item) })); };
  const updateNode = (field: string, value: unknown) => update((current) => ({ ...current, nodes: current.nodes.map((node) => node.id === selectedNode ? ({ ...node, [field]: value } as typeof node) : node) }));
  const clearSelection=()=>{setSelectedNode(null);setSelectedGroup(null);setSelectedEdge(null);setConnectMode(false);setConnectFrom(null);setConnectSide(null);setMessage("");};
  const rename=(kind:"node"|"group",id:string,label:string,field:"label"|"typeLabel"="label")=>{
    const name=label.trim(); if((!name && !(kind==="group" && field==="label")) || Array.from(name).length>(field==="typeLabel"?50:100)){setMessage(`이름을 1~${field==="typeLabel"?50:100}자 이내로 입력해 주세요.`);return;}
    update(current=>kind==="node"?{...current,nodes:current.nodes.map(item=>item.id===id?{...item,[field]:name}:item)}:{...current,groups:current.groups.map(item=>item.id===id?{...item,[field]:name}:item)});
  };
  const connectPoint = (target: string, side: ArchitectureSide) => {
    if (connectMode && connectFrom) { connect(target,side); return; }
    setConnectMode(true); setConnectFrom(target); setConnectSide(side); setSelectedNode(null); setSelectedGroup(null); setSelectedEdge(null); setMessage("도착 카드 또는 경계의 연결 포인트를 선택하세요. Esc로 취소합니다.");
  };
  return <div className="architecture-editor-layout" tabIndex={-1} onPointerDownCapture={event=>{if(!(event.target as Element).closest("input,textarea,select,[contenteditable=true]"))event.currentTarget.focus({preventScroll:true});}} onKeyDown={event => {
    const target = event.target as HTMLElement;
    if (target.closest("input,textarea,select,[contenteditable=true]") || event.repeat) return;
    if ((event.ctrlKey || event.metaKey) && ["z","y"].includes(event.key.toLowerCase())) { event.preventDefault();event.stopPropagation(); undo(event.shiftKey || event.key.toLowerCase()==="y"); return; }
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key==="Delete" || event.key==="Backspace") {
      if(selectedEdge || selectedNode || selectedGroup){event.preventDefault();event.stopPropagation();if(selectedEdge)deleteEdge(selectedEdge);else if(selectedNode)removeNode(selectedNode);else if(selectedGroup)removeGroup(selectedGroup);clearSelection();}return;
    }
    const step=event.shiftKey?10:1, vectors:Record<string,ArchPoint>={ArrowLeft:{x:-step,y:0},ArrowRight:{x:step,y:0},ArrowUp:{x:0,y:-step},ArrowDown:{x:0,y:step}};
    const vector=vectors[event.key];
    if(vector && (selectedNode || selectedGroup)){
      const layout=architectureLayout(spec),point=selectedNode?layout.positions.get(selectedNode):layout.groups.get(selectedGroup!);
      if(point){event.preventDefault();event.stopPropagation();beginInteraction();if(selectedNode)moveNode(selectedNode,{x:Math.max(0,Math.min(4000,point.x+vector.x)),y:Math.max(0,Math.min(4000,point.y+vector.y))});else moveGroup(selectedGroup!,{x:Math.max(0,Math.min(4000,point.x+vector.x)),y:Math.max(0,Math.min(4000,point.y+vector.y))});endInteraction();}return;
    }
    if (event.key === "Escape") { event.preventDefault(); setConnectMode(false); setConnectFrom(null); setConnectSide(null); setSelectedEdge(null); setSelectedNode(null); setSelectedGroup(null); setMessage("선택과 연결을 취소했습니다."); }
    if (event.key.toLowerCase() === "c") { event.preventDefault(); setConnectSide(null); setConnectMode(true); setConnectFrom(target.closest("[data-architecture-endpoint]")?.getAttribute("data-architecture-endpoint") ?? selectedNode ?? selectedGroup); setSelectedEdge(null); setMessage("시작·도착 카드 또는 경계를 선택하세요. Esc로 취소합니다."); }
  }}>
    <aside ref={paletteRef} className="architecture-palette architecture-compact-palette" aria-label="요소 추가">
      <div className="architecture-library-toolbar"><div className="architecture-library-triggers" role="toolbar" aria-label="아키텍처 도구함">
        <button type="button" aria-label="아이콘 추가" aria-expanded={libraryTab==="nodes"} onClick={()=>{setLibraryTab(tab=>tab?null:"nodes");setConnectMode(false);setConnectFrom(null);}}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M17.5 14v7M14 17.5h7"/></svg>아이콘</button>
        <button type="button" disabled={spec.groups.length>=10} onClick={()=>{addGroup();setLibraryTab(null);}}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2" strokeDasharray="3 2"/></svg>그룹</button>
        {([['NONE','연결선'],['FORWARD','화살표'],['BOTH','양방향 화살표']] as const).map(([direction,label])=><button key={direction} type="button" aria-pressed={connectMode&&connectionDirection===direction} onClick={()=>startConnection(direction)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h18"/>{direction!=='NONE'&&<path d="m16 7 5 5-5 5"/>}{direction==='BOTH'&&<path d="m8 7-5 5 5 5"/>}</svg>{label}</button>)}
      </div><span className="architecture-tool-hint">아이콘 선택 → 이름 입력 → 연결</span></div>
      {libraryTab&&<div className="architecture-library-popup" role="dialog" aria-label="아이콘 선택" onKeyDown={event=>{if(event.key==="Escape"){event.stopPropagation();setLibraryTab(null);}}}>
        <div className="architecture-icon-heading"><strong>아이콘 선택</strong><button type="button" aria-label="아이콘 목록 닫기" onClick={()=>setLibraryTab(null)}>×</button></div>
        <div className="architecture-icon-grid">{ARCHITECTURE_ICONS.map(icon=><button key={icon.value} type="button" disabled={spec.nodes.length>=30} onClick={()=>{addNode(icon.value);setLibraryTab(null);}}><ArchitectureIcon value={icon.value}/><span>{icon.label}</span></button>)}</div>
      </div>}

    </aside>
    <section className="architecture-canvas-panel architecture-canvas-fit" aria-label="아키텍처 캔버스"><div className="architecture-canvas-toolbar"><div><span className="architecture-eyebrow">캔버스</span><h2>시스템 구성도</h2></div><button className="architecture-auto-layout" type="button" disabled={!past.current.length} onClick={()=>undo()}>되돌리기</button><button className="architecture-auto-layout" type="button" disabled={!future.current.length} onClick={()=>undo(true)}>다시 적용</button><div className="architecture-zoom-controls" aria-label="캔버스 확대 축소"><button className="architecture-auto-layout" type="button" aria-label="축소" disabled={zoom<=.4} onClick={()=>setZoom(value=>Math.max(.4,Math.round((value-.1)*100)/100))}>−</button><button className="architecture-auto-layout" type="button" aria-label="전체 보기" onClick={()=>setZoom(1)}>{Math.round(zoom*100)}%</button><button className="architecture-auto-layout" type="button" aria-label="확대" disabled={zoom>=3} onClick={()=>setZoom(value=>Math.min(3,Math.round((value+.1)*100)/100))}>＋</button></div><button className="architecture-auto-layout" type="button" onClick={() => update((current) => ({ ...current, groups: current.groups.map(({bounds,...group})=>group), nodes: current.nodes.map(({ position, ...node }) => node) }))}>자동 정렬</button><span className="architecture-canvas-help">연결점 드래그로 연결 · Ctrl + 휠 확대/축소</span></div><ArchitectureBlock onRenameNodeType={(id,label)=>rename("node",id,label,"typeLabel")} onRenameGroupType={(id,label)=>rename("group",id,label,"typeLabel")} onClearSelection={clearSelection} onRenameNode={(id,label)=>rename("node",id,label)} onRenameGroup={(id,label)=>rename("group",id,label)} zoom={zoom} onZoomChange={setZoom} onConnectNodes={addConnection} spec={spec} title={null} interactive selectedNode={connectFrom ?? selectedNode} onSelectNode={connect} onMoveNode={moveNode} selectedGroup={selectedGroup} connecting={connectMode} connectionDirection={connectionDirection} onSelectGroup={connect} onConnect={connectPoint} onMoveGroup={moveGroup} onResizeGroup={resizeGroup} selectedEdge={selectedEdge} onSelectEdge={selectEdge} onDeleteEdge={deleteEdge} onResetEdgeWaypoint={id=>updateEdge(id,{waypoint:null})} onMoveEdge={(id,point)=>updateEdge(id,{waypoint:{x:Math.max(0,Math.min(4200,Math.round(point.x))),y:Math.max(0,Math.min(4200,Math.round(point.y)))}})} onReconnectEdge={(id,end,target,side)=>updateEdge(id,end==="source"?{source:target,sourceSide:side,waypoint:null}:{target,targetSide:side,waypoint:null})} onInteractionStart={beginInteraction} onInteractionEnd={endInteraction} /><div className="architecture-canvas-status" role="status">{message || "● 드래그로 연결 · Delete 삭제 · 방향키 이동 · 이름 더블클릭으로 수정"}</div></section>
    <aside className="architecture-inspector" aria-label="속성 편집"><div className="architecture-panel-title"><div><span className="architecture-eyebrow">속성 편집</span><h2>{selected ? "요소 편집" : group ? "그룹 편집" : edge ? "연결 편집" : "속성"}</h2></div><span className="architecture-inspector-icon">⌘</span></div>
      {selected && <><label>요소 이름<input ref={nodeName} value={selected.label} maxLength={100} placeholder="예: 주문 API, 사용자" onChange={(event)=>updateNode("label",event.target.value)}/></label><label>역할 (선택)<input value={selected.type==="CUSTOM"?selected.typeLabel??"":kindTitle[selected.type]} maxLength={50} placeholder="예: 요청 처리, 데이터 보관" onChange={event=>update(current=>({...current,nodes:current.nodes.map(node=>node.id===selected.id?{...node,type:'CUSTOM',typeLabel:event.target.value||null}:node)}))}/></label><label>아이콘<select value={toolboxIcon(selected.icon,selected.type)} onChange={event=>updateNode("icon",event.target.value)}>{ARCHITECTURE_ICONS.map(icon=><option key={icon.value} value={icon.value}>{icon.label}</option>)}</select></label><label>소속 그룹<select value={selected.groupId??""} onChange={event=>updateNode("groupId",event.target.value||null)}><option value="">그룹 없음</option>{spec.groups.map(item=><option key={item.id} value={item.id}>{item.label||architectureGroupLabel(item)}</option>)}</select></label><button className="architecture-delete" type="button" onClick={()=>{removeNode(selected.id);setSelectedNode(null);}}>요소 삭제</button></>}
      {group && <><label>그룹 이름<input ref={nodeName} value={group.label} maxLength={100} placeholder="예: 운영 환경, 결제 영역" onChange={event=>update(current=>({...current,groups:current.groups.map(item=>item.id===group.id?{...item,label:event.target.value}:item)}))}/></label><label>그룹 역할 (선택)<input value={group.type==='CUSTOM'?group.typeLabel??'':groupTitle[group.type]} maxLength={50} placeholder="예: 외부 서비스, 데이터 계층" onChange={event=>update(current=>({...current,groups:current.groups.map(item=>item.id===group.id?{...item,type:'CUSTOM',typeLabel:event.target.value||null,parentId:null}:item)}))}/></label><label>그룹 아이콘<select value={group.icon?toolboxIcon(group.icon):''} onChange={event=>update(current=>({...current,groups:current.groups.map(item=>item.id===group.id?{...item,icon:event.target.value||null}:item)}))}><option value="">아이콘 없음</option>{ARCHITECTURE_ICONS.map(icon=><option key={icon.value} value={icon.value}>{icon.label}</option>)}</select></label><p>요소의 ‘소속 그룹’에서 이 영역을 선택하세요. 그룹을 이동하면 내부 요소도 함께 이동합니다.</p><button className="architecture-delete" type="button" onClick={()=>{removeGroup(group.id);setSelectedGroup(null);}}>그룹 삭제</button></>}
      {edge && <><label>연결 모양<select value={edge.direction??'FORWARD'} onChange={event=>updateEdge(edge.id,{direction:event.target.value as ArchitectureEdge['direction']})}><option value="NONE">연결선</option><option value="FORWARD">화살표</option><option value="BOTH">양방향 화살표</option></select></label><label>연결 설명<input value={edge.label ?? ""} maxLength={200} onChange={(event) => update((current) => ({ ...current, edges: current.edges.map((item) => item.id === edge.id ? { ...item, label: event.target.value || null } : item) }))} /></label><label>시작 요소<select value={edge.source} onChange={(event) => updateEdge(edge.id, { source: event.target.value })}>{endpoints.map((item) => <option key={item.id} value={item.id}>{item.label || architectureGroupLabel(item as ArchitectureSpec["groups"][number])}</option>)}</select></label><label>도착 요소<select value={edge.target} onChange={(event) => updateEdge(edge.id, { target: event.target.value })}>{endpoints.map((item) => <option key={item.id} value={item.id}>{item.label || architectureGroupLabel(item as ArchitectureSpec["groups"][number])}</option>)}</select></label><div className="architecture-coordinate-fields">{(["sourceSide","targetSide"] as const).map(key=><label key={key}>{key==="sourceSide"?"시작 변":"도착 변"}<select value={edge[key]??""} onChange={event=>updateEdge(edge.id,{[key]:event.target.value||null})}><option value="">자동</option><option value="TOP">위쪽</option><option value="RIGHT">오른쪽</option><option value="BOTTOM">아래쪽</option><option value="LEFT">왼쪽</option></select></label>)}</div><button className="architecture-auto-layout" type="button" onClick={()=>updateEdge(edge.id,{source:edge.target,target:edge.source,sourceSide:edge.targetSide,targetSide:edge.sourceSide})}>방향 뒤집기</button><button className="architecture-auto-layout" type="button" onClick={()=>updateEdge(edge.id,{sourceSide:null,targetSide:null,waypoint:null})}>자동 경로로 복원</button><p>가운데 점을 드래그해 경로를 조절하세요. 점을 선택한 뒤 Delete·Backspace를 누르면 자동 경로로 돌아갑니다. 선을 다시 누르면 점이 나타납니다.</p><button className="architecture-delete" type="button" onClick={() => deleteEdge(edge.id)}>연결 삭제</button></>}{!selected && !group && !edge && <p className="architecture-empty-inspector">요소나 그룹을 선택하면 이름, 아이콘, 그룹을 편집할 수 있습니다.</p>}
    </aside>
    {invalid && <div className="architecture-editor-error" role="alert">{issues.join(" ")}</div>}
    {!embedded && <p className="architecture-editor-note">개발용 미리보기입니다. 게시글 편집기 연결과 저장 기능은 아직 제공하지 않습니다.</p>}
  </div>;
}
