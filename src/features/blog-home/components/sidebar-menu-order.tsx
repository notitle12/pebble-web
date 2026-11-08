"use client";
import {useEffect,useId,useRef,useState,type KeyboardEvent,type PointerEvent} from "react";
import {reorderSidebarMenu,sidebarMenuLabels,type SidebarMenuKey} from "../sidebar-order";
import s from "./sidebar-menu-order.module.css";
type Drag={source:SidebarMenuKey;gap:number;y:number;active:boolean;mode:"pointer"|"keyboard"};
export function SidebarMenuOrder({order,disabled,onChange}:{order:SidebarMenuKey[];disabled:boolean;onChange:(next:SidebarMenuKey[])=>void}){
 const root=useRef<HTMLOListElement>(null),drag=useRef<Drag|null>(null),focus=useRef<SidebarMenuKey|null>(null),help=useId();
 const [preview,setPreview]=useState<{source:SidebarMenuKey;gap:number}|null>(null);
 function cancel(){drag.current=null;setPreview(null);}
 useEffect(()=>{if(disabled)cancel();else if(focus.current){root.current?.querySelector<HTMLButtonElement>(`[data-menu-key="${focus.current}"] button`)?.focus({preventScroll:true});focus.current=null;}},[disabled,order]);
 function commit(){const d=drag.current;cancel();if(!d?.active)return;const next=reorderSidebarMenu(order,d.source,d.gap);if(next!==order){focus.current=d.source;onChange(next);}}
 function hit(event:PointerEvent<HTMLElement>){const row=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>("[data-menu-key]");if(!row||!root.current?.contains(row))return -1;const rect=row.getBoundingClientRect();return order.indexOf(row.dataset.menuKey as SidebarMenuKey)+(event.clientY>rect.top+rect.height/2?1:0);}
 function key(event:KeyboardEvent<HTMLButtonElement>,source:SidebarMenuKey){if(disabled)return;const d=drag.current;
  if(event.key==="Escape"){if(d){event.preventDefault();cancel();}return;}
  if(event.key===" "||event.key==="Enter"){event.preventDefault();if(d){commit();return;}drag.current={source,gap:order.indexOf(source),y:0,active:true,mode:"keyboard"};setPreview(drag.current);}
  else if(d?.mode==="keyboard"&&["ArrowUp","ArrowDown"].includes(event.key)){event.preventDefault();const from=order.indexOf(d.source),current=d.gap>from?d.gap-1:d.gap,target=Math.max(0,Math.min(order.length-1,current+(event.key==="ArrowUp"?-1:1)));d.gap=target>from?target+1:target;setPreview({...d});}
  else if(event.key==="Tab")cancel();
 }
 return <><p id={help}>홈은 맨 위에 고정됩니다. 손잡이를 드래그해 메뉴 순서를 바꾸세요.</p><ol ref={root} className={s.list} aria-label="사이드바 메뉴 순서">
  <li className={s.fixed}><svg aria-hidden="true" viewBox="0 0 20 20"><rect x="5" y="9" width="10" height="8" rx="2"/><path d="M7 9V6a3 3 0 0 1 6 0v3"/></svg><span>홈</span><small>고정</small></li>
  {order.map((item,index)=><li key={item} data-menu-key={item} data-dragging={preview?.source===item} data-drop={preview?.gap===index?"before":preview?.gap===order.length&&index===order.length-1?"after":undefined}
   onPointerDown={event=>{if(disabled||event.button!==0||!(event.target as Element).closest("button"))return;event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);drag.current={source:item,gap:index,y:event.clientY,active:false,mode:"pointer"};}}
   onPointerMove={event=>{const d=drag.current;if(!d||d.mode!=="pointer")return;if(!d.active&&Math.abs(event.clientY-d.y)>=4)d.active=true;if(d.active){event.preventDefault();d.gap=hit(event);setPreview({...d});}}}
   onPointerUp={event=>{const d=drag.current;if(d?.mode!=="pointer")return;d.gap=hit(event);commit();if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}}
   onPointerCancel={cancel} onLostPointerCapture={()=>{if(drag.current?.mode==="pointer")cancel();}}>
   <button type="button" className={s.handle} disabled={disabled} aria-label={`${sidebarMenuLabels[item]} 메뉴 순서 이동`} aria-describedby={help} aria-pressed={preview?.source===item} onKeyDown={event=>key(event,item)} onBlur={()=>{if(drag.current?.mode==="keyboard")cancel();}}><svg aria-hidden="true" viewBox="0 0 20 20"><path d="M7 5h.01M13 5h.01M7 10h.01M13 10h.01M7 15h.01M13 15h.01"/></svg></button><span>{sidebarMenuLabels[item]}</span>
  </li>)}
 </ol><p className={s.help}>키보드는 Space로 잡고 방향키로 이동한 뒤 Enter로 놓습니다. Escape로 취소합니다.</p></>;
}
