"use client";
import dynamic from "next/dynamic";
import {useRouter} from "next/navigation";
import {createPortal} from "react-dom";
import {useEffect,useId,useRef,useState,type MouseEvent,type PointerEvent,type RefObject} from "react";
import {useUserSession} from "@/features/auth/components/member-gate";
import s from "./project-post-order-dialog.module.css";

const ProjectPostOrder=dynamic(()=>import("./project-post-order").then(module=>module.ProjectPostOrder),{
 loading:()=> <p role="status">관련 게시글 순서 편집기를 불러오고 있어요.</p>,
});

export function ProjectPostOrderDialog({projectId,ownerId,empty=false}:{projectId:string;ownerId:string;empty?:boolean}){
 const {phase,member}=useUserSession();
 const [open,setOpen]=useState(false);
 const trigger=useRef<HTMLButtonElement>(null);
 const authorized=phase==="ready"&&member?.id===ownerId;
 useEffect(()=>{if(!authorized)setOpen(false);},[authorized,member?.id]);
 if(!authorized)return null;
 const control=<><button ref={trigger} type="button" className={s.trigger} onClick={()=>setOpen(true)}>순서 편집</button>
  {open&&<OrderDialog key={`${projectId}:${member.id}`} projectId={projectId} memberId={member.id} trigger={trigger} onClose={()=>setOpen(false)}/>}</>;
 if(empty)return <section className="related-posts" aria-label="프로젝트 관련 게시글"><div className="list-heading"><h2>관련 게시글</h2>{control}</div><p className={s.empty}>아직 연결된 공개 글이 없어요.</p></section>;
 return control;
}

function OrderDialog({projectId,memberId,trigger,onClose}:{projectId:string;memberId:string;trigger:RefObject<HTMLButtonElement|null>;onClose:()=>void}){
 const router=useRouter();
 const dialog=useRef<HTMLDialogElement>(null);
 const heading=useId();
 const backdropPressed=useRef(false);
 const [busy,setBusy]=useState(false);
 useEffect(()=>{
  const element=dialog.current,opener=trigger.current;
  element?.showModal();
  const originalOverflow=document.body.style.overflow;
  document.body.style.overflow="hidden";
  return()=>{
   element?.close();
   document.body.style.overflow=originalOverflow;
   if(opener?.isConnected)opener.focus();
  };
 },[trigger]);
 function close(){if(!busy){onClose();router.refresh();}}
 function outside(event:PointerEvent<HTMLDialogElement>|MouseEvent<HTMLDialogElement>){
  const rect=event.currentTarget.getBoundingClientRect();
  return event.target===event.currentTarget&&(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom);
 }
 return createPortal(<dialog ref={dialog} className={s.dialog} aria-labelledby={heading}
  onCancel={event=>{event.preventDefault();close();}}
  onPointerDown={event=>{backdropPressed.current=outside(event);}}
  onClick={event=>{if(backdropPressed.current&&outside(event))close();backdropPressed.current=false;}}>
  <div className={s.header}><h2 id={heading}>관련 게시글 순서 편집</h2><button type="button" className={s.close} aria-label="관련 게시글 순서 편집 닫기" disabled={busy} autoFocus onClick={close}>×</button></div>
  <div className={s.body}><ProjectPostOrder projectId={projectId} memberId={memberId} onSaved={()=>router.refresh()} onBusyChange={setBusy}/></div>
 </dialog>,document.body);
}
