"use client";
import { useEffect, useRef, useState } from "react";
import { parseArchitectureSpec, type ArchitectureSpec, type ArchitectureSide, type ArchitectureEdge } from "../api/post-list";
import {ARCHITECTURE_BRAND_ICONS,architectureBrandIcon,searchArchitectureIcons} from "../architecture-brand-icons";
import {ARCHITECTURE_ICONS,toolboxIcon,newArchitectureNode,newArchitectureGroup} from "../architecture-tools";

const TECH_CATEGORIES = [
  { id: 'all', label: '전체' },
  { id: 'backend', label: '백엔드' },
  { id: 'frontend', label: '프론트엔드' },
  { id: 'database', label: '데이터베이스' },
  { id: 'infra', label: '인프라' },
  { id: 'devops', label: 'DevOps' },
  { id: 'language', label: '언어' },
] as const;
import { normalizeArchitectureGroups, architectureGroupLabel, isArchitectureContainer, ARCHITECTURE_GROUP_COLORS } from "../architecture-groups";
import { moveArchitectureNode, moveArchitectureGroup, resizeArchitectureGroup, moveArchitectureSelection, deleteArchitectureSelection } from "../architecture-editing";
import { ArchitectureBlock, ArchitectureIcon, architectureLayout, type ArchPoint, type ArchitectureBlockHandle } from "./architecture-block";

const sample: ArchitectureSpec = { schemaVersion: 1, groups: [
  { id: "cloudflare", type: "CLOUDFLARE", label: "Edge network" }, { id: "oracle", type: "ORACLE_CLOUD", label: "Production" }, { id: "docker", type: "DOCKER", label: "App cluster", parentId: "oracle" },
], nodes: [
  { id: "browser", type: "CLIENT", label: "Web browser", icon: "CLIENT", position: { x: 56, y: 176 } }, { id: "worker", type: "APP", label: "Edge worker", icon: "WORKERS", groupId: "cloudflare", position: { x: 324, y: 84 } },
  { id: "r2", type: "STORAGE", label: "Object storage", icon: "R2", groupId: "cloudflare", position: { x: 324, y: 262 } }, { id: "spring", type: "APP", label: "Spring API", icon: "SPRING", groupId: "docker", position: { x: 638, y: 114 } },
  { id: "postgres", type: "DATABASE", label: "PostgreSQL", icon: "POSTGRESQL", groupId: "docker", position: { x: 638, y: 302 } }, { id: "redis", type: "CACHE", label: "Redis cache", icon: "REDIS", groupId: "docker", position: { x: 868, y: 302 } },
], edges: [ { id: "browser-worker", source: "browser", target: "worker", label: "HTTPS" }, { id: "worker-api", source: "worker", target: "spring", label: "API" },
  { id: "worker-r2", source: "worker", target: "r2", label: "Media" }, { id: "api-db", source: "spring", target: "postgres", label: "SQL" }, { id: "api-cache", source: "spring", target: "redis", label: "캐시" } ] };
