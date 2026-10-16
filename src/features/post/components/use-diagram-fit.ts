"use client";
import {useLayoutEffect,useState,type RefObject} from "react";
/** Fit read-only diagrams without creating an inner scroll trap. */
export function useDiagramFit(ref:RefObject<HTMLElement|null>,width:number,height:number,expanded:boolean,enabled=true){
 const [scale,setScale]=useState(1);
 useLayoutEffect(()=>{
  const viewport=ref.current;if(!enabled||!viewport)return;
  const measure=()=>{const available=viewport.clientWidth;if(available>0)setScale(Math.min(1,available/width,(expanded?window.innerHeight*.65:420)/height));};
  measure();const observer=new ResizeObserver(measure);observer.observe(viewport);window.addEventListener("resize",measure);
  return()=>{observer.disconnect();window.removeEventListener("resize",measure);};
 },[ref,width,height,expanded,enabled]);
 return scale;
}
