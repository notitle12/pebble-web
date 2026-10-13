"use client";
import {useEffect,useRef,useState,type KeyboardEvent,type PointerEvent} from "react";
import {moveStone,stoneSize,stoneMergeTarget,snapStone,stonePaintOrder,stoneRotation,nudgeStone,type Stone} from "../stones";
import {StoneShape} from "./stone-shape";
export function StoneScene({stones,selected=[],interactive=false,disabled=false,onSelect,onChange,onDragStart,onDragEnd,onMerge,onClearSelection,highlight}:{stones:Stone[];selected?:string[];interactive?:boolean;disabled?:boolean;onSelect?:(id:string,multiple:boolean)=>void;onChange?:(stones:Stone[])=>void;onDragStart?:()=>void;onDragEnd?:()=>void;onMerge?:(sourceId:string,targetId:string)=>void;onClearSelection?:()=>void;highlight?:Set<string>}){
 const svg=useRef<SVGSVGElement>(null),drag=useRef<{id:string;startX:number;startY:number;stone:Stone;moved:boolean;started:boolean;mode:"move"|"rotate";angle:number}|null>(null);
 const [mergeTarget,setMergeTarget]=useState<string|null>(null);
 useEffect(()=>{if(!selected.length||disabled)return;const clear=(event:globalThis.PointerEvent)=>{if(event.target instanceof Element&&event.target.closest(interactive?".stone-piece, .stone-toolbar, .stone-layer-list":".stone-piece"))return;onClearSelection?.();};document.addEventListener("pointerdown",clear);return()=>document.removeEventListener("pointerdown",clear);},[selected.length,disabled,interactive,onClearSelection]);
 function point(event:PointerEvent<SVGElement>){const matrix=svg.current?.getScreenCTM();return matrix?new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse()):null;}
 function start(event:PointerEvent<SVGElement>,stone:Stone,mode:"move"|"rotate"="move"){
  if(!interactive||disabled||!svg.current)return;const at=point(event);if(!at)return;
  event.preventDefault();event.stopPropagation();onSelect?.(stone.id,mode==="move"&&(event.shiftKey||event.ctrlKey||event.metaKey));
  const piece=event.currentTarget.closest<SVGGElement>(".stone-piece");piece?.focus();
  drag.current={id:stone.id,startX:at.x,startY:at.y,stone,moved:false,started:false,mode,angle:Math.atan2(at.y-stone.y,at.x-stone.x)};
  // 높이에 따라 돌 DOM 순서가 바뀌어도 드래그가 끊기지 않도록 캔버스에 캡처한다.
  svg.current.setPointerCapture(event.pointerId);
 }
 function move(event:PointerEvent<SVGSVGElement>){const current=drag.current;if(!current||disabled)return;const at=point(event);if(!at)return;
  current.moved=current.moved||Math.hypot(at.x-current.startX,at.y-current.startY)>2;if(!current.moved)return;
  if(!current.started){onDragStart?.();current.started=true;}
  const next=current.mode==="rotate"?{...current.stone,rotation:stoneRotation(current.stone.rotation,(Math.atan2(at.y-current.stone.y,at.x-current.stone.x)-current.angle)*180/Math.PI,event.shiftKey)}:moveStone(current.stone,current.stone.x+at.x-current.startX,current.stone.y+at.y-current.startY);
  setMergeTarget(current.mode==="move"?stoneMergeTarget(stones,current.id,next.x,next.y)?.id??null:null);onChange?.(stones.map(stone=>stone.id===current.id?next:stone));
 }
 function end(cancelled=false){const current=drag.current;if(!current)return;drag.current=null;setMergeTarget(null);if(!cancelled&&current.moved&&current.mode==="move"){const stone=stones.find(item=>item.id===current.id);const target=stone&&stoneMergeTarget(stones,current.id,stone.x,stone.y);if(target)onMerge?.(current.id,target.id);else onChange?.(stones.map(stone=>stone.id===current.id?snapStone(stone,stones):stone));}onDragEnd?.();}
 function key(event:KeyboardEvent<SVGGElement>,stone:Stone){if(disabled)return;if(interactive&&event.key==="Enter"&&event.altKey&&selected.length===1&&selected[0]!==stone.id){event.preventDefault();onDragStart?.();onMerge?.(selected[0],stone.id);return;}if(["Enter"," "].includes(event.key)){event.preventDefault();onSelect?.(stone.id,event.shiftKey);return;}if(!interactive)return;const next=nudgeStone(stone,event.key,event.shiftKey);if(next!==stone){event.preventDefault();onDragStart?.();onSelect?.(stone.id,false);onChange?.(stones.map(item=>item.id===stone.id?next:item));onDragEnd?.();}}
 const top=interactive||!stones.length?0:Math.max(0,Math.min(...stones.map(stone=>{const size=stoneSize(stone.postIds.length),angle=stone.rotation*Math.PI/180;return stone.y-(Math.abs(Math.sin(angle))*size.width+Math.abs(Math.cos(angle))*size.height)/2;}))-12);
 return <svg ref={svg} onPointerMove={move} onPointerUp={()=>end()} onPointerCancel={()=>end(true)} onLostPointerCapture={event=>{if(event.target===svg.current)end(true);}} className={`stone-canvas${interactive?" is-editable":""}`} viewBox={`0 ${top} 1000 ${360-top}`} preserveAspectRatio={interactive?"xMidYMid meet":"xMidYMax meet"} role="group" aria-label={interactive?"돌 배치 영역. 돌을 선택하고 방향키로 이동할 수 있어요.":"기록으로 쌓은 돌"}>
  <path d="M30 344H970" stroke="var(--line)" strokeWidth="1"/>
  {stonePaintOrder(stones).map(stone=>{const {width,height}=stoneSize(stone.postIds.length),active=selected.includes(stone.id);return <g key={stone.id} role="button" tabIndex={disabled?-1:0} aria-label={`돌 · ${stone.postIds.length}개의 글`} aria-pressed={active} transform={`translate(${stone.x} ${stone.y}) rotate(${stone.rotation})`} className={`stone-piece${mergeTarget===stone.id?" is-merge-target":""}`} opacity={highlight&&!stone.postIds.some(id=>highlight.has(id))?.25:1} onPointerDown={event=>start(event,stone)} onClick={()=>!interactive&&!disabled&&onSelect?.(stone.id,false)} onKeyDown={event=>key(event,stone)}>
   <rect className="stone-outline" x={-width/2-4} y={-height/2-4} width={width+8} height={height+8} rx="10" fill="transparent" stroke={active||mergeTarget===stone.id?"var(--accent)":"transparent"} strokeWidth="2"/>
   {mergeTarget===stone.id&&<text y={-height/2-12} textAnchor="middle" fontSize="12" fill="var(--accent)">합치기</text>}
   <svg x={-width/2} y={-height/2} width={width} height={height} pointerEvents="none"><StoneShape seed={stone.postIds[0]} count={stone.postIds.length} shape={stone.shape}/></svg>
   {interactive&&active&&[[-1,-1],[1,-1],[-1,1],[1,1]].map(([dx,dy],index)=><rect key={index} className="stone-rotate-handle" x={dx*(width/2+4)-5} y={dy*(height/2+4)-5} width="10" height="10" rx="3" fill="white" stroke="var(--accent)" strokeWidth="2" onPointerDown={event=>start(event,stone,"rotate")}><title>모서리를 끌어 회전 · Shift로 15도씩</title></rect>)}
  </g>;})}
 </svg>;
}
