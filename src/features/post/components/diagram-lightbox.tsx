"use client";
import {useEffect,useId,useRef,useState,type ReactNode} from "react";
export function DiagramLightbox({label,children,open:controlled,onOpenChange}:{label:string;children:()=>ReactNode;open?:boolean;onOpenChange?:(open:boolean)=>void}){
 const [localOpen,setLocalOpen]=useState(false);
 const open=controlled??localOpen,setOpen=onOpenChange??setLocalOpen;
 const ref=useRef<HTMLDialogElement>(null),titleId=useId();
 useEffect(()=>{const dialog=ref.current;if(open)dialog?.showModal();else if(dialog?.open)dialog.close();},[open]);
 return <><button type="button" className="button diagram-expand" onClick={()=>setOpen(true)}>{label} 확대 보기</button><dialog ref={ref} className="diagram-lightbox" aria-labelledby={titleId} onClose={()=>setOpen(false)} onClick={event=>{if(event.target===event.currentTarget)setOpen(false);}}><header><h2 id={titleId}>{label}</h2><button type="button" className="button" autoFocus onClick={()=>setOpen(false)}>닫기</button></header>{open&&children()}</dialog></>;
}
