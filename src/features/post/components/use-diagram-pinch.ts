"use client";
import {useEffect,useLayoutEffect,useRef,type RefObject} from 'react';
import {beginDiagramPinch,moveDiagramPinch,type PinchStart} from '../diagram-pinch';
type Options={enabled:boolean;zoom:number;padding:number;nextPadding:number;onZoom:(zoom:number)=>void;onStart:()=>void};
/** Own only two-finger gestures; ordinary inline page scrolling stays native. */
export function useDiagramPinch(ref:RefObject<HTMLElement|null>,options:Options){
 const latest=useRef(options),pending=useRef<ReturnType<typeof moveDiagramPinch>|null>(null);
 useLayoutEffect(()=>{
  latest.current=options;
  const next=pending.current,view=ref.current;
  if(next&&view&&Math.abs(options.zoom-next.zoom)<1e-8){view.scrollLeft=next.left;view.scrollTop=next.top;pending.current=null;}
 });
 useEffect(()=>{
  const view=ref.current;if(!options.enabled||!view)return;
  let start:PinchStart|null=null,owned=false,suppressUntil=0;
  const points=(event:TouchEvent)=>{const r=view.getBoundingClientRect();return Array.from(event.touches).map(t=>({x:t.clientX-r.left,y:t.clientY-r.top}));};
  const consume=(event:Event)=>{if(event.cancelable)event.preventDefault();event.stopPropagation();};
  const begin=(event:TouchEvent)=>{
   if(event.touches.length!==2||owned)return;
   const [a,b]=points(event),o=latest.current;
   start=beginDiagramPinch(a,b,o.zoom,view.scrollLeft,view.scrollTop,o.padding);
   if(!start)return;
   owned=true;consume(event);o.onStart();
  };
  const move=(event:TouchEvent)=>{
   if(!owned)return;consume(event);
   if(!start||event.touches.length!==2){start=null;return;}
   const [a,b]=points(event),o=latest.current,next=moveDiagramPinch(start,a,b,o.nextPadding);
   if(Math.abs(next.zoom-o.zoom)<1e-8){view.scrollLeft=next.left;view.scrollTop=next.top;}
   else {pending.current=next;o.onZoom(next.zoom);}
  };
  const end=(event:TouchEvent)=>{
   if(!owned)return;consume(event);start=null;suppressUntil=Date.now()+500;
   // Do not turn the remaining finger into a fresh pan until all fingers lift.
   if(event.touches.length===0)owned=false;
  };
  const click=(event:MouseEvent)=>{if(owned||Date.now()<suppressUntil)consume(event);};
  const reset=()=>{owned=false;start=null;pending.current=null;};
  const listener={capture:true,passive:false};
  window.addEventListener('blur',reset);
  view.addEventListener('touchstart',begin,listener);view.addEventListener('touchmove',move,listener);
  view.addEventListener('touchend',end,listener);view.addEventListener('touchcancel',end,listener);
  view.addEventListener('click',click,true);
  return()=>{window.removeEventListener('blur',reset);view.removeEventListener('touchstart',begin,true);view.removeEventListener('touchmove',move,true);
   view.removeEventListener('touchend',end,true);view.removeEventListener('touchcancel',end,true);view.removeEventListener('click',click,true);pending.current=null;};
 },[ref,options.enabled]);
}
