"use client";
import {useEffect,useId,useRef,useState} from "react";
import styles from "./content-management.module.css";
import {userSession} from "@/features/auth/user-session";
import {parseOwnPost} from "@/features/post/api/member-posts";
import {MemberApiError} from "@/lib/member-api";
import {contentPath,postPosition,confirmDeletion} from "../management-model";
type Props={kind:"posts"|"projects";id:string;title:string;memberId:string;position?:number;total?:number;onChanged:()=>void;onDelete?:()=>Promise<void>};
export function ContentManagement({kind,id,title,memberId,position,total,onChanged,onDelete}:Props) {
  const [confirm,setConfirm]=useState(false),[order,setOrder]=useState(String((position??0)+1)),[busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),[message,setMessage]=useState("");
  const lock=useRef(false),mounted=useRef(false),dialog=useRef<HTMLDialogElement>(null),titleId=useId();
  useEffect(()=>{const node=dialog.current;if(confirm)node?.showModal();else if(node?.open)node.close();},[confirm]);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const current=()=>mounted.current&&userSession.snapshot().phase==="ready"&&userSession.snapshot().member?.id===memberId;
  async function change(remove:boolean) {
    if(lock.current||uncertain||!current())return;
    lock.current=true;setBusy(true);setMessage("");
    try {
      const path=contentPath(kind,id);
      if(remove&&onDelete){await onDelete();return;}
      if(remove)confirmDeletion(await userSession.request(path,{method:"DELETE"}));
      else {
        const displayOrder=postPosition(order,total??0);
        const result=parseOwnPost(await userSession.request(path,{method:"PATCH",body:{displayOrder}}));
        if(result.id!==id||result.author.id!==memberId)throw new MemberApiError(0,"INVALID_RESPONSE","순서 저장 결과를 확인하지 못했습니다.");
      }
      if(current())onChanged();
    }catch(error){if(current()){
      const unknown=error instanceof MemberApiError&&(error.status===0||error.status>=500);
      setUncertain(unknown);setMessage(unknown?"처리 결과를 확인하지 못했어요. 다시 요청하기 전에 목록을 새로 불러와 주세요.":error instanceof Error?error.message:"처리하지 못했습니다.");
    }}finally{lock.current=false;if(mounted.current)setBusy(false);}
  }
  return <div className="content-management">
    {kind==="posts"&&position!==undefined&&total!==undefined&&<form onSubmit={e=>{e.preventDefault();void change(false);}}><label>글 순서 (1~{total})<input type="number" min="1" max={total} step="1" value={order} onChange={e=>setOrder(e.target.value)} disabled={busy||uncertain}/></label><button className="button" disabled={busy||uncertain||order===String(position+1)}>순서 저장</button><p>공개·비공개를 포함한 내 전체 글의 순서입니다.</p></form>}
    <button className="button" disabled={busy||uncertain} onClick={()=>setConfirm(true)}>삭제</button>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId} onCancel={e=>{if(busy)e.preventDefault();else setConfirm(false);}} onClose={()=>setConfirm(false)}>
     <h2 id={titleId}>삭제하시겠습니까?</h2><p>“{title}”을 삭제합니다. 삭제한 콘텐츠는 복구할 수 없습니다.{kind==="projects"&&" 연결된 글은 유지되며 프로젝트 연결만 해제됩니다."}</p>
     {message&&<p role="alert">{message}</p>}{uncertain&&<button className="button" onClick={()=>{setConfirm(false);onChanged();}}>목록 새로 불러오기</button>}
     <div className={styles.actions}><button className="button" autoFocus disabled={busy} onClick={()=>setConfirm(false)}>취소</button><button className="button" disabled={busy||uncertain} onClick={()=>void change(true)}>{busy?"처리 중…":"삭제"}</button></div>
    </dialog>
    {!confirm&&message&&<p role="alert">{message}</p>}{!confirm&&uncertain&&<button className="button" onClick={onChanged}>목록 새로 불러오기</button>}
  </div>;
}
