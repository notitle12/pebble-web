"use client";
import {useEffect,useRef,useState,type KeyboardEvent,type PointerEvent,type RefObject} from "react";
import {stoneSize,stoneMergeTarget,stonePaintOrder,stoneRotation,moveStoneGroup,rotateStoneGroup,stoneGroupBounds,stonesInBox,type Stone} from "../stones";
import {StoneShape} from "./stone-shape";
type Point={x:number;y:number};
type Drag={ids:string[];start:Point;stone?:Stone;initial:Stone[];next:Stone[];moved:boolean;started:boolean;mode:"move"|"rotate"|"select";angle:number;additive:string[];center?:Point};
export function StoneScene({stones,selected=[],interactive=false,disabled=false,onSelect,onSelectionChange,onChange,onDragStart,onDragEnd,onMerge,onClearSelection,inventoryRef,onReturn,onReturnHover,highlight}:{stones:Stone[];selected?:string[];interactive?:boolean;disabled?:boolean;onSelect?:(id:string,multiple:boolean)=>void;onSelectionChange?:(ids:string[])=>void;onChange?:(stones:Stone[])=>void;onDragStart?:()=>void;onDragEnd?:()=>void;onMerge?:(sourceId:string,targetId:string)=>void;onClearSelection?:()=>void;inventoryRef?:RefObject<HTMLElement|null>;onReturn?:(ids:string[])=>void;onReturnHover?:(active:boolean)=>void;highlight?:Set<string>}){
 const svg=useRef<SVGSVGElement>(null),drag=useRef<Drag|null>(null);
 const [mergeTarget,setMergeTarget]=useState<string|null>(null),[marquee,setMarquee]=useState<{start:Point;end:Point}|null>(null);
 useEffect(()=>{if(!selected.length||disabled)return;const clear=(event:globalThis.PointerEvent)=>{if(event.target instanceof Element&&(svg.current?.contains(event.target)||event.target.closest(interactive?".stone-toolbar, .stone-layer-list":".stone-piece")))return;onClearSelection?.();};document.addEventListener("pointerdown",clear);return()=>document.removeEventListener("pointerdown",clear);},[selected.length,disabled,interactive,onClearSelection]);
 function point(event:PointerEvent<SVGElement>){const matrix=svg.current?.getScreenCTM();return matrix?new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse()):null;}
 function capture(event:PointerEvent<SVGElement>){event.preventDefault();event.stopPropagation();svg.current?.focus();svg.current?.setPointerCapture(event.pointerId);}
 function start(event:PointerEvent<SVGElement>,stone:Stone,mode:"move"|"rotate"="move"){
  if(!interactive||disabled||event.button!==0)return;const at=point(event);if(!at)return;
  const modifier=event.shiftKey||event.ctrlKey||event.metaKey;
  const ids=selected.includes(stone.id)?selected:[stone.id];
  const center=mode==="rotate"?(stoneGroupBounds(stones,ids)??stone):stone;
  if(!selected.includes(stone.id)||modifier&&mode==="move")onSelect?.(stone.id,mode==="move"&&modifier);
  capture(event);drag.current={ids,initial:stones,next:stones,start:at,stone,moved:false,started:false,mode,angle:Math.atan2(at.y-center.y,at.x-center.x),additive:[],center};
 }
 function startBox(event:PointerEvent<SVGSVGElement>){if(!interactive||disabled||event.button!==0||(event.target instanceof Element&&event.target.closest(".stone-piece, .stone-group-selection")))return;const at=point(event);if(!at)return;capture(event);const additive=event.shiftKey?selected:[];onSelectionChange?.(additive);drag.current={ids:[],initial:stones,next:stones,start:at,moved:false,started:false,mode:"select",angle:0,additive};}
 function overInventory(event:PointerEvent<SVGElement>){const box=inventoryRef?.current?.getBoundingClientRect();return !!box&&event.clientX>=box.left&&event.clientX<=box.right&&event.clientY>=box.top&&event.clientY<=box.bottom;}
 function move(event:PointerEvent<SVGSVGElement>){const current=drag.current;if(!current||disabled)return;const at=point(event);if(!at)return;
  current.moved=current.moved||Math.hypot(at.x-current.start.x,at.y-current.start.y)>2;if(!current.moved)return;
  if(current.mode==="select"){setMarquee({start:current.start,end:at});onSelectionChange?.([...new Set([...current.additive,...stonesInBox(current.initial,current.start,at)])]);return;}
  if(!current.started){onDragStart?.();current.started=true;}
  const stone=current.stone!;
  current.next=current.mode==="rotate"?rotateStoneGroup(current.initial,current.ids,stoneRotation(0,(Math.atan2(at.y-current.center!.y,at.x-current.center!.x)-current.angle)*180/Math.PI,event.shiftKey)):moveStoneGroup(current.initial,current.ids,at.x-current.start.x,at.y-current.start.y);
  const returning=current.mode==="move"&&overInventory(event);onReturnHover?.(returning);
  const next=current.next.find(item=>item.id===stone.id)!;
  setMergeTarget(!returning&&current.mode==="move"&&current.ids.length===1?stoneMergeTarget(current.next,stone.id,next.x,next.y)?.id??null:null);onChange?.(current.next);
 }
 function end(event?:PointerEvent<SVGSVGElement>,cancelled=false){const current=drag.current;if(!current)return;drag.current=null;setMergeTarget(null);setMarquee(null);onReturnHover?.(false);
  if(current.mode!=="select"&&current.moved){if(cancelled)onChange?.(current.initial);else if(current.mode==="move"){if(event&&overInventory(event))onReturn?.(current.ids);else if(current.ids.length===1){const stone=current.next.find(item=>item.id===current.ids[0]);const target=stone&&stoneMergeTarget(current.next,stone.id,stone.x,stone.y);if(target)onMerge?.(stone!.id,target.id);}}}onDragEnd?.();
 }
 function key(event:KeyboardEvent<SVGElement>,stone?:Stone){if(disabled)return;
  if(event.key==="Escape"){event.preventDefault();onClearSelection?.();return;}
  if(stone&&["Enter"," "].includes(event.key)){event.preventDefault();onSelect?.(stone.id,event.shiftKey);return;}
  if(!interactive)return;const step=event.shiftKey?10:1,directions:Record<string,[number,number]>={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]},delta=directions[event.key];
  if(delta){const ids=stone&&!selected.includes(stone.id)?[stone.id]:selected;if(!ids.length)return;event.preventDefault();onDragStart?.();if(stone&&!selected.includes(stone.id))onSelect?.(stone.id,false);onChange?.(moveStoneGroup(stones,ids,...delta));onDragEnd?.();}
 }
 const groupBounds=selected.length>1?stoneGroupBounds(stones,selected):null;
 const top=interactive||!stones.length?0:Math.max(0,Math.min(...stones.map(stone=>{const size=stoneSize(stone.postIds.length),angle=stone.rotation*Math.PI/180;return stone.y-(Math.abs(Math.sin(angle))*size.width+Math.abs(Math.cos(angle))*size.height)/2;}))-12);
 return <svg ref={svg} tabIndex={interactive&&!disabled?0:undefined} onKeyDown={event=>{if(event.target===svg.current)key(event);}} onPointerDown={startBox} onPointerMove={move} onPointerUp={event=>end(event)} onPointerCancel={()=>end(undefined,true)} onLostPointerCapture={event=>{if(event.target===svg.current)end(undefined,true);}} className={`stone-canvas${interactive?" is-editable":""}`} viewBox={`0 ${top} 1000 ${360-top}`} preserveAspectRatio={interactive?"xMidYMid meet":"xMidYMax meet"} role="group" aria-label={interactive?"돌 배치 영역. 빈 곳을 드래그해 여러 돌을 선택하고 방향키로 이동할 수 있어요.":"기록으로 쌓은 돌"}>
  <path d="M30 344H970" stroke="var(--line)" strokeWidth="1" pointerEvents="none"/>
  {stonePaintOrder(stones).map(stone=>{const {width,height}=stoneSize(stone.postIds.length),active=selected.includes(stone.id);return <g key={stone.id} role="button" tabIndex={disabled?-1:0} aria-label={`돌 · ${stone.postIds.length}개의 글`} aria-pressed={active} transform={`translate(${stone.x} ${stone.y}) rotate(${stone.rotation})`} className={`stone-piece${mergeTarget===stone.id?" is-merge-target":""}`} opacity={highlight&&!stone.postIds.some(id=>highlight.has(id))?.25:1} onPointerDown={event=>start(event,stone)} onClick={()=>!interactive&&!disabled&&onSelect?.(stone.id,false)} onKeyDown={event=>key(event,stone)}>
   <rect className="stone-outline" x={-width/2-4} y={-height/2-4} width={width+8} height={height+8} rx="10" fill="transparent" stroke={active&&!groupBounds||mergeTarget===stone.id?"var(--accent)":"transparent"} strokeWidth="2"/>
   {mergeTarget===stone.id&&<text y={-height/2-12} textAnchor="middle" fontSize="12" fill="var(--accent)">합치기</text>}
   <svg x={-width/2} y={-height/2} width={width} height={height} pointerEvents="none"><StoneShape seed={stone.postIds[0]} count={stone.postIds.length} shape={stone.shape}/></svg>
   {interactive&&active&&selected.length===1&&[[-1,-1],[1,-1],[-1,1],[1,1]].map(([dx,dy],index)=><g key={index} className="stone-rotate-handle" transform={`translate(${dx*(width/2+8)} ${dy*(height/2+8)})`} onPointerDown={event=>start(event,stone,"rotate")}><title>끌어서 회전 · Shift로 15도씩</title><circle className="stone-rotate-hit" r="13" fill="transparent"/><circle className="stone-rotate-icon" r="10" fill="white" stroke="var(--accent)"/><path className="stone-rotate-icon" d="M4 -3 A5 5 0 1 0 5 2 M4 -3 H0 M4 -3 V-7" fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none"/></g>)}
  </g>;})}
  {interactive&&groupBounds&&<g className="stone-group-selection" transform={`translate(${groupBounds.x} ${groupBounds.y})`}>
   <rect x={-groupBounds.width/2-5} y={-groupBounds.height/2-5} width={groupBounds.width+10} height={groupBounds.height+10} rx="6" fill="transparent" stroke="var(--accent)" strokeWidth="2" onPointerDown={event=>{const first=stones.find(s=>selected.includes(s.id));if(first)start(event,first);}}/>
   {[[-1,-1],[1,-1],[-1,1],[1,1]].map(([dx,dy],index)=><g key={index} className="stone-rotate-handle" transform={`translate(${dx*(groupBounds.width/2+8)} ${dy*(groupBounds.height/2+8)})`} onPointerDown={event=>{const first=stones.find(s=>selected.includes(s.id));if(first)start(event,first,"rotate");}}><title>묶음 회전</title><circle className="stone-rotate-hit" r="13" fill="transparent"/><circle className="stone-rotate-icon" r="10" fill="white" stroke="var(--accent)"/><path className="stone-rotate-icon" d="M4 -3 A5 5 0 1 0 5 2 M4 -3 H0 M4 -3 V-7" fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" pointerEvents="none"/></g>)}
  </g>}
  {marquee&&<rect className="stone-marquee" x={Math.min(marquee.start.x,marquee.end.x)} y={Math.min(marquee.start.y,marquee.end.y)} width={Math.abs(marquee.end.x-marquee.start.x)} height={Math.abs(marquee.end.y-marquee.start.y)} fill="var(--accent-soft)" fillOpacity=".45" stroke="var(--accent)" strokeDasharray="4 3" pointerEvents="none"/>}
 </svg>;
}
