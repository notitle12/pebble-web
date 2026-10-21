"use client";
import {useEffect,useId,useRef,useState,type ReactNode} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {LoadingIndicator} from "@/components/loading-state";
import styles from "./writer-logout-boundary.module.css";
import {userSession} from "../user-session";

type RequestLogout=(hasChanges:boolean,memberId:string)=>void;
export function WriterLogoutBoundary({children}:{children:(requestLogout:RequestLogout)=>ReactNode}) {
 const router=useRouter(),lock=useRef(false),target=useRef("");
 const [leaving,setLeaving]=useState(false),[error,setError]=useState("");
 const [confirming,setConfirming]=useState(false);
 const dialog=useRef<HTMLDialogElement>(null),titleId=useId();
 useEffect(()=>{
  const node=dialog.current;
  if(confirming&&!leaving)node?.showModal();
  else if(node?.open)node.close();
 },[confirming,leaving]);
 function startLogout(){
  const session=userSession.snapshot();
  if(session.phase!=="ready"||session.member?.id!==target.current){setConfirming(false);return;}
  setConfirming(false);setLeaving(true);
  void finishLogout();
 }
 async function finishLogout(){
  if(lock.current)return;
  const before=userSession.snapshot();
  if(before.phase==="ready"&&before.member?.id!==target.current){router.replace("/");return;}
  lock.current=true;setError("");
  try {
   await userSession.logout();
   const next=userSession.snapshot();
   if(next.phase==="guest")setLeaving(false);
   else if(next.phase==="ready"&&next.member?.id!==target.current)router.replace("/");
   else setError(next.message||"로그아웃 완료를 확인하지 못했습니다. 다시 시도해 주세요.");
  } catch {setError("로그아웃 완료를 확인하지 못했습니다. 다시 시도해 주세요.");}
  finally{lock.current=false;}
 }
 function requestLogout(hasChanges:boolean,memberId:string){
  if(lock.current||leaving)return;
  const session=userSession.snapshot();
  if(session.phase!=="ready"||session.member?.id!==memberId)return;
  target.current=memberId;
  if(hasChanges)setConfirming(true);
  else startLogout();
 }
 if(leaving)return error?<section className="list-state"><h1>로그아웃 상태를 확인해 주세요</h1><p role="alert">{error}</p><button className="button" onClick={()=>void finishLogout()}>로그아웃 다시 시도</button><Link className="button" href="/">메인으로</Link></section>:<LoadingIndicator section label="로그아웃하는 중"/>;
 return <>{children(requestLogout)}<dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId} onCancel={()=>setConfirming(false)} onClose={()=>setConfirming(false)}>
  <h2 id={titleId}>작성 중인 내용이 있습니다</h2>
  <p>저장하지 않은 내용은 사라질 수 있습니다. 로그아웃하시겠어요?</p>
  <div className={styles.actions}><button className="button" autoFocus onClick={()=>setConfirming(false)}>계속 작성</button><button className="button" onClick={startLogout}>로그아웃</button></div>
 </dialog></>;
}
