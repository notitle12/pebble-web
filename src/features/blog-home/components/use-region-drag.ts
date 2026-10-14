"use client";
import {useRef,useState,type PointerEvent} from 'react';
export function useRegionDrag(attribute:'data-stack-name'|'data-home-section',disabled:boolean,onMove:(source:string,target:string)=>void){
 const pointer=useRef<{source:string;x:number;y:number;active:boolean}|null>(null);
 const [source,setSource]=useState<string|null>(null),[target,setTarget]=useState<string|null>(null);
 function at(event:PointerEvent<HTMLElement>){return document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>(`[${attribute}]`)?.getAttribute(attribute)??null;}
 function clear(){pointer.current=null;setSource(null);setTarget(null);}
 function props(id:string){return {
  onPointerDown(event:PointerEvent<HTMLElement>){if(disabled||event.button!==0||event.pointerType==='touch'||(event.target as Element).closest('button,a,input,select,textarea,label'))return;event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);pointer.current={source:id,x:event.clientX,y:event.clientY,active:false};},
  onPointerMove(event:PointerEvent<HTMLElement>){const start=pointer.current;if(!start||disabled)return;if(!start.active){if(Math.hypot(event.clientX-start.x,event.clientY-start.y)<5)return;start.active=true;setSource(start.source);}setTarget(at(event));},
  onPointerUp(event:PointerEvent<HTMLElement>){const start=pointer.current,to=at(event);clear();if(!disabled&&start?.active&&to&&start.source!==to)onMove(start.source,to);},
  onPointerCancel:clear,
  'data-dragging':source===id,'data-drop-target':target===id&&source!==id,
 };}
 return {props};
}