const groupTitle: Record<string, string> = { AWS: "AWS 클라우드", ORACLE_CLOUD: "Oracle Cloud", CLOUDFLARE: "Cloudflare", DOCKER: "Docker", CLOUD: "CLOUD", CONTAINER: "CONTAINER", CUSTOM: "GROUP" };
const fresh = (prefix: string, existing: string[]) => { let n = existing.length + 1; while (existing.includes(`${prefix}-${n}`)) n++; return `${prefix}-${n}`; };
const allIds = (spec: ArchitectureSpec) => [...spec.groups.map((item) => item.id), ...spec.nodes.map((item) => item.id), ...spec.edges.map((item) => item.id)];
export function ArchitectureEditor({ onChange, initialValue, embedded = false, onDraftChange }: { onChange?: (value: ArchitectureSpec | null) => void; initialValue?: ArchitectureSpec; embedded?: boolean; onDraftChange?: (value:ArchitectureSpec,valid:boolean)=>void }) {
  const [spec, setSpec] = useState<ArchitectureSpec>(() => normalizeArchitectureGroups(initialValue ?? sample));
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [connectMode, setConnectMode] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [techQuery,setTechQuery]=useState("");
  const [techCategory,setTechCategory]=useState<string>("all");
  const filteredTechIcons=searchArchitectureIcons(ARCHITECTURE_BRAND_ICONS,techQuery,techCategory);
  const [libraryTab,setLibraryTab]=useState<"basic"|"tech"|null>(null);
  const [connectionMenuOpen,setConnectionMenuOpen]=useState(false);
  const [connectionDirection,setConnectionDirection]=useState<NonNullable<ArchitectureEdge["direction"]>>("FORWARD");
  const nodeName=useRef<HTMLInputElement>(null);
  const paletteRef=useRef<HTMLElement>(null);
  const blockRef=useRef<ArchitectureBlockHandle>(null);
  useEffect(()=>{
    if(!libraryTab && !connectionMenuOpen)return;
    if(libraryTab)paletteRef.current?.querySelector<HTMLButtonElement>(".architecture-library-popup button")?.focus();
    const outside=(event:PointerEvent)=>{
      const target = event.target as Element;
      if(!paletteRef.current?.contains(event.target as Node) || !target.closest(".architecture-library-triggers,.architecture-library-popup,.architecture-connection-menu")) {
        setLibraryTab(null);
        setConnectionMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown",outside,true);
    return ()=>document.removeEventListener("pointerdown",outside,true);
  },[libraryTab, connectionMenuOpen]);
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

  const syncSingles = (nodes: Set<string>, groups: Set<string>) => {
    if (nodes.size === 1 && groups.size === 0) {
      setSelectedNode(Array.from(nodes)[0]);
      setSelectedGroup(null);
    } else if (groups.size === 1 && nodes.size === 0) {
      setSelectedGroup(Array.from(groups)[0]);
      setSelectedNode(null);
    } else {
      setSelectedNode(null);
      setSelectedGroup(null);
    }
  };
  const setSingleNode = (id: string | null) => {
    setSelectedNode(id);
    setSelectedGroup(null);
    setSelectedEdge(null);
    setSelectedNodes(id ? new Set([id]) : new Set());
    setSelectedGroups(new Set());
  };
  const setSingleGroup = (id: string | null) => {
    setSelectedGroup(id);
    setSelectedNode(null);
    setSelectedEdge(null);
    setSelectedGroups(id ? new Set([id]) : new Set());
    setSelectedNodes(new Set());
  };
  const selectEdge = (id:string) => {
    setSelectedEdge(id);
    setSelectedNode(null);
    setSelectedGroup(null);
    setSelectedNodes(new Set());
    setSelectedGroups(new Set());
    setConnectMode(false);
    setConnectFrom(null);
    setConnectSide(null);
  };
  const clearSelection=()=>{
    setSelectedNode(null);
    setSelectedGroup(null);
    setSelectedEdge(null);
    setSelectedNodes(new Set());
    setSelectedGroups(new Set());
    setConnectMode(false);
    setConnectFrom(null);
    setConnectSide(null);
    setMessage("");
  };
  const selectNode = (id: string, additive = false) => {
    if (connectMode) { connect(id); return; }
    setSelectedEdge(null);
    if (additive) {
      setSelectedNodes(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        syncSingles(next, selectedGroups);
        return next;
      });
    } else {
      setSingleNode(id);
    }
  };
  const selectGroup = (id: string, additive = false) => {
    if (connectMode) { connect(id); return; }
    setSelectedEdge(null);
    if (additive) {
      setSelectedGroups(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        syncSingles(selectedNodes, next);
        return next;
      });
    } else {
      setSingleGroup(id);
    }
  };
  const selectRange = (nodeIds: string[], groupIds: string[], additive = false) => {
    setSelectedEdge(null);
    setConnectMode(false);
    setConnectFrom(null);
    setConnectSide(null);
    if (additive) {
      const nextNodes = new Set(selectedNodes);
      for (const id of nodeIds) nextNodes.add(id);
      const nextGroups = new Set(selectedGroups);
      for (const id of groupIds) nextGroups.add(id);
      setSelectedNodes(nextNodes);
      setSelectedGroups(nextGroups);
      syncSingles(nextNodes, nextGroups);
    } else {
      const nextNodes = new Set(nodeIds);
      const nextGroups = new Set(groupIds);
      setSelectedNodes(nextNodes);
      setSelectedGroups(nextGroups);
      syncSingles(nextNodes, nextGroups);
    }
    if (nodeIds.length + groupIds.length > 1) {
      setMessage(`${nodeIds.length + groupIds.length}개 항목이 선택되었습니다. (요소 ${nodeIds.length}개, 그룹 ${groupIds.length}개)`);
    }
  };
  const removeSelection = () => {
    const nodeIds = Array.from(selectedNodes);
    const groupIds = Array.from(selectedGroups);
    if (!nodeIds.length && !groupIds.length) return;
    update(current => deleteArchitectureSelection(current, nodeIds, groupIds));
    clearSelection();
    setMessage("선택한 항목을 삭제했습니다. Ctrl/Cmd+Z로 되돌릴 수 있습니다.");
  };
  const moveSelection = (delta: ArchPoint, finished = false) => {
    const baseSpec = gesture.current ?? currentSpec.current;
    const next = moveArchitectureSelection(
      baseSpec,
      Array.from(selectedNodes),
      Array.from(selectedGroups),
      delta,
      finished
    );
    currentSpec.current = next;
    setSpec(next);
  };

  const deleteEdge = (id:string) => { update(current=>({...current,edges:current.edges.filter(e=>e.id!==id)})); setSelectedEdge(null); setMessage("연결을 삭제했습니다. Ctrl/Cmd+Z로 되돌릴 수 있습니다."); };
  const addNode = (icon: string, label?: string) => update((current) => {
    if (current.nodes.length >= 30) return current;
    const brand = architectureBrandIcon(icon);
    const nodeLabel = label !== undefined ? label : (brand ? brand.label : "");
    const node = newArchitectureNode(fresh("node", allIds(current)), icon, current.nodes.length, nodeLabel);
    setSingleNode(node.id);
    setMessage(brand ? `“${brand.label}” 기술 카드를 추가했습니다.` : "기본 아이콘을 추가했습니다. 아래에 표시할 이름을 입력해 주세요.");
    return { ...current, nodes: [...current.nodes, node] };
  });
  const addGroup = () => update((current) => {
    if(current.groups.length>=10)return current;
    const group=newArchitectureGroup(fresh("group",allIds(current)));
    setSingleGroup(group.id);
    setMessage("그룹을 추가했습니다. 이름·역할·아이콘을 지정하고 경계를 드래그해 크기를 조절하세요.");
    return {...current,groups:[...current.groups,group]};
  });
  const startConnection=(direction:NonNullable<ArchitectureEdge["direction"]>)=>{
    setConnectionDirection(direction);setConnectMode(true);setConnectFrom(null);setConnectSide(null);setSelectedNode(null);setSelectedGroup(null);setSelectedEdge(null);setSelectedNodes(new Set());setSelectedGroups(new Set());setLibraryTab(null);
    setMessage("시작 요소와 도착 요소 또는 그룹을 차례로 선택하세요. Esc로 취소합니다.");
  };
  const removeNode = (id: string) => update((current) => ({ ...current, nodes: current.nodes.filter((node) => node.id !== id), edges: current.edges.filter((edge) => edge.source !== id && edge.target !== id) }));
  const removeGroup = (id: string) => update(current => deleteArchitectureSelection(current, [], [id]));
  const moveNode = (id: string, position: ArchPoint, finished = false) => update((current) => moveArchitectureNode(current,id,position,finished));
  const moveGroup = (id: string, point: ArchPoint, finished = false) => update(current => moveArchitectureGroup(current,id,point,finished));
  const resizeGroup = (id: string, size: {width:number;height:number}) => update(current => resizeArchitectureGroup(current,id,size));
  const endpoints = [...spec.nodes, ...spec.groups];
  const selected = spec.nodes.find((node) => node.id === selectedNode) ?? null;
  const group = spec.groups.find((item) => item.id === selectedGroup) ?? null;
  const edge = spec.edges.find((item) => item.id === selectedEdge) ?? null;
  const isMulti = (selectedNodes.size + selectedGroups.size) > 1;
  const hasSelection = Boolean(isMulti || selected || group || edge);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const lastSelectedKey = useRef<string | null>(null);
  const currentSelectedKey = isMulti
    ? `multi:${selectedNodes.size}:${selectedGroups.size}`
    : selectedNode
      ? `node:${selectedNode}`
      : selectedGroup
        ? `group:${selectedGroup}`
        : selectedEdge
          ? `edge:${selectedEdge}`
          : null;

  useEffect(() => {
    if (currentSelectedKey && currentSelectedKey !== lastSelectedKey.current) {
      setInspectorOpen(true);
    }
    lastSelectedKey.current = currentSelectedKey;
  }, [currentSelectedKey]);
  const connect = (target: string, side?: ArchitectureSide) => {
    if (!connectMode) { if (spec.groups.some(group=>group.id===target)) selectGroup(target); else selectNode(target); return; }
    if (!connectFrom) { setSelectedEdge(null); setSelectedGroup(null); setSelectedNodes(new Set()); setSelectedGroups(new Set()); setConnectFrom(target); setConnectSide(side ?? null); setSelectedNode(null); setMessage("도착 카드를 선택하세요."); return; }
    addConnection(connectFrom, connectSide, target, side ?? null);
  };
  const addConnection = (source:string, sourceSide:ArchitectureSide|null, target:string, targetSide:ArchitectureSide|null) => {
    if (source === target) { setMessage("자기 자신에게 연결할 수 없습니다."); return; }
    if (spec.edges.some(edge => edge.source === source && edge.target === target)) { setMessage("같은 방향의 연결이 이미 있습니다."); return; }
    if (spec.edges.length >= 60) { setMessage("연결은 최대 60개까지 추가할 수 있습니다."); return; }
    const id = fresh("edge", allIds(spec));
    update(current => ({...current, edges:[...current.edges,{id,source,target,sourceSide,targetSide,direction:connectionDirection}]}));
    setConnectFrom(null); setConnectSide(null); setConnectMode(false); setSelectedEdge(id); setSelectedNode(null); setSelectedGroup(null); setSelectedNodes(new Set()); setSelectedGroups(new Set()); setMessage("연결을 추가했습니다. 다른 연결점에서 끌어 계속 연결할 수 있습니다.");
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
  const rename=(kind:"node"|"group",id:string,label:string,field:"label"|"typeLabel"="label")=>{
    const name=label.trim(); if((!name && !(kind==="group" && field==="label")) || Array.from(name).length>(field==="typeLabel"?50:100)){setMessage(`이름을 1~${field==="typeLabel"?50:100}자 이내로 입력해 주세요.`);return;}
    update(current=>kind==="node"?{...current,nodes:current.nodes.map(item=>item.id===id?{...item,[field]:name}:item)}:{...current,groups:current.groups.map(item=>item.id===id?{...item,[field]:name}:item)});
  };
  const connectPoint = (target: string, side: ArchitectureSide) => {
    if (connectMode && connectFrom) { connect(target,side); return; }
    setConnectMode(true); setConnectFrom(target); setConnectSide(side); setSelectedNode(null); setSelectedGroup(null); setSelectedNodes(new Set()); setSelectedGroups(new Set()); setSelectedEdge(null); setMessage("도착 카드 또는 경계의 연결 포인트를 선택하세요. Esc로 취소합니다.");
  };
  return <div className="architecture-editor-layout" tabIndex={-1} onPointerDownCapture={event=>{if(!(event.target as Element).closest("input,textarea,select,[contenteditable=true]"))event.currentTarget.focus({preventScroll:true});}} onKeyDown={event => {
    const target = event.target as HTMLElement;
    if (target.closest("input,textarea,select,[contenteditable=true]") || event.repeat) return;
    if ((event.key === " " || event.code === "Space") && !target.closest("button,a,[role=radio],[role=menuitem]")) {
      event.preventDefault();
      event.stopPropagation();
      blockRef.current?.fitToView();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && ["z","y"].includes(event.key.toLowerCase())) { event.preventDefault();event.stopPropagation(); undo(event.shiftKey || event.key.toLowerCase()==="y"); return; }
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key==="Delete" || event.key==="Backspace") {
      if(selectedEdge || selectedNodes.size > 0 || selectedGroups.size > 0 || selectedNode || selectedGroup){
        event.preventDefault();event.stopPropagation();
        if(selectedEdge)deleteEdge(selectedEdge);
        else if(selectedNodes.size + selectedGroups.size > 1)removeSelection();
        else if(selectedNode || selectedNodes.size === 1)removeNode(selectedNode ?? Array.from(selectedNodes)[0]);
        else if(selectedGroup || selectedGroups.size === 1)removeGroup(selectedGroup ?? Array.from(selectedGroups)[0]);
        clearSelection();
      }
      return;
    }
    const step=event.shiftKey?10:1, vectors:Record<string,ArchPoint>={ArrowLeft:{x:-step,y:0},ArrowRight:{x:step,y:0},ArrowUp:{x:0,y:-step},ArrowDown:{x:0,y:step}};
    const vector=vectors[event.key];
    if(vector && (selectedNodes.size > 0 || selectedGroups.size > 0 || selectedNode || selectedGroup)){
      event.preventDefault();event.stopPropagation();beginInteraction();
      if(selectedNodes.size + selectedGroups.size > 1){
        update(current=>moveArchitectureSelection(current,Array.from(selectedNodes),Array.from(selectedGroups),vector,true));
      } else {
        const targetNode = selectedNode ?? (selectedNodes.size === 1 ? Array.from(selectedNodes)[0] : null);
        const targetGroup = selectedGroup ?? (selectedGroups.size === 1 ? Array.from(selectedGroups)[0] : null);
        const layout=architectureLayout(spec),point=targetNode?layout.positions.get(targetNode):targetGroup?layout.groups.get(targetGroup):null;
        if(point){
          if(targetNode)moveNode(targetNode,{x:Math.max(0,Math.min(4000,point.x+vector.x)),y:Math.max(0,Math.min(4000,point.y+vector.y))},true);
          else if(targetGroup)moveGroup(targetGroup,{x:Math.max(0,Math.min(4000,point.x+vector.x)),y:Math.max(0,Math.min(4000,point.y+vector.y))},true);
        }
      }
      endInteraction();
      return;
    }
    if (event.key === "Escape") { event.preventDefault(); setConnectMode(false); setConnectFrom(null); setConnectSide(null); setSelectedEdge(null); setSelectedNode(null); setSelectedGroup(null); setSelectedNodes(new Set()); setSelectedGroups(new Set()); setConnectionMenuOpen(false); setMessage("선택과 연결을 취소했습니다."); }
    if (event.key.toLowerCase() === "c") { event.preventDefault(); setConnectSide(null); setConnectMode(true); setConnectFrom(target.closest("[data-architecture-endpoint]")?.getAttribute("data-architecture-endpoint") ?? selectedNode ?? selectedGroup ?? Array.from(selectedNodes)[0] ?? Array.from(selectedGroups)[0] ?? null); setSelectedEdge(null); setMessage("시작·도착 카드 또는 경계를 선택하세요. Esc로 취소합니다."); }
  }}>
    <aside ref={paletteRef} className="architecture-palette architecture-compact-palette" aria-label="요소 추가">
      <div className="architecture-library-toolbar"><div className="architecture-library-triggers" role="toolbar" aria-label="아키텍처 도구함">
        <button type="button" aria-label="기본 아이콘 추가" aria-expanded={libraryTab==="basic"} onClick={()=>{setLibraryTab(tab=>tab==="basic"?null:"basic");setConnectionMenuOpen(false);setConnectMode(false);setConnectFrom(null);}}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M17.5 14v7M14 17.5h7"/></svg>기본 아이콘</button>
        <button type="button" aria-label="기술 스택 추가" aria-expanded={libraryTab==="tech"} onClick={()=>{setLibraryTab(tab=>tab==="tech"?null:"tech");setConnectionMenuOpen(false);setConnectMode(false);setConnectFrom(null);}}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/></svg>기술</button>
        <button type="button" disabled={spec.groups.length>=10} onClick={()=>{addGroup();setLibraryTab(null);setConnectionMenuOpen(false);}}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2" strokeDasharray="3 2"/></svg>그룹</button>
        <div className="architecture-connection-dropdown">
          <button type="button" aria-label="연결선 선택" aria-haspopup="menu" aria-expanded={connectionMenuOpen} aria-pressed={connectMode} onClick={()=>{setConnectionMenuOpen(v=>!v);setLibraryTab(null);}}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 12h18"/>
              {connectionDirection!=='NONE'&&<path d="m16 7 5 5-5 5"/>}
              {connectionDirection==='BOTH'&&<path d="m8 7-5 5 5 5"/>}
            </svg>
            연결선
            <span className="architecture-dropdown-caret" aria-hidden="true">▾</span>
          </button>
          {connectionMenuOpen && (
            <div className="architecture-connection-menu" role="menu" aria-label="연결선 종류">
              {([['NONE','연결선'],['FORWARD','화살표'],['BOTH','양방향 화살표']] as const).map(([direction,label])=>(
                <button
                  key={direction}
                  type="button"
                  role="menuitem"
                  className={connectMode && connectionDirection===direction ? "is-active" : undefined}
                  onClick={()=>{
                    startConnection(direction);
                    setConnectionMenuOpen(false);
                  }}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 12h18"/>
                    {direction!=='NONE'&&<path d="m16 7 5 5-5 5"/>}
                    {direction==='BOTH'&&<path d="m8 7-5 5 5 5"/>}
                  </svg>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div><span className="architecture-tool-hint">아이콘 선택 → 이름 입력 → 연결</span></div>
      {libraryTab==="basic"&&<div className="architecture-library-popup" role="dialog" aria-label="기본 아이콘 선택" onKeyDown={event=>{if(event.key==="Escape"){event.stopPropagation();setLibraryTab(null);}}}>
        <div className="architecture-icon-heading"><strong>기본 아이콘 선택</strong><button type="button" aria-label="기본 아이콘 목록 닫기" onClick={()=>setLibraryTab(null)}>×</button></div>
        <p className="architecture-popup-desc">이름을 직접 지정할 수 있는 기본 구성 요소입니다.</p>
        <div className="architecture-icon-grid">{ARCHITECTURE_ICONS.map(icon=><button key={icon.value} type="button" disabled={spec.nodes.length>=30} onClick={()=>{addNode(icon.value,"");setLibraryTab(null);}}><ArchitectureIcon value={icon.value} standalone/><span>{icon.label}</span></button>)}</div>
      </div>}
      {libraryTab==="tech"&&<div className="architecture-library-popup" role="dialog" aria-label="기술 스택 선택" onKeyDown={event=>{if(event.key==="Escape"){event.stopPropagation();setLibraryTab(null);}}}>
        <div className="architecture-icon-heading"><strong>기술 스택 선택</strong><button type="button" aria-label="기술 스택 목록 닫기" onClick={()=>setLibraryTab(null)}>×</button></div>
        <p className="architecture-popup-desc">상업적 이용·재배포 라이선스를 확인한 기술 로고입니다.</p>
        <input className="architecture-icon-search" aria-label="기술 스택 검색" placeholder="기술 검색 (예: Git, Rust)" value={techQuery} onChange={event=>setTechQuery(event.target.value)}/>
        <div className="architecture-icon-categories" aria-label="기술 분류">{TECH_CATEGORIES.map(category=><button key={category.id} type="button" aria-pressed={techCategory===category.id} onClick={()=>setTechCategory(category.id)}>{category.label}</button>)}</div>
        <div className="architecture-tech-icon-grid">{filteredTechIcons.map(icon=><button key={icon.value} type="button" disabled={spec.nodes.length>=30} title={icon.label} onClick={()=>{addNode(icon.value,icon.label);setLibraryTab(null);}}><ArchitectureIcon value={icon.value} standalone/><span>{icon.label}</span></button>)}</div>{!filteredTechIcons.length&&<p className="muted" style={{margin:"16px 0",textAlign:"center"}}>검색 결과가 없습니다.</p>}
        <p className="architecture-icon-notice">해당 기술을 나타내는 용도로 사용해 주세요. <a href="/technology-icons/NOTICE.txt" target="_blank" rel="noreferrer">출처·라이선스 고지</a></p>
      </div>}

    </aside>
    <div className={`architecture-workspace${hasSelection && inspectorOpen ? " has-sidebar" : ""}`}>
      <section className="architecture-canvas-panel architecture-canvas-fit" aria-label="아키텍처 캔버스">
        <div className="architecture-canvas-toolbar">
          <span className="architecture-canvas-title">시스템 구성도</span>
          <span className="architecture-canvas-hint">영역 드래그 다중 선택 · 연결점 드래그 연결 · Ctrl+휠 확대/축소</span>
          <div className="architecture-canvas-actions">
            <button className="architecture-auto-layout" type="button" disabled={!past.current.length} onClick={()=>undo()} title="되돌리기">되돌리기</button>
            <button className="architecture-auto-layout" type="button" disabled={!future.current.length} onClick={()=>undo(true)} title="다시 적용">다시 적용</button>
            <div className="architecture-zoom-controls" aria-label="캔버스 확대 축소">
              <button className="architecture-auto-layout" type="button" aria-label="축소" disabled={zoom<=.4} onClick={()=>setZoom(value=>Math.max(.4,Math.round((value-.1)*100)/100))}>−</button>
              <button className="architecture-auto-layout" type="button" aria-label="100% 원래 크기" onClick={()=>setZoom(1)} title="100% 기본 크기">{Math.round(zoom*100)}%</button>
              <button className="architecture-auto-layout" type="button" aria-label="확대" disabled={zoom>=3} onClick={()=>setZoom(value=>Math.min(3,Math.round((value+.1)*100)/100))}>＋</button>
            </div>
            <button className="architecture-auto-layout" type="button" onClick={()=>blockRef.current?blockRef.current.fitToView():setZoom(1)} title="현재 창 크기에 맞추기">화면 맞춤</button>
            <button className="architecture-auto-layout" type="button" onClick={() => update((current) => ({ ...current, groups: current.groups.map(({bounds,...group})=>group), nodes: current.nodes.map(({ position, ...node }) => node) }))} title="자동 정렬">자동 정렬</button>
            {hasSelection && (
              <button
                className={`architecture-auto-layout architecture-inspector-toggle${inspectorOpen ? " is-active" : ""}`}
                type="button"
                onClick={() => setInspectorOpen(v => !v)}
                title={inspectorOpen ? "속성 패널 접기" : "속성 패널 열기"}
              >
                속성 {inspectorOpen ? "접기" : "열기"}
              </button>
            )}
          </div>
        </div>
        <ArchitectureBlock ref={blockRef} onRenameGroupType={(id,label)=>rename("group",id,label,"typeLabel")} onClearSelection={clearSelection} onRenameNode={(id,label)=>rename("node",id,label)} onRenameGroup={(id,label)=>rename("group",id,label)} onRenameEdge={(id,label)=>updateEdge(id,{label:label.trim()||null})} zoom={zoom} onZoomChange={setZoom} onConnectNodes={addConnection} spec={spec} title={null} interactive selectedNode={connectFrom ?? selectedNode} onSelectNode={selectNode} onMoveNode={moveNode} selectedGroup={selectedGroup} selectedNodes={selectedNodes} selectedGroups={selectedGroups} onSelectRange={selectRange} onMoveSelection={moveSelection} connecting={connectMode} connectionDirection={connectionDirection} onSelectGroup={selectGroup} onConnect={connectPoint} onMoveGroup={moveGroup} onResizeGroup={resizeGroup} selectedEdge={selectedEdge} onSelectEdge={selectEdge} onDeleteEdge={deleteEdge} onDeleteNode={id=>{removeNode(id);setSingleNode(null);}} onDeleteGroup={id=>{removeGroup(id);setSingleGroup(null);}} onResetEdgeWaypoint={id=>updateEdge(id,{waypoint:null})} onMoveEdge={(id,point)=>updateEdge(id,{waypoint:{x:Math.max(0,Math.min(4200,Math.round(point.x))),y:Math.max(0,Math.min(4200,Math.round(point.y)))}})} onReconnectEdge={(id,end,target,side)=>updateEdge(id,end==="source"?{source:target,sourceSide:side,waypoint:null}:{target,targetSide:side,waypoint:null})} onInteractionStart={beginInteraction} onInteractionEnd={endInteraction} />
        <div className="architecture-canvas-status" role="status">{message || "● 캔버스 드래그 다중 선택 · 방향키 일괄 이동 · Delete 삭제"}</div>
      </section>

      {hasSelection && inspectorOpen && (
        <aside className="architecture-inspector architecture-inspector-sidebar" aria-label="속성 편집">
          <div className="architecture-panel-title">
            <div>
              <span className="architecture-eyebrow">속성 편집</span>
              <h2>{isMulti ? "다중 선택" : selected ? "요소 편집" : group ? "그룹 편집" : edge ? "연결 편집" : "속성"}</h2>
            </div>
            <button
              type="button"
              className="architecture-inspector-close"
              aria-label="속성 패널 닫기"
              title="속성 패널 닫기"
              onClick={() => setInspectorOpen(false)}
            >
              ×
            </button>
          </div>
          {isMulti && (
            <div className="architecture-multi-inspector">
              <p className="architecture-multi-summary">
                <strong>{selectedNodes.size + selectedGroups.size}개</strong> 항목이 선택되었습니다.
                <br />
                <span className="text-muted">
                  (요소 {selectedNodes.size}개, 그룹 {selectedGroups.size}개)
                </span>
              </p>
              <p className="architecture-multi-hint">
                선택한 항목들을 드래그하거나 방향키로 한 번에 이동할 수 있습니다.
              </p>
              <button className="architecture-delete" type="button" onClick={removeSelection}>
                선택 항목 삭제 ({selectedNodes.size + selectedGroups.size})
              </button>
            </div>
          )}
          {!isMulti && selected && (
            <>
              <label>요소 이름
                <input ref={nodeName} value={selected.label} maxLength={100} placeholder="예: 주문 API, 사용자" onChange={(event)=>updateNode("label",event.target.value)}/>
              </label>
              <label>아이콘
                <select value={toolboxIcon(selected.icon,selected.type)} onChange={event=>updateNode("icon",event.target.value)}>
                  <optgroup label="기본 아이콘">{ARCHITECTURE_ICONS.map(icon=><option key={icon.value} value={icon.value}>{icon.label}</option>)}</optgroup>
                  <optgroup label="기술 스택">{ARCHITECTURE_BRAND_ICONS.map(icon=><option key={icon.value} value={icon.value}>{icon.label}</option>)}</optgroup>
                </select>
              </label>
              <label>소속 그룹
                <select value={selected.groupId??""} onChange={event=>updateNode("groupId",event.target.value||null)}>
                  <option value="">그룹 없음</option>
                  {spec.groups.map(item=><option key={item.id} value={item.id}>{item.label||architectureGroupLabel(item)}</option>)}
                </select>
              </label>
              <button className="architecture-delete" type="button" onClick={()=>{removeNode(selected.id);setSingleNode(null);}}>요소 삭제</button>
            </>
          )}
          {!isMulti && group && (
            <>
              <label>그룹 이름
                <input ref={nodeName} value={group.label} maxLength={100} placeholder="예: 운영 환경, 결제 영역" onChange={event=>update(current=>({...current,groups:current.groups.map(item=>item.id===group.id?{...item,label:event.target.value}:item)}))}/>
              </label>
              <label>그룹 역할 (선택)
                <input value={group.type==='CUSTOM'?group.typeLabel??'':groupTitle[group.type]} maxLength={50} placeholder="예: 외부 서비스, 데이터 계층" onChange={event=>update(current=>({...current,groups:current.groups.map(item=>item.id===group.id?{...item,type:'CUSTOM',typeLabel:event.target.value||null}:item)}))}/>
              </label>
              <label>그룹 색상
                <div className="architecture-color-swatches" role="radiogroup" aria-label="그룹 색상 선택">
                  {ARCHITECTURE_GROUP_COLORS.map(c=>{
                    const activeColor=group.color||(isArchitectureContainer(group.type)?"GREEN":group.type==="CUSTOM"?"PURPLE":"BLUE");
                    const isCurrent=activeColor===c.id;
                    return <button key={c.id} type="button" role="radio" aria-checked={isCurrent} aria-label={c.label} title={c.label} className={`architecture-color-swatch arch-swatch-${c.id}${isCurrent?" is-selected":""}`} style={{backgroundColor:c.hex,borderColor:c.border}} onClick={()=>update(current=>({...current,groups:current.groups.map(item=>item.id===group.id?{...item,color:c.id}:item)}))}>{isCurrent&&<span className="architecture-swatch-check" style={{color:c.dot}}>✓</span>}</button>;
                  })}
                </div>
              </label>
              <label>그룹 아이콘
                <select value={group.icon?toolboxIcon(group.icon):''} onChange={event=>update(current=>({...current,groups:current.groups.map(item=>item.id===group.id?{...item,icon:event.target.value||null}:item)}))}>
                  <option value="">아이콘 없음</option>
                  <optgroup label="기본 아이콘">{ARCHITECTURE_ICONS.map(icon=><option key={icon.value} value={icon.value}>{icon.label}</option>)}</optgroup>
                  <optgroup label="기술 스택">{ARCHITECTURE_BRAND_ICONS.map(icon=><option key={icon.value} value={icon.value}>{icon.label}</option>)}</optgroup>
                </select>
              </label>
              <p className="architecture-inspector-hint">요소의 ‘소속 그룹’에서 이 영역을 선택하세요. 그룹을 이동하면 내부 요소도 함께 이동합니다.</p>
              <button className="architecture-delete" type="button" onClick={()=>{removeGroup(group.id);setSingleGroup(null);}}>그룹 삭제</button>
            </>
          )}
          {!isMulti && edge && (
            <>
              <label>연결 모양
                <select value={edge.direction??'FORWARD'} onChange={event=>updateEdge(edge.id,{direction:event.target.value as ArchitectureEdge['direction']})}>
                  <option value="NONE">연결선</option>
                  <option value="FORWARD">화살표</option>
                  <option value="BOTH">양방향 화살표</option>
                </select>
              </label>
              <label>연결 설명
                <input value={edge.label ?? ""} maxLength={200} placeholder="예: API, SQL, 캐시" onChange={(event) => update((current) => ({ ...current, edges: current.edges.map((item) => item.id === edge.id ? { ...item, label: event.target.value || null } : item) }))} />
              </label>
              <label>시작 요소
                <select value={edge.source} onChange={(event) => updateEdge(edge.id, { source: event.target.value })}>
                  {endpoints.map((item) => <option key={item.id} value={item.id}>{item.label || architectureGroupLabel(item as ArchitectureSpec["groups"][number])}</option>)}
                </select>
              </label>
              <label>도착 요소
                <select value={edge.target} onChange={(event) => updateEdge(edge.id, { target: event.target.value })}>
                  {endpoints.map((item) => <option key={item.id} value={item.id}>{item.label || architectureGroupLabel(item as ArchitectureSpec["groups"][number])}</option>)}
                </select>
              </label>
              <div className="architecture-coordinate-fields">
                {(["sourceSide","targetSide"] as const).map(key=><label key={key}>{key==="sourceSide"?"시작 변":"도착 변"}<select value={edge[key]??""} onChange={event=>updateEdge(edge.id,{[key]:event.target.value||null})}><option value="">자동</option><option value="TOP">위쪽</option><option value="RIGHT">오른쪽</option><option value="BOTTOM">아래쪽</option><option value="LEFT">왼쪽</option></select></label>)}
              </div>
              <div className="architecture-edge-actions">
                <button className="architecture-auto-layout" type="button" onClick={()=>updateEdge(edge.id,{source:edge.target,target:edge.source,sourceSide:edge.targetSide,targetSide:edge.sourceSide})}>방향 뒤집기</button>
                <button className="architecture-auto-layout" type="button" onClick={()=>updateEdge(edge.id,{sourceSide:null,targetSide:null,waypoint:null})}>자동 경로로 복원</button>
              </div>
              <p className="architecture-inspector-hint">가운데 점을 드래그해 경로를 조절하세요. 점을 선택한 뒤 Delete·Backspace를 누르면 자동 경로로 돌아갑니다.</p>
              <button className="architecture-delete" type="button" onClick={() => deleteEdge(edge.id)}>연결 삭제</button>
            </>
          )}
        </aside>
      )}
    </div>
    {invalid && <div className="architecture-editor-error" role="alert">{issues.join(" ")}</div>}
    {!embedded && <p className="architecture-editor-note">개발용 미리보기입니다. 게시글 편집기 연결과 저장 기능은 아직 제공하지 않습니다.</p>}
  </div>;
}
