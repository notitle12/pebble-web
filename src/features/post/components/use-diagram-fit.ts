"use client";
import {useLayoutEffect,useState,type RefObject} from "react";
import {diagramFitScale} from "../diagram-viewport";
/** Fit read-only diagrams without creating an inner scroll trap. */
export function useDiagramFit(ref:RefObject<HTMLElement|null>,width:number,height:number,expanded:boolean,enabled=true,fixedFrame=false){
 const [scale,setScale]=useState(1);
 useLayoutEffect(()=>{
  const viewport=ref.current;if(!enabled||!viewport)return;
  const measure=()=>{const available=viewport.clientWidth;if(available>0)setScale(diagramFitScale(width,height,available,fixedFrame?viewport.clientHeight:(expanded?window.innerHeight*.65:420),expanded?48:0));};
  measure();const observer=new ResizeObserver(measure);observer.observe(viewport);window.addEventListener("resize",measure);
  return()=>{observer.disconnect();window.removeEventListener("resize",measure);};
 },[ref,width,height,expanded,enabled,fixedFrame]);
 return scale;
}
