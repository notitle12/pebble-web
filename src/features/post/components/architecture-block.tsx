"use client";
import { useSpacePan } from "./use-space-pan";
import {useDiagramFit} from "./use-diagram-fit";
import {DiagramLightbox} from "./diagram-lightbox";
import { useCallback, useEffect, forwardRef, useId, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import type { ArchitectureEdge, ArchitectureNode, ArchitectureGroup, ArchitectureSide, ArchitectureSpec } from "../api/post-list";
import { isArchitectureContainer, architectureGroupPresentation, architectureGroupLabel, isDescendant } from "../architecture-groups";
import { isNodeInMarquee, isGroupInMarquee } from "../architecture-editing";
import {architectureBrandIcon} from "../architecture-brand-icons";
import {connectionMarkers} from "../architecture-tools";
import { architectureIconKind } from "../architecture-catalog";
import { diagramZoomScroll } from "../diagram-viewport";
import { architectureZoom, nearestArchitectureSide } from "../architecture-interaction";
import { architectureEdgeRoute } from "../architecture-edge";
import { architectureLayout, ARCH_NODE_WIDTH, ARCH_NODE_HEIGHT, architectureNodeWidth, measureTextWidth, getArchitectureContentBounds, type ArchPoint } from "../architecture-layout";
export { architectureLayout, getArchitectureContentBounds, type ArchPoint } from "../architecture-layout";

const groupKind=(group:ArchitectureGroup)=>architectureGroupPresentation(group).category;
const groupDetail=(group:ArchitectureGroup)=>architectureGroupPresentation(group).detail;
const short = (text: string, maxWidth = 138, fontSize = 11) => { let result = "", width = 0; for (const char of Array.from(text)) { const size = char.codePointAt(0)! > 255 ? fontSize : fontSize * .58; if (width + size > maxWidth) return `${result}…`; result += char; width += size; } return result; };
export function ArchitectureIcon({ value, type, standalone = false }: { value?: string | null; type?:string; standalone?:boolean }) {
  const brand=architectureBrandIcon(value);
  if(brand)return <svg className="arch-tech-icon arch-brand-icon" data-brand-icon={brand.value} viewBox="0 0 26 26" x={standalone?0:10} y={standalone?0:15} width={26} height={26} aria-hidden="true">{(brand.value==='RUST'||brand.value==='FLASK')&&<rect width={26} height={26} rx={13} fill="white"/>}<image href={brand.asset} x={1} y={1} width={24} height={24} preserveAspectRatio="xMidYMid meet"/></svg>;
  const kind=architectureIconKind(value,type);
  const shapes={
    PERSON:<><circle cx="13" cy="8" r="4"/><path d="M20 22v-1.5a4.5 4.5 0 0 0-4.5-4.5h-5A4.5 4.5 0 0 0 6 20.5V22"/></>,
    SERVER:<><rect x="4" y="3" width="18" height="20" rx="3"/><path d="M4 10h18M4 17h18M8 6.5h.1M8 13.5h.1M8 20h.1M13 6.5h5M13 13.5h5M13 20h5"/></>,
    DATABASE:<><ellipse cx="13" cy="5" rx="9" ry="3"/><path d="M4 5v15c0 4 18 4 18 0V5M4 12c0 4 18 4 18 0"/></>,
    CACHE:<><rect x="4" y="4" width="18" height="18" rx="3"/><path d="m14 7-6 7h5l-1 5 6-7h-5z"/></>,
    STORAGE:<><rect x="3" y="7" width="20" height="14" rx="3"/><path d="m3 11 4-7h12l4 7M3 15h20M17 18h.1M20 18h.1"/></>,
    CLIENT:<><rect x="2" y="3" width="22" height="16" rx="2"/><path d="M9 24h8M13 19v5M2 7h22"/></>,
    CLOUD:<path d="M7 21h12a5 5 0 0 0 1-10 7 7 0 0 0-13-2 6 6 0 0 0 0 12Z"/>,
    CONTAINER:<><path d="m13 2 10 6v11l-10 6-10-6V8zM3 8l10 6 10-6M13 14v11M8 5l10 6"/></>,
    PROXY:<><path d="M3 8h20l-5-5M23 18H3l5 5M23 8l-5 5M3 18l5-5"/></>,
    CUSTOM:<><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="15" y="3" width="8" height="8" rx="2"/><rect x="3" y="15" width="8" height="8" rx="2"/><rect x="15" y="15" width="8" height="8" rx="2"/></>
  };
  return <svg className="arch-tech-icon" data-icon-kind={kind} viewBox="0 0 26 26" x={standalone?0:10} y={standalone?0:15} width={26} height={26} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{shapes[kind]}</svg>;
}

function ArchitectureObject({value,type,width=ARCH_NODE_WIDTH}:{value?:string|null;type:string;width?:number}){
 const iconTranslateX = width / 2 - 18;
 return <><rect className="arch-object-hit" width={width} height={ARCH_NODE_HEIGHT} rx={10} fill="transparent"/><g className="arch-object-symbol" transform={`translate(${iconTranslateX} 7) scale(1.38)`}><ArchitectureIcon value={value} type={type} standalone/></g></>;
}

type PointerDrag = { id: string; pointerId: number; start: { x: number; y: number }; point: ArchPoint; scaleX: number; scaleY: number; moved: boolean; selectionChanged?:boolean; isMulti?: boolean };
type ResizeDrag = { id: string; pointerId: number; start: { x: number; y: number }; size: { width: number; height: number }; scaleX: number; scaleY: number };
type EdgeDrag = { id: string; pointerId: number; start: { x: number; y: number }; point: ArchPoint; scaleX: number; scaleY: number; end?: "source" | "target" };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const sideNames: Record<ArchitectureSide, string> = { TOP: "위쪽", RIGHT: "오른쪽", BOTTOM: "아래쪽", LEFT: "왼쪽" };
const sides: ArchitectureSide[] = ["TOP", "RIGHT", "BOTTOM", "LEFT"];

export type ArchitectureBlockHandle = {
  fitToView: () => void;
};

export type ArchitectureBlockProps = {
  spec: ArchitectureSpec; title: string | null; expanded?: boolean; interactive?: boolean; selectedNode?: string | null; selectedGroup?: string | null; selectedEdge?: string | null;
  selectedNodes?: string[] | Set<string>; selectedGroups?: string[] | Set<string>;
  connecting?: boolean; connectionDirection?: ArchitectureEdge["direction"];
  onSelectNode?: (id: string, additive?: boolean) => void; onSelectGroup?: (id: string, additive?: boolean) => void; onSelectEdge?: (id: string) => void;
  onSelectRange?: (nodeIds: string[], groupIds: string[], additive?: boolean) => void;
  onConnect?: (id: string, side: ArchitectureSide) => void;
  onClearSelection?:()=>void;
  onRenameNode?:(id:string,label:string)=>void; onRenameGroup?:(id:string,label:string)=>void;
  onRenameGroupType?:(id:string,label:string)=>void; onRenameEdge?:(id:string,label:string)=>void;
  zoom?:number; onZoomChange?:(zoom:number)=>void;
  onConnectNodes?:(source:string,sourceSide:ArchitectureSide|null,target:string,targetSide:ArchitectureSide|null)=>void;
  onMoveNode?: (id: string, point: ArchPoint, finished?: boolean) => void; onMoveGroup?: (id: string, point: ArchPoint, finished?: boolean) => void;
  onMoveSelection?: (delta: ArchPoint, finished?: boolean) => void;
  onResizeGroup?: (id: string, size: { width: number; height: number }) => void;
  onMoveEdge?: (id: string, point: ArchPoint) => void; onReconnectEdge?: (id: string, end: "source" | "target", endpointId: string, side: ArchitectureSide) => void;
  onDeleteEdge?: (id: string) => void; onDeleteNode?: (id: string) => void; onDeleteGroup?: (id: string) => void; onResetEdgeWaypoint?: (id:string)=>void; onInteractionStart?: () => void; onInteractionEnd?: () => void;
};

function ArchitectureBlockInner({ spec, title, expanded = false, interactive = false, selectedNode, selectedGroup, selectedEdge, selectedNodes, selectedGroups, connecting = false, connectionDirection, onSelectNode, onSelectGroup, onSelectEdge, onSelectRange, onConnect, onMoveNode, onMoveGroup, onMoveSelection, onResizeGroup, onMoveEdge, onReconnectEdge, onDeleteEdge, onDeleteNode, onDeleteGroup, onResetEdgeWaypoint, onInteractionStart, onInteractionEnd, zoom, onZoomChange, onConnectNodes, onClearSelection, onRenameNode, onRenameGroup, onRenameGroupType, onRenameEdge }: ArchitectureBlockProps, ref?: React.ForwardedRef<ArchitectureBlockHandle>) {
  const id = `architecture-${useId().replace(/:/g, "")}`;
  const { positions, groups, width, height } = architectureLayout(spec);
  const [editingName,setEditingName]=useState<{kind:"node"|"group"|"groupType"|"edge";id:string;label:string}|null>(null);
  const [viewerOpen,setViewerOpen]=useState(false);
  const [collapsed,setCollapsed]=useState(false);
  const [hiddenWaypoint,setHiddenWaypoint]=useState<string|null>(null);
  const nameInput=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(editingName){nameInput.current?.focus({preventScroll:true});nameInput.current?.select();}},[editingName?.id,editingName?.kind]);
  function nameEditor(x:number,y:number,kind:"node"|"group"|"groupType"|"edge",endpointId:string,customWidth?:number) {
    if(!editingName || editingName.id!==endpointId || editingName.kind!==kind) return null;
    const finish=()=>{
      if (kind === "edge") onRenameEdge?.(endpointId, editingName.label);
      else if(kind==="group" || editingName.label.trim())(kind==="node"?onRenameNode:kind==="group"?onRenameGroup:onRenameGroupType)?.(endpointId,editingName.label);
      setEditingName(null);
    };
    const width = customWidth ?? (kind === "edge" ? 120 : kind === "node" ? ARCH_NODE_WIDTH + 12 : 200);
    return <foreignObject x={x} y={y} width={width} height={34} className="arch-name-editor" data-kind={kind} onPointerDown={event=>event.stopPropagation()} onClick={event=>event.stopPropagation()} onDoubleClick={event=>event.stopPropagation()}>
      <input ref={nameInput} aria-label={kind==="edge"?"연결 설명 수정":kind==="node"?"카드 이름 수정":kind==="group"?"그룹 이름 수정":"그룹 종류 표시 수정"} value={editingName.label} maxLength={kind==="edge"?200:kind==="groupType"?50:100} placeholder={kind==="edge"?"설명 입력 (예: SQL)":undefined} onChange={event=>setEditingName({...editingName,label:event.target.value})} onBlur={finish} onKeyDown={event=>{event.stopPropagation();if(event.key==="Enter"){event.preventDefault();finish();}else if(event.key==="Escape"){event.preventDefault();setEditingName(null);}}}/>
    </foreignObject>;
  }
  const [hoveredEndpoint,setHoveredEndpoint]=useState<string|null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const spacePan = useSpacePan(scrollRef, !!interactive);
  const fit = useDiagramFit(scrollRef, width, height, expanded, !interactive, expanded);
  const [internalZoom, setInternalZoom] = useState<number | null>(null);
  const activeZoom = zoom ?? internalZoom;
  const handleZoomChange = useCallback((next: number | null) => {
    if (next === null) {
      setInternalZoom(null);
      return;
    }
    if (onZoomChange) {
      onZoomChange(next);
    } else {
      setInternalZoom(next);
    }
  }, [onZoomChange]);
  const viewScale = activeZoom !== null ? activeZoom : (interactive ? 1 : fit);
  const canvasPadding = !interactive && (activeZoom !== null || expanded) ? 48 : 0;
  const zoomAnchor = useRef<{ x: number; y: number; ratio: number; left: number; top: number; padding: number; nextPadding: number } | null>(null);
  const panState = useRef<{
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
    active: boolean;
  } | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  const handleZoomStep = useCallback((step: number) => {
    const viewport = scrollRef.current;
    const current = viewScale;
    const next = clamp(Math.round((current + step) * 100) / 100, 0.4, 3.0);
    if (next === current) return;
    if (viewport) {
      const rect = viewport.getBoundingClientRect();
      zoomAnchor.current = {
        x: rect.width / 2,
        y: rect.height / 2,
        ratio: next / current,
        left: viewport.scrollLeft,
        top: viewport.scrollTop,
        padding: canvasPadding,
        nextPadding: interactive ? 0 : 48,
      };
    }
    handleZoomChange(next);
  }, [viewScale, handleZoomChange, canvasPadding, interactive]);

  const handleResetZoom = useCallback(() => {
    const viewport = scrollRef.current;
    if (viewport && viewScale !== 1) {
      const rect = viewport.getBoundingClientRect();
      zoomAnchor.current = {
        x: rect.width / 2,
        y: rect.height / 2,
        ratio: 1 / viewScale,
        left: viewport.scrollLeft,
        top: viewport.scrollTop,
        padding: canvasPadding,
        nextPadding: interactive ? 0 : 48,
      };
    }
    handleZoomChange(1);
  }, [viewScale, handleZoomChange, canvasPadding, interactive]);

  const fitToView = useCallback(() => {
    const viewport = scrollRef.current;
    if (!viewport) return;
    const { clientWidth, clientHeight } = viewport;
    if (clientWidth <= 0 || clientHeight <= 0) return;

    const bounds = getArchitectureContentBounds(spec, { positions, groups });
    const padding = interactive ? 0 : 48;
    const availW = Math.max(100, clientWidth - padding * 2);
    const availH = Math.max(100, clientHeight - padding * 2);

    const rawZoom = Math.min(availW / bounds.width, availH / bounds.height);
    const nextZoom = clamp(Math.round(rawZoom * 100) / 100, 0.4, 2.0);

    handleZoomChange(nextZoom);

    const contentCenterX = bounds.minX + bounds.width / 2;
    const contentCenterY = bounds.minY + bounds.height / 2;
    const targetScrollX = Math.max(0, Math.round(contentCenterX * nextZoom + padding - clientWidth / 2));
    const targetScrollY = Math.max(0, Math.round(contentCenterY * nextZoom + padding - clientHeight / 2));

    viewport.scrollTo({ left: targetScrollX, top: targetScrollY, behavior: "smooth" });
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ left: targetScrollX, top: targetScrollY, behavior: "smooth" });
      }
    });
  }, [spec, positions, groups, handleZoomChange, interactive]);

  useImperativeHandle(ref, () => ({
    fitToView,
  }), [fitToView]);

  useEffect(() => {
    const viewport = scrollRef.current;
    if (!viewport) return;
    const wheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      event.stopPropagation();
      const current = viewScale;
      const next = architectureZoom(current, event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1));
      const rect = viewport.getBoundingClientRect();
      zoomAnchor.current = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        ratio: next / current,
        left: viewport.scrollLeft,
        top: viewport.scrollTop,
        padding: canvasPadding,
        nextPadding: interactive ? 0 : 48,
      };
      handleZoomChange(next);
    };
    viewport.addEventListener("wheel", wheel, { passive: false });
    return () => viewport.removeEventListener("wheel", wheel);
  }, [viewScale, handleZoomChange, canvasPadding, interactive]);

  useLayoutEffect(() => {
    const anchor = zoomAnchor.current, viewport = scrollRef.current;
    if (anchor && viewport) {
      viewport.scrollLeft = diagramZoomScroll(anchor.left, anchor.x, anchor.ratio, anchor.padding, anchor.nextPadding);
      viewport.scrollTop = diagramZoomScroll(anchor.top, anchor.y, anchor.ratio, anchor.padding, anchor.nextPadding);
      zoomAnchor.current = null;
    }
  }, [viewScale]);
  const connectionDrag=useRef<{source:string;side:ArchitectureSide;pointerId:number;startX:number;startY:number;point:ArchPoint;moved:boolean}|null>(null);
  const [connectionPreview,setConnectionPreview]=useState<{start:ArchPoint;end:ArchPoint;target:string|null}|null>(null);
  const dragRef = useRef<PointerDrag | null>(null);
  const resizeRef = useRef<ResizeDrag | null>(null);
  const [endpointPreview,setEndpointPreview] = useState<{id:string;end:"source"|"target";point:ArchPoint}|null>(null);
  const edgeDragRef = useRef<EdgeDrag | null>(null);
  const suppressClickRef = useRef(false);
  const [marquee, setMarquee] = useState<{ start: ArchPoint; current: ArchPoint } | null>(null);
  const marqueeDragRef = useRef<{ pointerId: number; start: ArchPoint; current: ArchPoint; isShift: boolean; moved: boolean } | null>(null);
  const selectedNodeSet = new Set<string>(
    selectedNodes ? (selectedNodes instanceof Set ? Array.from(selectedNodes) : selectedNodes) : (selectedNode ? [selectedNode] : [])
  );
  const selectedGroupSet = new Set<string>(
    selectedGroups ? (selectedGroups instanceof Set ? Array.from(selectedGroups) : selectedGroups) : (selectedGroup ? [selectedGroup] : [])
  );

  function beginCanvasMarquee(event: React.PointerEvent<SVGSVGElement>) {
    if (!interactive || connecting || event.button !== 0) return;
    const target = event.target as Element;
    const isBackground = event.target === event.currentTarget || target.classList.contains("arch-canvas-bg");
    if (!isBackground) return;

    setEditingName(null);
    const svg = event.currentTarget;
    const rect = svg.getBoundingClientRect();
    const scale = pointerScale(svg);
    const startX = (event.clientX - rect.left) / (scale.scaleX || 1);
    const startY = (event.clientY - rect.top) / (scale.scaleY || 1);

    svg.setPointerCapture(event.pointerId);
    marqueeDragRef.current = {
      pointerId: event.pointerId,
      start: { x: startX, y: startY },
      current: { x: startX, y: startY },
      isShift: event.shiftKey || event.metaKey || event.ctrlKey,
      moved: false
    };
  }
  function moveCanvasMarquee(event: React.PointerEvent<SVGSVGElement>) {
    const drag = marqueeDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const svg = event.currentTarget;
    const rect = svg.getBoundingClientRect();
    const scale = pointerScale(svg);
    const currentX = (event.clientX - rect.left) / (scale.scaleX || 1);
    const currentY = (event.clientY - rect.top) / (scale.scaleY || 1);

    if (Math.hypot(currentX - drag.start.x, currentY - drag.start.y) > 3) {
      drag.moved = true;
    }
    if (drag.moved) {
      drag.current = { x: currentX, y: currentY };
      setMarquee({ start: drag.start, current: { x: currentX, y: currentY } });
    }
  }
  function endCanvasMarquee(event: React.PointerEvent<SVGSVGElement>, cancelled = false) {
    const drag = marqueeDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    marqueeDragRef.current = null;
    setMarquee(null);

    if (cancelled) return;

    if (drag.moved) {
      suppressClickRef.current = true;
      const minX = Math.min(drag.start.x, drag.current.x);
      const maxX = Math.max(drag.start.x, drag.current.x);
      const minY = Math.min(drag.start.y, drag.current.y);
      const maxY = Math.max(drag.start.y, drag.current.y);
      const marqueeBox = { minX, minY, maxX, maxY };

      const selectedNodeIds: string[] = [];
      for (const node of spec.nodes) {
        const pos = positions.get(node.id);
        if (!pos) continue;
        const nodeWidth = architectureNodeWidth(node.label);
        const nodeBox = { x: pos.x, y: pos.y, width: nodeWidth, height: ARCH_NODE_HEIGHT };
        if (isNodeInMarquee(nodeBox, marqueeBox)) {
          selectedNodeIds.push(node.id);
        }
      }

      const selectedGroupIds: string[] = [];
      for (const group of spec.groups) {
        const box = groups.get(group.id);
        if (!box) continue;
        if (isGroupInMarquee(box, marqueeBox)) {
          selectedGroupIds.push(group.id);
        }
      }

      onSelectRange?.(selectedNodeIds, selectedGroupIds, drag.isShift);
    } else {
      if (!drag.isShift) {
        onClearSelection?.();
      }
    }
  }
  const nodeById = new Map(spec.nodes.map((node) => [node.id, node]));
  const groupById = new Map(spec.groups.map((group) => [group.id, group]));
  const endpointBox = (endpointId: string) => {
    const point = positions.get(endpointId);
    if (point) {
      const node = nodeById.get(endpointId);
      const width = architectureNodeWidth(node?.label);
      return { ...point, width, height: ARCH_NODE_HEIGHT, anchorY: 25 };
    }
    return groups.get(endpointId);
  };
  const endpointLabel = (endpointId: string) => { const group=groupById.get(endpointId);return nodeById.get(endpointId)?.label ?? (group?architectureGroupLabel(group):endpointId); };
  const pointerScale = (svg: SVGSVGElement | null) => {
    const bounds = svg?.getBoundingClientRect();
    return { scaleX: bounds && width ? bounds.width / width : 1, scaleY: bounds && height ? bounds.height / height : 1 };
  };
  const edgeRoutes = new Map<string, ReturnType<typeof architectureEdgeRoute>>();
  const edgeEndpoints = spec.edges.map(edge => {
    const rawFrom = endpointBox(edge.source);
    const rawTo = endpointBox(edge.target);
    if (!rawFrom || !rawTo) return null;
    const from = endpointPreview?.id === edge.id && endpointPreview.end === "source" ? { ...endpointPreview.point, width: 0, height: 0 } : rawFrom;
    const to = endpointPreview?.id === edge.id && endpointPreview.end === "target" ? { ...endpointPreview.point, width: 0, height: 0 } : rawTo;
    const dx = to.x + to.width / 2 - from.x - from.width / 2;
    const dy = to.y + to.height / 2 - from.y - from.height / 2;
    const sourceSide = edge.sourceSide ?? (Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? "RIGHT" : "LEFT") : dy >= 0 ? "BOTTOM" : "TOP");
    const targetSide = edge.targetSide ?? (Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? "LEFT" : "RIGHT") : dy >= 0 ? "TOP" : "BOTTOM");
    return { edge, from, to, sourceSide, targetSide };
  }).filter((item): item is NonNullable<typeof item> => item !== null);

  const sourceGroups = new Map<string, { edgeId: string; otherCoord: number }[]>();
  const targetGroups = new Map<string, { edgeId: string; otherCoord: number }[]>();
  for (const item of edgeEndpoints) {
    const sKey = `${item.edge.source}:${item.sourceSide}`;
    const sList = sourceGroups.get(sKey) ?? [];
    sList.push({
      edgeId: item.edge.id,
      otherCoord: item.sourceSide === "LEFT" || item.sourceSide === "RIGHT" ? item.to.y : item.to.x,
    });
    sourceGroups.set(sKey, sList);

    const tKey = `${item.edge.target}:${item.targetSide}`;
    const tList = targetGroups.get(tKey) ?? [];
    tList.push({
      edgeId: item.edge.id,
      otherCoord: item.targetSide === "LEFT" || item.targetSide === "RIGHT" ? item.from.y : item.from.x,
    });
    targetGroups.set(tKey, tList);
  }
  for (const list of sourceGroups.values()) {
    list.sort((a, b) => a.otherCoord - b.otherCoord);
  }
  for (const list of targetGroups.values()) {
    list.sort((a, b) => a.otherCoord - b.otherCoord);
  }

  const pairCounts = new Map<string, number>();
  const edgeLanes = new Map<string, number>();
  for (const item of edgeEndpoints) {
    const pair = [item.edge.source, item.edge.target].sort().join("/");
    const lane = pairCounts.get(pair) ?? 0;
    pairCounts.set(pair, lane + 1);
    edgeLanes.set(item.edge.id, lane);
  }

  for (const item of edgeEndpoints) {
    const sList = sourceGroups.get(`${item.edge.source}:${item.sourceSide}`) ?? [];
    const sIdx = sList.findIndex(e => e.edgeId === item.edge.id);
    const sTotal = sList.length;
    let sourceOffset: { x?: number; y?: number } | undefined;
    if (sTotal > 1) {
      const spread = (sIdx - (sTotal - 1) / 2) * (item.sourceSide === "LEFT" || item.sourceSide === "RIGHT" ? Math.min(14, 36 / sTotal) : Math.min(18, 54 / sTotal));
      sourceOffset = item.sourceSide === "LEFT" || item.sourceSide === "RIGHT" ? { y: spread } : { x: spread };
    }

    const tList = targetGroups.get(`${item.edge.target}:${item.targetSide}`) ?? [];
    const tIdx = tList.findIndex(e => e.edgeId === item.edge.id);
    const tTotal = tList.length;
    let targetOffset: { x?: number; y?: number } | undefined;
    if (tTotal > 1) {
      const spread = (tIdx - (tTotal - 1) / 2) * (item.targetSide === "LEFT" || item.targetSide === "RIGHT" ? Math.min(14, 36 / tTotal) : Math.min(18, 54 / tTotal));
      targetOffset = item.targetSide === "LEFT" || item.targetSide === "RIGHT" ? { y: spread } : { x: spread };
    }

    const lane = edgeLanes.get(item.edge.id) ?? 0;
    edgeRoutes.set(
      item.edge.id,
      architectureEdgeRoute(item.edge, item.from, item.to, { sourceOffset, targetOffset, lane })
    );
  }
  function beginNodeDrag(event: React.PointerEvent<SVGGElement>, node: ArchitectureNode) {
    if (!interactive || (!onMoveNode && !onMoveSelection)) return;
    suppressClickRef.current = false; event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); event.currentTarget.focus({preventScroll:true}); onInteractionStart?.();
    const isAdditive = event.shiftKey || event.metaKey || event.ctrlKey;
    const isAlreadySelected = selectedNodeSet.has(node.id);
    if (!isAlreadySelected && !isAdditive) {
      onSelectNode?.(node.id, false);
    } else if (!isAlreadySelected && isAdditive) {
      onSelectNode?.(node.id, true);
    }
    const isMulti = (isAlreadySelected || isAdditive) && (selectedNodeSet.size + (isAlreadySelected ? 0 : 1) + selectedGroupSet.size > 1);
    dragRef.current = { id: node.id, pointerId: event.pointerId, start: { x: event.clientX, y: event.clientY }, point: positions.get(node.id)!, ...pointerScale(event.currentTarget.ownerSVGElement), moved: false, selectionChanged: !isAlreadySelected, isMulti };
  }
  function moveNodeDrag(event: React.PointerEvent<SVGGElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || (!onMoveNode && !onMoveSelection)) return;
    const dx = Math.round((event.clientX - drag.start.x) / (drag.scaleX || 1));
    const dy = Math.round((event.clientY - drag.start.y) / (drag.scaleY || 1));
    if (Math.hypot(event.clientX - drag.start.x, event.clientY - drag.start.y) > 3) drag.moved = true;
    if(drag.moved) {
      if (drag.isMulti && onMoveSelection) {
        onMoveSelection({ x: dx, y: dy }, false);
      } else if (onMoveNode) {
        onMoveNode(drag.id, { x: clamp(drag.point.x + dx, 0, 4000), y: clamp(drag.point.y + dy, 0, 4000) }, false);
      }
    }
  }
  function endNodeDrag(event: React.PointerEvent<SVGGElement>, _cancelled = false) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if ((onMoveNode || onMoveSelection) && drag.moved) {
      const dx = Math.round((event.clientX - drag.start.x) / (drag.scaleX || 1));
      const dy = Math.round((event.clientY - drag.start.y) / (drag.scaleY || 1));
      if (drag.isMulti && onMoveSelection) {
        onMoveSelection({ x: dx, y: dy }, true);
      } else if (onMoveNode) {
        onMoveNode(drag.id, { x: clamp(drag.point.x + dx, 0, 4000), y: clamp(drag.point.y + dy, 0, 4000) }, true);
      }
    }
    suppressClickRef.current = drag.moved || Boolean(drag.selectionChanged); dragRef.current = null; onInteractionEnd?.();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function beginGroupDrag(event: React.PointerEvent<SVGElement>, groupId: string) {
    if (!interactive || (!onMoveGroup && !onMoveSelection)) return;
    const box = groups.get(groupId); if (!box) return;
    suppressClickRef.current = false; event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); onInteractionStart?.();
    const isAdditive = event.shiftKey || event.metaKey || event.ctrlKey;
    const isAlreadySelected = selectedGroupSet.has(groupId);
    if (!isAlreadySelected && !isAdditive) {
      onSelectGroup?.(groupId, false);
    } else if (!isAlreadySelected && isAdditive) {
      onSelectGroup?.(groupId, true);
    }
    const isMulti = (isAlreadySelected || isAdditive) && (selectedGroupSet.size + (isAlreadySelected ? 0 : 1) + selectedNodeSet.size > 1);
    dragRef.current = { id: groupId, pointerId: event.pointerId, start: { x: event.clientX, y: event.clientY }, point: { x: box.x, y: box.y }, ...pointerScale(event.currentTarget.ownerSVGElement), moved: false, selectionChanged: !isAlreadySelected, isMulti };
  }
  function moveGroupDrag(event: React.PointerEvent<SVGElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || (!onMoveGroup && !onMoveSelection)) return;
    const dx = Math.round((event.clientX - drag.start.x) / (drag.scaleX || 1));
    const dy = Math.round((event.clientY - drag.start.y) / (drag.scaleY || 1));
    if (Math.hypot(event.clientX - drag.start.x, event.clientY - drag.start.y) > 3) drag.moved = true;
    if (drag.moved) {
      if (drag.isMulti && onMoveSelection) {
        onMoveSelection({ x: dx, y: dy }, false);
      } else if (onMoveGroup) {
        onMoveGroup(drag.id, { x: clamp(drag.point.x + dx, 0, 4000), y: clamp(drag.point.y + dy, 0, 4000) }, false);
      }
    }
  }
  function endGroupDrag(event: React.PointerEvent<SVGElement>, _cancelled = false) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if ((onMoveGroup || onMoveSelection) && drag.moved) {
      const dx = Math.round((event.clientX - drag.start.x) / (drag.scaleX || 1));
      const dy = Math.round((event.clientY - drag.start.y) / (drag.scaleY || 1));
      if (drag.isMulti && onMoveSelection) {
        onMoveSelection({ x: dx, y: dy }, true);
      } else if (onMoveGroup) {
        onMoveGroup(drag.id, { x: clamp(drag.point.x + dx, 0, 4000), y: clamp(drag.point.y + dy, 0, 4000) }, true);
      }
    }
    suppressClickRef.current = drag.moved; dragRef.current = null; onInteractionEnd?.();
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
    event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); event.currentTarget.focus({preventScroll:true}); onInteractionStart?.();
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
      side = nearestArchitectureSide(hit.getBoundingClientRect(),event.clientX,event.clientY);
    }
    onReconnectEdge(drag.id, drag.end, endpointId, side);
  }
  function endEdgeDrag(event: React.PointerEvent<SVGGElement>, cancelled = false) {
    const drag = edgeDragRef.current; if (!drag || drag.pointerId !== event.pointerId) return;
    if (!cancelled) {
      if (drag.end) {
        reconnectAtPointer(event, drag);
      } else {
        const route = edgeRoutes.get(drag.id);
        if (route && onMoveEdge) {
          onMoveEdge(drag.id, { x: route.bend.x, y: route.bend.y });
        }
      }
    }
    setEndpointPreview(null); edgeDragRef.current = null; onInteractionEnd?.(); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function connectionTarget(event:React.PointerEvent<SVGGElement>,source:string) {
    const hit=document.elementsFromPoint(event.clientX,event.clientY).map(element=>element.closest("[data-architecture-endpoint]")).find(element=>element && event.currentTarget.ownerSVGElement?.contains(element));
    const target=hit?.getAttribute("data-architecture-endpoint");
    return hit && target && target!==source ? {id:target,side:(hit.getAttribute("data-architecture-side") as ArchitectureSide|null)??nearestArchitectureSide(hit.getBoundingClientRect(),event.clientX,event.clientY)}:null;
  }
  function moveConnection(event:React.PointerEvent<SVGGElement>) {
    const drag=connectionDrag.current;
    if(!drag || drag.pointerId!==event.pointerId) return;
    event.stopPropagation();
    if(Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)>4) drag.moved=true;
    const svg=event.currentTarget.ownerSVGElement, rect=svg?.getBoundingClientRect(), scale=pointerScale(svg);
    if(!rect || !drag.moved) return;
    setConnectionPreview({start:drag.point,end:{x:(event.clientX-rect.left)/scale.scaleX,y:(event.clientY-rect.top)/scale.scaleY},target:connectionTarget(event,drag.source)?.id??null});
  }
  function endConnection(event:React.PointerEvent<SVGGElement>,cancelled=false) {
    const drag=connectionDrag.current;
    if(!drag || drag.pointerId!==event.pointerId) return;
    event.stopPropagation();
    connectionDrag.current=null; setConnectionPreview(null);
    suppressClickRef.current=drag.moved || cancelled;
    if(!cancelled && drag.moved){const target=connectionTarget(event,drag.source);if(target) onConnectNodes?.(drag.source,drag.side,target.id,target.side);}
    if(event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function connectHandle(endpointId: string, label: string, box: { x: number; y: number; width: number; height: number; anchorY?: number }) {
    if (!interactive || !onConnect) return null;
    const centerY = box.y + (box.anchorY ?? box.height / 2);
    const points: Record<ArchitectureSide, ArchPoint> = { TOP: { x: box.x + box.width / 2, y: box.y }, RIGHT: { x: box.x + box.width, y: centerY }, BOTTOM: { x: box.x + box.width / 2, y: box.y + box.height }, LEFT: { x: box.x, y: centerY } };
    return sides.map((side) => <g key={`connect-${endpointId}-${side}`} data-architecture-endpoint={endpointId} data-architecture-side={side} className={`arch-connect-handle${connecting || connectionPreview ? " is-connecting" : ""}${selectedNode===endpointId || selectedGroup===endpointId || hoveredEndpoint===endpointId ? " is-visible":""}`} transform={`translate(${points[side].x} ${points[side].y})`} role="button" tabIndex={0} aria-label={`${label} ${sideNames[side]} 연결 포인트`} onPointerDown={(event) => { suppressClickRef.current = false; event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); event.currentTarget.focus({preventScroll:true}); connectionDrag.current={source:endpointId,side,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,point:points[side],moved:false}; }} onPointerMove={moveConnection} onPointerUp={event=>endConnection(event)} onPointerCancel={event=>endConnection(event,true)} onLostPointerCapture={event=>endConnection(event,true)} onKeyDownCapture={event=>{if(event.key==="Escape"){connectionDrag.current=null;setConnectionPreview(null);suppressClickRef.current=true;}}} onClick={(event) => { event.stopPropagation(); if (suppressClickRef.current) { suppressClickRef.current = false; return; } onConnect(endpointId, side); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); event.stopPropagation(); onConnect(endpointId, side); } }}><circle className="arch-connect-hit" r="8"/><circle className="arch-connect-dot" r="5"/><title>{`${label} ${sideNames[side]} 연결 포인트`}</title></g>);
  }
  const edgeLabel = (edge: ArchitectureEdge) => `${endpointLabel(edge.source)} ${edge.direction==="NONE"?"—":edge.direction==="BOTH"?"↔":"→"} ${endpointLabel(edge.target)}`;
  return <section className={`architecture-block${!interactive?" architecture-reader":""}${collapsed ? " is-collapsed" : ""}`} aria-label={title ?? "시스템 아키텍처 다이어그램"}>
    {title !== null && <div className="architecture-heading"><h2>{title}</h2><p>구성 요소와 데이터 흐름</p></div>}
    {!interactive && (
      <div className="architecture-reader-toolbar">
        <span className="architecture-reader-summary">
          {spec.groups.length > 0
            ? `그룹 ${spec.groups.length} · 구성 요소 ${spec.nodes.length} · 연결 ${spec.edges.length}`
            : `구성 요소 ${spec.nodes.length} · 연결 ${spec.edges.length}`}
        </span>
        {(expanded || activeZoom !== null) ? (
          <span className="architecture-reader-hint" style={{ fontSize: "11.5px", color: "var(--muted)", marginInline: "8px auto" }}>
            Ctrl+휠로 다이어그램을 확대/축소할 수 있습니다.
          </span>
        ) : null}
        <div className="architecture-reader-actions">
          {!expanded && (
            <button
              type="button"
              className="architecture-toggle-collapse-btn"
              aria-label={collapsed ? "아키텍처 다이어그램 펼치기" : "아키텍처 다이어그램 접기"}
              aria-expanded={!collapsed}
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? "다이어그램 펼치기" : "다이어그램 접기"}
            </button>
          )}
          {!expanded && !collapsed && (
            <button
              type="button"
              className="architecture-expand-btn"
              aria-label="아키텍처 확대 보기"
              onClick={() => setViewerOpen(true)}
              title="아키텍처 다이어그램 확대"
            >
              확대
            </button>
          )}
          {(expanded || activeZoom !== null) && (
            <>
              <button
                type="button"
                className="architecture-toggle-collapse-btn"
                aria-label="아키텍처 축소"
                disabled={viewScale <= 0.4}
                onClick={() => handleZoomStep(-0.1)}
              >
                −
              </button>
              <output style={{ minWidth: "38px", textAlign: "center", fontVariantNumeric: "tabular-nums", color: "var(--text)" }}>
                {Math.round(viewScale * 100)}%
              </output>
              <button
                type="button"
                className="architecture-toggle-collapse-btn"
                aria-label="아키텍처 확대"
                disabled={viewScale >= 3}
                onClick={() => handleZoomStep(0.1)}
              >
                ＋
              </button>
              <button
                type="button"
                className="architecture-toggle-collapse-btn"
                onClick={handleResetZoom}
              >
                100%
              </button>
              <button
                type="button"
                className="architecture-toggle-collapse-btn"
                onClick={fitToView}
                title="모든 구성 요소가 보이도록 화면에 맞춥니다"
              >
                화면 맞춤
              </button>
            </>
          )}
        </div>
      </div>
    )}
    {!interactive && !expanded && (
      <DiagramLightbox
        label="아키텍처"
        hideTrigger
        open={viewerOpen}
        onOpenChange={setViewerOpen}
      >
        {() => <ArchitectureBlockInner spec={spec} title={title} expanded />}
      </DiagramLightbox>
    )}
    {!collapsed && (
      <div
        ref={scrollRef}
        data-space-pan={spacePan.active}
        className={`architecture-scroll${isPanning ? " is-panning" : ""}`}
        data-zoomed={activeZoom !== null}
        style={{
          height: interactive
            ? `${Math.min(520, Math.max(340, Math.round(height * (zoom ?? 1) + 20)))}px`
            : expanded ? "min(65svh, 640px)" : `${height * fit}px`,
          touchAction: !interactive ? (expanded || activeZoom !== null ? "none" : "pan-y") : undefined,
          userSelect: !interactive ? "none" : undefined,
        }}
        onPointerDownCapture={event => {
          if (!interactive || (event.button !== 1 && !(event.button === 0 && spacePan.pressed.current))) return;
          const target = event.target as Element;
          if (target.closest("input,textarea,select,button,a,foreignObject")) return;
          event.preventDefault();
          event.stopPropagation();
          const view = event.currentTarget;
          view.focus({preventScroll:true});
          suppressClickRef.current = true;
          panState.current = {startX:event.clientX,startY:event.clientY,scrollLeft:view.scrollLeft,scrollTop:view.scrollTop,active:true};
          setIsPanning(true);
          view.setPointerCapture(event.pointerId);
        }}
        onPointerDown={event => {
          if (interactive) {
            if (event.target === event.currentTarget) {
              setEditingName(null);
              onClearSelection?.();
            }
            return;
          }
          if (event.pointerType === "touch" && !expanded && activeZoom === null) return;
          if (event.button !== 0 && event.button !== 1) return;
          const target = event.target as Element;
          if (target.closest("button,input,select,textarea,a")) return;
          const view = scrollRef.current;
          if (!view) return;
          event.preventDefault();
          panState.current = {
            startX: event.clientX,
            startY: event.clientY,
            scrollLeft: view.scrollLeft,
            scrollTop: view.scrollTop,
            active: false,
          };
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {}
        }}
        onPointerMove={event => {
          if (!panState.current || !scrollRef.current) return;
          const dx = event.clientX - panState.current.startX;
          const dy = event.clientY - panState.current.startY;
          if (Math.hypot(dx, dy) > 3) {
            if (!panState.current.active) {
              panState.current.active = true;
              setIsPanning(true);
            }
            scrollRef.current.scrollLeft = panState.current.scrollLeft - dx;
            scrollRef.current.scrollTop = panState.current.scrollTop - dy;
          }
        }}
        onPointerUp={event => {
          if (panState.current) {
            if (panState.current.active) {
              suppressClickRef.current = true;
            }
            panState.current = null;
            setIsPanning(false);
            try {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
            } catch {}
          }
        }}
        onPointerCancel={event => {
          if (panState.current) {
            panState.current = null;
            setIsPanning(false);
            try {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
            } catch {}
          }
        }}
        onLostPointerCapture={() => { panState.current = null; setIsPanning(false); }}
        onClick={event => {
          if (suppressClickRef.current) {
            suppressClickRef.current = false;
            return;
          }
          if (!interactive && !expanded && activeZoom === null) {
            setViewerOpen(true);
          }
        }}
        role="region"
        tabIndex={0}
        aria-label="가로 스크롤 가능한 아키텍처 다이어그램"
      >
        <div
          style={{
            minWidth: "100%",
            width: "max-content",
            boxSizing: "border-box",
            padding: canvasPadding || undefined,
            display: "inline-block",
            verticalAlign: "top",
          }}
        >
          <svg
            className={`architecture-svg${connecting ? " is-canvas-connecting" : ""}`}
            onPointerDown={beginCanvasMarquee}
            onPointerMove={moveCanvasMarquee}
            onPointerUp={event => endCanvasMarquee(event)}
            onPointerCancel={event => endCanvasMarquee(event, true)}
            onLostPointerCapture={event => endCanvasMarquee(event, true)}
            style={
              (activeZoom !== null || (interactive && zoom !== undefined))
                ? {
                    width: `${Math.round(width * viewScale)}px`,
                    height: `${Math.round(height * viewScale)}px`,
                    minWidth: `${Math.round(width * viewScale)}px`,
                    minHeight: `${Math.round(height * viewScale)}px`,
                    flexShrink: 0,
                    display: "block",
                  }
                : !interactive
                  ? {
                      width: width * fit,
                      height: height * fit,
                      minWidth: 0,
                      maxWidth: "100%",
                      display: "block",
                      margin: "0 auto",
                    }
                  : { display: "block" }
            }
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
          role="group"
          aria-label={title ?? "시스템 아키텍처"}
        >
          <rect className="arch-canvas-bg" width={width} height={height} fill="transparent" pointerEvents="all" />
          <defs><marker id={`${id}-arrow`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 z" fill="#78869a" /></marker></defs>
          {[...spec.groups].sort((a, b) => {
            if (isDescendant(spec.groups, a.id, b.id)) return -1;
            if (isDescendant(spec.groups, b.id, a.id)) return 1;
            if (!a.parentId && b.parentId) return -1;
            if (a.parentId && !b.parentId) return 1;
            const boxA = groups.get(a.id);
            const boxB = groups.get(b.id);
            const areaA = boxA ? boxA.width * boxA.height : 0;
            const areaB = boxB ? boxB.width * boxB.height : 0;
            return areaB - areaA;
          }).map((group) => {
            const box = groups.get(group.id)!;
            const color = group.color ? `arch-group-color-${group.color}` : isArchitectureContainer(group.type) ? "arch-group-docker" : group.type === "CUSTOM" ? "arch-group-custom" : "";
            const label = architectureGroupLabel(group);
            const displayGroupTitle = group.label || (group.type === "CUSTOM" ? (group.typeLabel || "그룹") : groupKind(group));
            const displayGroupDesc = group.typeLabel && group.typeLabel !== displayGroupTitle ? group.typeLabel : null;
            const selected = selectedGroupSet.has(group.id) || selectedGroup === group.id || connectionPreview?.target===group.id;
            return <g key={group.id} onDoubleClick={event=>{if(interactive && onRenameGroup){event.stopPropagation();setEditingName({kind:"group",id:group.id,label:displayGroupTitle});}}} onPointerEnter={()=>setHoveredEndpoint(group.id)} onPointerLeave={()=>setHoveredEndpoint(null)} className={`arch-group-wrap${interactive && (onMoveGroup || onSelectGroup || onMoveSelection) ? " is-interactive" : ""}${selected ? " is-selected" : ""}`}>
            <rect data-architecture-endpoint={group.id} className={`arch-group ${color}`} x={box.x} y={box.y} width={box.width} height={box.height} rx="18" onPointerDown={(event) => beginGroupDrag(event, group.id)} onPointerMove={moveGroupDrag} onPointerUp={(event) => endGroupDrag(event)} onPointerCancel={(event) => endGroupDrag(event, true)} onLostPointerCapture={(event) => endGroupDrag(event, true)} onClick={(event) => { if (suppressClickRef.current) { suppressClickRef.current = false; return; } if (interactive) onSelectGroup?.(group.id, event.shiftKey || event.metaKey || event.ctrlKey); }} />
            {connectHandle(group.id, label, box)}
            {group.icon&&<g transform={`translate(${box.x+1} ${box.y-9})`}><ArchitectureIcon value={group.icon}/></g>}
            <text onDoubleClick={event=>{if(interactive && onRenameGroup){event.stopPropagation();setEditingName({kind:"group",id:group.id,label:displayGroupTitle});}}} data-architecture-endpoint={group.id} className="arch-group-label" x={box.x + (group.icon?46:14)} y={box.y + (displayGroupDesc ? 19 : 24)} tabIndex={interactive ? 0 : undefined} role={interactive ? "button" : undefined} aria-label={interactive ? label : undefined} onPointerDown={(event) => beginGroupDrag(event, group.id)} onPointerMove={moveGroupDrag} onPointerUp={(event) => endGroupDrag(event)} onPointerCancel={(event) => endGroupDrag(event, true)} onLostPointerCapture={(event) => endGroupDrag(event, true)} onClick={(event) => { if (suppressClickRef.current) { suppressClickRef.current = false; return; } if (interactive) onSelectGroup?.(group.id, event.shiftKey || event.metaKey || event.ctrlKey); }} onKeyDown={(event) => { if (!interactive) return; if(selectedNodeSet.size+selectedGroupSet.size>1 && ["Delete","Backspace","ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(event.key))return; if((event.key==="Delete"||event.key==="Backspace")&&onDeleteGroup){event.preventDefault();event.stopPropagation();onDeleteGroup(group.id);return;} if (event.key === "Enter") { event.preventDefault(); onSelectGroup?.(group.id); return; } const delta = event.shiftKey ? 10 : 1; const vectors: Record<string, ArchPoint> = { ArrowLeft: { x: -delta, y: 0 }, ArrowRight: { x: delta, y: 0 }, ArrowUp: { x: 0, y: -delta }, ArrowDown: { x: 0, y: delta } }; const vector = vectors[event.key]; if (vector && onMoveGroup) { event.preventDefault(); event.stopPropagation(); onInteractionStart?.(); onMoveGroup(group.id, { x: clamp(box.x + vector.x, 0, 4000), y: clamp(box.y + vector.y, 0, 4000) }, true); onInteractionEnd?.(); } }}><tspan>{short(displayGroupTitle,Math.max(40,box.width-32-(group.icon?36:0)),12)}</tspan></text>
            {displayGroupDesc && <text onDoubleClick={event=>{if(interactive && onRenameGroupType){event.stopPropagation();setEditingName({kind:"groupType",id:group.id,label:displayGroupDesc});}}} data-architecture-endpoint={group.id} className="arch-group-desc" x={box.x + (group.icon?46:14)} y={box.y + 33} tabIndex={interactive ? 0 : undefined} role={interactive ? "button" : undefined} onPointerDown={(event) => beginGroupDrag(event, group.id)} onPointerMove={moveGroupDrag} onPointerUp={(event) => endGroupDrag(event)} onPointerCancel={(event) => endGroupDrag(event, true)} onLostPointerCapture={(event) => endGroupDrag(event, true)} onClick={(event) => { if (suppressClickRef.current) { suppressClickRef.current = false; return; } if (interactive) onSelectGroup?.(group.id, event.shiftKey || event.metaKey || event.ctrlKey); }}><tspan>{short(displayGroupDesc,Math.max(40,box.width-32-(group.icon?36:0)),10)}</tspan></text>}
            <title>{label}</title>
            {nameEditor(box.x+8+(group.icon?34:0),box.y+3,"group",group.id)}
            {nameEditor(box.x+8+(group.icon?34:0),box.y+20,"groupType",group.id)}
            {interactive && onResizeGroup && <g className="arch-group-resize" transform={`translate(${box.x + box.width} ${box.y + box.height})`} role="button" tabIndex={0} aria-label={`${label} 크기 조절`} onPointerDown={(event) => beginResize(event, group.id)} onPointerMove={moveResize} onPointerUp={endResize} onPointerCancel={endResize} onLostPointerCapture={endResize} onKeyDown={(event) => {  const delta = event.shiftKey ? 10 : 1; const vectors: Record<string, { width: number; height: number }> = { ArrowLeft: { width: -delta, height: 0 }, ArrowRight: { width: delta, height: 0 }, ArrowUp: { width: 0, height: -delta }, ArrowDown: { width: 0, height: delta } }; const vector = vectors[event.key]; if (vector && onResizeGroup) { event.preventDefault(); event.stopPropagation(); onInteractionStart?.(); onResizeGroup(group.id, { width: clamp(box.width + vector.width, 200, 4200), height: clamp(box.height + vector.height, 120, 4200) }); onInteractionEnd?.(); } }}><circle className="arch-group-resize-hit" r="12"/><path className="arch-group-resize-mark" d="M-7 7 7-7M0 7 7 0"/><title>{`${label} 크기 조절`}</title></g>}
          </g>; })}
          {spec.edges.map((edge) => { const route = edgeRoutes.get(edge.id); if (!route) return null; const selected = interactive && selectedEdge === edge.id; const accessibleLabel = `연결 ${edgeLabel(edge)}`; return <g key={edge.id} className={`arch-edge-wrap${selected ? " is-selected" : ""}`} role={interactive ? "button" : undefined} tabIndex={interactive ? 0 : undefined} aria-label={interactive ? accessibleLabel : undefined} onClick={() => {if(interactive){setHiddenWaypoint(null);onSelectEdge?.(edge.id);}}} onDoubleClick={event=>{if(interactive && onRenameEdge){event.stopPropagation();onSelectEdge?.(edge.id);setEditingName({kind:"edge",id:edge.id,label:edge.label??""});}}} onKeyDown={(event) => { if (interactive && event.key === "Enter") { event.preventDefault(); setHiddenWaypoint(null); onSelectEdge?.(edge.id); } }}><title>{`${edgeLabel(edge)}${edge.label ? ` · ${edge.label}` : ""}`}</title>{interactive && <path className="arch-edge-hit" d={route.path}/>}<path className="arch-edge" markerStart={connectionMarkers(edge.direction).start?`url(#${id}-arrow)`:undefined} markerEnd={connectionMarkers(edge.direction).end?`url(#${id}-arrow)`:undefined} d={route.path}/>{edge.label && <text className="arch-edge-label" x={route.label.x} y={route.label.y} onDoubleClick={event=>{if(interactive && onRenameEdge){event.stopPropagation();onSelectEdge?.(edge.id);setEditingName({kind:"edge",id:edge.id,label:edge.label??""});}}}>{short(edge.label, 112, 10)}</text>}</g>; })}
          {spec.nodes.map((node) => {
            const point = positions.get(node.id)!;
            const selected = selectedNodeSet.has(node.id) || selectedNode === node.id || connectionPreview?.target===node.id;
            const nodeWidth = architectureNodeWidth(node.label);
            const editorWidth = Math.max(nodeWidth + 12, 80);
            const descLines = node.description ? node.description.split("\n") : [];
            const maxLineWidth = descLines.reduce((m, l) => Math.max(m, measureTextWidth(l, 10.5)), 0);
            const tooltipW = node.description ? Math.min(280, Math.max(nodeWidth, maxLineWidth + 20)) : 0;
            const tooltipLineH = 15;
            const tooltipPaddingY = 5;
            const tooltipH = tooltipPaddingY * 2 + descLines.length * tooltipLineH;
            const tooltipY = 68;
            return <g key={node.id} onDoubleClick={event=>{if(interactive && onRenameNode){event.stopPropagation();setEditingName({kind:"node",id:node.id,label:node.label});}}} onPointerEnter={()=>setHoveredEndpoint(node.id)} onPointerLeave={()=>setHoveredEndpoint(null)} data-architecture-endpoint={node.id} data-node-type={node.type} data-object-kind={architectureIconKind(node.icon,node.type)} className={`arch-node-wrap${interactive ? " arch-node-draggable" : ""}${selected ? " is-selected" : ""}`} transform={`translate(${point.x} ${point.y})`} onPointerDown={(event) => beginNodeDrag(event, node)} onPointerMove={moveNodeDrag} onPointerUp={(event) => endNodeDrag(event)} onPointerCancel={(event) => endNodeDrag(event, true)} onLostPointerCapture={(event) => endNodeDrag(event, true)} onClick={(event) => { if (suppressClickRef.current) { suppressClickRef.current = false; return; } if (interactive) onSelectNode?.(node.id, event.shiftKey || event.metaKey || event.ctrlKey); }} onKeyDown={(event) => { if (!interactive) return; if(selectedNodeSet.size+selectedGroupSet.size>1 && ["Delete","Backspace","ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(event.key))return; if((event.key==="Delete"||event.key==="Backspace")&&onDeleteNode){event.preventDefault();event.stopPropagation();onDeleteNode(node.id);return;} if(onRenameNode && (event.key==="F2" || event.key==="Enter")){event.preventDefault();event.stopPropagation();setEditingName({kind:"node",id:node.id,label:node.label});return;} const delta = event.shiftKey ? 10 : 1; if (event.key === "Enter") { event.preventDefault(); onSelectNode?.(node.id); return; } const vectors: Record<string, ArchPoint> = { ArrowLeft: { x: -delta, y: 0 }, ArrowRight: { x: delta, y: 0 }, ArrowUp: { x: 0, y: -delta }, ArrowDown: { x: 0, y: delta } }; const vector = vectors[event.key]; if (vector && onMoveNode) { event.preventDefault(); event.stopPropagation(); onInteractionStart?.(); onMoveNode(node.id, { x: clamp(point.x + vector.x, 0, 4000), y: clamp(point.y + vector.y, 0, 4000) }, true); onInteractionEnd?.(); } }} tabIndex={interactive ? 0 : undefined} role={interactive ? "button" : undefined} aria-label={node.label||"이름 입력"}><title>{node.label}</title><ArchitectureObject value={node.icon} type={node.type} width={nodeWidth}/><text className="arch-node-label" x={nodeWidth / 2} y={59} textAnchor="middle" onDoubleClick={event=>{if(interactive && onRenameNode){event.stopPropagation();setEditingName({kind:"node",id:node.id,label:node.label});}}}>{short(node.label||'이름 입력',nodeWidth - 8,11)}</text>{nameEditor(nodeWidth / 2 - editorWidth / 2, 45, "node", node.id, editorWidth)}{node.description && !editingName && <g className="arch-node-tooltip" pointerEvents="none"><rect className="arch-node-tooltip-bg" x={nodeWidth / 2 - tooltipW / 2} y={tooltipY} width={tooltipW} height={tooltipH} rx={6}/>{descLines.map((line, idx) => <text key={idx} className="arch-node-tooltip-text" x={nodeWidth / 2} y={tooltipY + tooltipPaddingY + idx * tooltipLineH + 11} textAnchor="middle" xmlSpace="preserve">{short(line, 260, 10.5)}</text>)}</g>}</g>; })}
          {spec.nodes.map((node) => { const point = positions.get(node.id)!; const width = architectureNodeWidth(node.label); return connectHandle(node.id, node.label, { ...point, width, height: ARCH_NODE_HEIGHT, anchorY: 25 }); })}
          {connectionPreview && <path className="arch-connection-preview" d={`M${connectionPreview.start.x},${connectionPreview.start.y} L${connectionPreview.end.x},${connectionPreview.end.y}`} markerStart={connectionMarkers(connectionDirection).start?`url(#${id}-arrow)`:undefined} markerEnd={connectionMarkers(connectionDirection).end?`url(#${id}-arrow)`:undefined}/>}
          {marquee && (() => {
            const x = Math.min(marquee.start.x, marquee.current.x);
            const y = Math.min(marquee.start.y, marquee.current.y);
            const w = Math.abs(marquee.current.x - marquee.start.x);
            const h = Math.abs(marquee.current.y - marquee.start.y);
            return <rect className="arch-marquee-selection" x={x} y={y} width={w} height={h} rx={2} />;
          })()}
          {interactive && selectedEdge && (() => { const edge = spec.edges.find((item) => item.id === selectedEdge), route = edgeRoutes.get(selectedEdge); if (!edge || !route) return null; const sourceBox = endpointBox(edge.source), targetBox = endpointBox(edge.target); if (!sourceBox || !targetBox) return null; const toolbarY = route.bend.y - 43; return <g className="arch-edge-controls">
            {hiddenWaypoint!==edge.id && <g className="arch-edge-waypoint" transform={`translate(${route.bend.x} ${route.bend.y})`} role="button" tabIndex={0} aria-label={`연결 경로 조절 ${edge.id}`} onPointerDown={(event) => beginEdgeDrag(event, edge, route.bend)} onPointerMove={moveEdgeDrag} onPointerUp={endEdgeDrag} onPointerCancel={(event) => endEdgeDrag(event, true)} onLostPointerCapture={(event) => endEdgeDrag(event, true)} onKeyDown={(event) => { if((event.key==="Delete" || event.key==="Backspace") && onResetEdgeWaypoint){event.preventDefault();event.stopPropagation();onResetEdgeWaypoint(edge.id);setHiddenWaypoint(edge.id);scrollRef.current?.focus({preventScroll:true});return;} const delta = event.shiftKey ? 10 : 1; const vectors: Record<string, ArchPoint> = { ArrowLeft: { x: -delta, y: 0 }, ArrowRight: { x: delta, y: 0 }, ArrowUp: { x: 0, y: -delta }, ArrowDown: { x: 0, y: delta } }; const vector = vectors[event.key]; if (vector && onMoveEdge) { event.preventDefault(); event.stopPropagation(); onInteractionStart?.(); onMoveEdge(edge.id, { x: clamp(route.bend.x + vector.x, 0, 4200), y: clamp(route.bend.y + vector.y, 0, 4200) }); onInteractionEnd?.(); } }}><circle className="arch-edge-waypoint-hit" r="12"/><circle className="arch-edge-waypoint-dot" r="4"/><title>{`연결 경로 조절 ${edge.id}`}</title></g>}
            <g className="arch-edge-toolbar" transform={`translate(${route.bend.x} ${toolbarY})`}>
              {editingName?.kind==="edge" && editingName.id===edge.id ? nameEditor(-60,-17,"edge",edge.id) : <>
                <rect x="-54" y="-13" width="108" height="26" rx="8" onClick={event=>{event.stopPropagation();if(interactive&&onRenameEdge)setEditingName({kind:"edge",id:edge.id,label:edge.label??""});}} onDoubleClick={event=>{event.stopPropagation();if(interactive&&onRenameEdge)setEditingName({kind:"edge",id:edge.id,label:edge.label??""});}}/>
                <text x="-10" y="4" textAnchor="middle" onClick={event=>{event.stopPropagation();if(interactive&&onRenameEdge)setEditingName({kind:"edge",id:edge.id,label:edge.label??""});}} onDoubleClick={event=>{event.stopPropagation();if(interactive&&onRenameEdge)setEditingName({kind:"edge",id:edge.id,label:edge.label??""});}}>{short(edge.label || "설명 입력", 54, 10)}</text>
                <g className="arch-edge-delete" transform="translate(36 0)" role="button" tabIndex={0} aria-label={`연결 삭제 ${edge.id}`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onDeleteEdge?.(edge.id); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); event.stopPropagation(); onDeleteEdge?.(edge.id); } }}><circle r="9"/><path d="m-3-3 6 6m0-6-6 6"/><title>{`연결 삭제 ${edge.id}`}</title></g>
              </>}
            </g>
            <g className="arch-edge-endpoint-handle source" transform={`translate(${route.start.x} ${route.start.y})`} role="button" tabIndex={0} aria-label={`연결 시작점 조절 ${edge.id}`} onPointerDown={(event) => beginEdgeDrag(event, edge, route.start, "source")} onPointerMove={moveEdgeDrag} onPointerUp={endEdgeDrag} onPointerCancel={(event) => endEdgeDrag(event, true)} onLostPointerCapture={(event) => endEdgeDrag(event, true)}><circle r="10"/><title>{`연결 시작점 조절 ${edge.id}`}</title></g>
            <g className="arch-edge-endpoint-handle target" transform={`translate(${route.end.x} ${route.end.y})`} role="button" tabIndex={0} aria-label={`연결 도착점 조절 ${edge.id}`} onPointerDown={(event) => beginEdgeDrag(event, edge, route.end, "target")} onPointerMove={moveEdgeDrag} onPointerUp={endEdgeDrag} onPointerCancel={(event) => endEdgeDrag(event, true)} onLostPointerCapture={(event) => endEdgeDrag(event, true)}><circle r="10"/><title>{`연결 도착점 조절 ${edge.id}`}</title></g>
          </g>; })()}
          {(() => {
            if (!hoveredEndpoint) return null;
            const hNode = nodeById.get(hoveredEndpoint);
            if (!hNode || !hNode.description || editingName) return null;
            const point = positions.get(hNode.id);
            if (!point) return null;
            const nWidth = architectureNodeWidth(hNode.label);
            const lines = hNode.description.split("\n");
            const maxW = lines.reduce((m, l) => Math.max(m, measureTextWidth(l, 10.5)), 0);
            const w = Math.min(280, Math.max(nWidth, maxW + 20));
            const lineH = 15;
            const padY = 5;
            const h = padY * 2 + lines.length * lineH;
            const tY = 68;
            return (
              <g className="arch-node-tooltip is-active-overlay" transform={`translate(${point.x} ${point.y})`} pointerEvents="none">
                <rect className="arch-node-tooltip-bg" x={nWidth / 2 - w / 2} y={tY} width={w} height={h} rx={6} />
                {lines.map((l, i) => (
                  <text key={i} className="arch-node-tooltip-text" x={nWidth / 2} y={tY + padY + i * lineH + 11} textAnchor="middle" xmlSpace="preserve">
                    {short(l, 260, 10.5)}
                  </text>
                ))}
              </g>
            );
          })()}
        </svg>
        </div>
      </div>
    )}
    {spec.nodes.some(node=>architectureBrandIcon(node.icon))||spec.groups.some(group=>architectureBrandIcon(group.icon))?<a className="architecture-icon-credits" href="/technology-icons/NOTICE.txt" target="_blank" rel="noreferrer">아이콘 출처·라이선스</a>:null}
    {!interactive && !collapsed && (
      <details className="architecture-description-details">
        <summary className="architecture-description-summary">
          <span>구성 요소 및 연결 목록 ({spec.edges.length})</span>
          <svg
            className="architecture-description-chevron"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </summary>
        <div className="architecture-description">
          <h3>경계 그룹</h3>
          {spec.groups.length ? (
            <ul>
              {spec.groups.map(group => (
                <li key={group.id}>
                  {architectureGroupLabel(group)}
                  {group.parentId ? ` (내부: ${endpointLabel(group.parentId)})` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p>경계 그룹이 없습니다.</p>
          )}
          <h3>구성 요소</h3>
          <ul>
            {spec.nodes.map(node => (
              <li key={node.id}>
                <strong>{node.label}</strong>
                {node.description ? ` (${node.description})` : ""}
                {node.groupId ? ` · ${endpointLabel(node.groupId)}` : ""}
              </li>
            ))}
          </ul>
          <h3>연결</h3>
          {spec.edges.length ? (
            <ol>
              {spec.edges.map(edge => (
                <li key={edge.id}>
                  {edgeLabel(edge)}
                  {edge.label ? ` · ${edge.label}` : ""}
                </li>
              ))}
            </ol>
          ) : (
            <p>표시할 연결이 없습니다.</p>
          )}
        </div>
      </details>
    )}
  </section>;
}

export const ArchitectureBlock = forwardRef<ArchitectureBlockHandle, ArchitectureBlockProps>(ArchitectureBlockInner);
