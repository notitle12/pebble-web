"use client";
import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import {useUserSession} from "@/features/auth/components/member-gate";
import {openLoginDialog} from "@/features/auth/components/login-dialog";
import {memberRequiresAgreement,userSession,type SessionState} from "@/features/auth/user-session";
import {readLikes,writeLike,likeFailure,type LikeState,type LikeTarget} from "../api/likes";

export function LikePanel({target,contentId,initialCount}:{target:LikeTarget;contentId:string;initialCount?:number}){
  const session=useUserSession();
  const scope=session.phase==="ready"?`member:${session.member?.id}`:session.phase;
  return <Likes key={`${target}:${contentId}:${scope}`} target={target} contentId={contentId} initialCount={initialCount} session={session}/>;
}
function Likes({target,contentId,initialCount,session}:{target:LikeTarget;contentId:string;initialCount?:number;session:SessionState}){
  const [data,setData]=useState<LikeState|null>(null),[attempt,setAttempt]=useState(0),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const writing=useRef(false),mounted=useRef(false),revision=useRef(0);
  const ready=session.phase==="ready"&&session.member!==null;
  const canLike=ready&&!memberRequiresAgreement(session.member!);
  const [needsAgreement,setNeedsAgreement]=useState(false);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;revision.current++;};},[]);
  useEffect(()=>{
    if(session.phase!=="ready"&&session.phase!=="guest")return;
    let live=true;const current=++revision.current;setLoading(true);setError("");
    void readLikes(target,contentId,canLike?(path)=>userSession.request(path):undefined).then(next=>{if(live&&current===revision.current)setData(next);}).catch(e=>{if(live&&current===revision.current){setData(null);setError(likeFailure(e));}}).finally(()=>{if(live&&current===revision.current)setLoading(false);});
    return()=>{live=false;};
  },[target,contentId,attempt,canLike,session.phase]);
  function sameMember(id:string){const current=userSession.snapshot();return mounted.current&&current.phase==="ready"&&current.member?.id===id;}
  async function toggle(){
    if(!ready||!canLike){if(ready)setNeedsAgreement(true);return;}
    if(!data||loading||writing.current)return;
    const memberId=session.member!.id;const liked=!data.likedByMe;writing.current=true;revision.current++;setBusy(true);setError("");
    try{
      await writeLike(target,contentId,liked,(path,options)=>userSession.request(path,options));
      if(!sameMember(memberId))return;
      const next=await readLikes(target,contentId,(path)=>userSession.request(path));
      if(sameMember(memberId))setData(next);
    }catch(e){if(sameMember(memberId)){setData(null);setError(likeFailure(e));}}
    finally{writing.current=false;if(mounted.current)setBusy(false);}
  }
  function handleLikeClick(){
    if(ready&&!canLike){setNeedsAgreement(true);return;}
    if(!ready){openLoginDialog();return;}
    void toggle();
  }
  const count=error?undefined:data?.likeCount??initialCount;
  return <section className="like-panel" aria-label="좋아요">
    <div className="like-actions">
      <button type="button" className="button like-button" aria-label={canLike&&data?.likedByMe?"좋아요 취소":"좋아요"} aria-pressed={canLike?(data?.likedByMe??false):false} disabled={session.phase==="loading"||session.phase==="error"||canLike&&(busy||loading||!data)} onClick={handleLikeClick}><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 10H3v11h4V10Zm0 0 5-7a2 2 0 0 1 2 2l-1 5h6a2 2 0 0 1 2 2l-2 7a2 2 0 0 1-2 2H7V10Z"/></svg><span className="sr-only">{canLike&&data?.likedByMe?"좋아요 취소":"좋아요"}</span></button>
      <span aria-live="polite" aria-label="좋아요 수">{count===undefined?"—":count.toLocaleString("ko-KR")}</span>
    </div>
    {ready&&!canLike&&<p role="status">좋아요를 사용하려면 <Link href="/agreements">서비스 이용 동의</Link>가 필요합니다.{needsAgreement&&" 동의 화면으로 이동해 주세요."}</p>}
    {session.phase==="loading"?<p role="status">로그인 상태를 확인하고 있어요.</p>:session.phase==="error"?<p role="alert">{session.message}</p>:error?<div className="like-error"><p role="alert">{error}</p><button type="button" className="button" disabled={!['ready','guest'].includes(session.phase)} onClick={()=>{setData(null);setAttempt(value=>value+1);}}>다시 불러오기</button></div>:loading?<p role="status">좋아요 상태를 불러오는 중…</p>:null}
  </section>;
}
