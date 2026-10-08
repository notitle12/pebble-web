"use client";
import {useEffect,useRef,useState,useId} from "react";
import {useUserSession} from "@/features/auth/components/member-gate";
import {NaverLoginButton} from "@/features/auth/components/naver-login-button";
import {userSession,type SessionState} from "@/features/auth/user-session";
import {safeMediaUrl} from "@/features/media/model";
import { commentPageNumbers } from "../page-numbers";
import {commentFailure,commentInput,commentPath,parseComment,readComments,type Comment,type CommentPage,type CommentTarget,type CommentVisibility} from "../api/comments";
export function CommentsPanel({target,contentId}:{target:CommentTarget;contentId:string}) {
  const session=useUserSession();
  return <Comments key={`${target}:${contentId}:${session.member?.id??"guest"}`} target={target} contentId={contentId} session={session}/>;
}
function Comments({target,contentId,session}:{target:CommentTarget;contentId:string;session:SessionState}) {
  const uid=useId(),[page,setPage]=useState(0),[attempt,setAttempt]=useState(0);
  const [result,setResult]=useState<{scope:string;page:number;data:CommentPage}|null>(null),[loadError,setLoadError]=useState("");
  const [body,setBody]=useState(""),[visibility,setVisibility]=useState<CommentVisibility>("PUBLIC"),[editing,setEditing]=useState<Comment|null>(null);
  const [editBody,setEditBody]=useState(""),[editVisibility,setEditVisibility]=useState<CommentVisibility>("PUBLIC"),[deleting,setDeleting]=useState<string|null>(null);
  const [busy,setBusy]=useState(false),[notice,setNotice]=useState("");
  const writing=useRef(false),mounted=useRef(false);
  const ready=session.phase==="ready"&&session.member!==null;
  const scope=ready?`member:${session.member!.id}`:session.phase;
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useEffect(()=>{
    let live=true;setLoadError("");setResult(null);
    if(session.phase!=="ready"&&session.phase!=="guest")return;
    const request=ready?(path:string)=>userSession.request(path):undefined;
    void readComments(target,contentId,page,request,!ready).then(data=>{if(live)setResult({scope,page,data});}).catch(e=>{if(live)setLoadError(commentFailure(e));});
    return()=>{live=false;};
  },[target,contentId,page,attempt,scope,ready,session.phase]);
  const data=result?.scope===scope&&result.page===page?result.data:null;
  function stillSame(memberId:string) {const current=userSession.snapshot();return mounted.current&&current.phase==="ready"&&current.member?.id===memberId;}
  async function mutate(kind:"create"|"edit"|"delete",comment?:Comment) {
    if(!ready||writing.current)return;
    const memberId=session.member!.id;
    let input;
    try {if(kind!=="delete")input=commentInput(kind==="create"?body:editBody,kind==="create"?visibility:editVisibility);}catch(e){setNotice(commentFailure(e));return;}
    writing.current=true;setBusy(true);setNotice("");
    try {
      const value=await userSession.request(commentPath(target,contentId,kind==="create"?undefined:comment!.id),{method:kind==="create"?"POST":kind==="edit"?"PATCH":"DELETE",...(input?{body:input}:{})});
      if(!stillSame(memberId))return;
      if(kind!=="delete")parseComment(value);
      if(kind==="create"){setBody("");setVisibility("PUBLIC");setPage(Math.floor((data?.totalElements??0)/20));}
      if(kind==="edit")setEditing(null);
      if(kind==="delete"){setDeleting(null);if(data?.content.length===1&&page>0)setPage(n=>n-1);}
      setNotice(kind==="edit"?"댓글을 수정했습니다.":kind==="delete"?"댓글을 삭제했습니다.":"");setAttempt(n=>n+1);
    }catch(e){if(mounted.current)setNotice(commentFailure(e));}
    finally {writing.current=false;if(mounted.current)setBusy(false);}
  }
  const date=(value:string)=>new Intl.DateTimeFormat("ko-KR",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value));
  return <section className="comments-panel" aria-label="댓글">
    <div className="list-heading"><h2>댓글{data?` ${data.totalElements}`:""}</h2></div>
    {session.phase==="loading"?<p role="status">로그인 상태를 확인하고 있어요.</p>:session.phase==="error"?<p role="alert">{session.message}</p>:loadError?<div><p role="alert">{loadError}</p><button className="button" onClick={()=>setAttempt(n=>n+1)}>댓글 다시 불러오기</button></div>:!data?<p role="status">댓글을 불러오고 있어요.</p>:!data.content.length?<p>{page>0?"이 페이지에는 댓글이 없어요.":"아직 댓글이 없어요. 첫 의견을 남겨보세요."}</p>:<ul className="comment-list">{data.content.map(comment=>{
      const own=ready&&comment.author.id===session.member!.id;
      return <li key={comment.id}><div className="comment-meta"><strong>{comment.author.nickname}</strong><time dateTime={comment.createdAt}>{date(comment.createdAt)}</time>{comment.updatedAt!==comment.createdAt&&<span>수정됨</span>}{comment.visibility==="SECRET"&&<span className="comment-secret-badge"><svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4.5 7V4.75a3.5 3.5 0 0 1 7 0V7M3.25 7h9.5v7h-9.5z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M8 9.3v2.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg><span>비밀 댓글</span><span className="sr-only">자물쇠 표시</span></span>}</div>
        {own&&editing?.id===comment.id?<form onSubmit={e=>{e.preventDefault();void mutate("edit",comment);}}><label htmlFor={`${uid}-edit`}>댓글 수정</label><textarea id={`${uid}-edit`} value={editBody} onChange={e=>setEditBody(e.target.value)} disabled={busy} rows={4}/><p className="comment-count">{Array.from(editBody).length} / 2,000자</p><label className="comment-secret"><input type="checkbox" checked={editVisibility==="SECRET"} onChange={e=>setEditVisibility(e.target.checked?"SECRET":"PUBLIC")} disabled={busy}/>비밀 댓글</label><div className="comment-actions"><button className="button" disabled={busy}>수정 저장</button><button type="button" className="button" disabled={busy} onClick={()=>setEditing(null)}>수정 취소</button></div></form>:<p className="comment-body">{comment.body}</p>}
        {own&&editing?.id!==comment.id&&<div className="comment-actions">{deleting===comment.id?<><span>삭제하면 댓글 내용을 복구할 수 없어요.</span><button className="button" disabled={busy} onClick={()=>void mutate("delete",comment)}>댓글 삭제 확인</button><button className="button" disabled={busy} onClick={()=>setDeleting(null)}>삭제 취소</button></>:<><button className="button" disabled={busy} onClick={()=>{setEditing(comment);setEditBody(comment.body);setEditVisibility(comment.visibility);setDeleting(null);setNotice("");}}>수정</button><button className="button" disabled={busy} onClick={()=>{setDeleting(comment.id);setEditing(null);}}>삭제</button></>}</div>}
      </li>;
    })}</ul>}
    {data&&<nav className="comment-pagination" aria-label="댓글 페이지">
      <button type="button" aria-label="이전 댓글 페이지" disabled={busy||!data.hasPrevious} onClick={()=>{setPage(n=>n-1);setEditing(null);setDeleting(null);}}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12 5-5 5 5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
      {commentPageNumbers(page,data.totalPages).map(number=><button type="button" key={number} aria-label={`댓글 ${number+1}페이지`} aria-current={number===page?"page":undefined} disabled={busy} onClick={()=>{setPage(number);setEditing(null);setDeleting(null);}}>{number+1}</button>)}
      <button type="button" aria-label="다음 댓글 페이지" disabled={busy||!data.hasNext} onClick={()=>{setPage(n=>n+1);setEditing(null);setDeleting(null);}}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m8 5 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
    </nav>}
    {notice&&<p role="status">{notice}</p>}
    {ready?<form className="comment-form comment-composer" onSubmit={e=>{e.preventDefault();void mutate("create");}} aria-busy={busy}>
      <span className="comment-composer-avatar" aria-hidden="true">{safeMediaUrl(session.member!.profileImageUrl)?<img src={safeMediaUrl(session.member!.profileImageUrl)!} alt="" width={40} height={40}/>:Array.from(session.member!.nickname)[0]}</span>
      <div className="comment-composer-card">
        <strong className="comment-composer-name">{session.member!.nickname}</strong>
        <label className="sr-only" htmlFor={`${uid}-body`}>댓글 남기기</label>
        <textarea id={`${uid}-body`} aria-describedby={`${uid}-secret-help`} value={body} onChange={e=>setBody(e.target.value)} rows={3} disabled={busy} placeholder="이 기록에 대한 생각을 남겨주세요."/>
      </div>
      <div className="comment-composer-tools">
        <span className="comment-composer-meta" aria-live="polite">{visibility==="SECRET"?"비밀 댓글":"공개 댓글"}{body.length>0&&<span>{Array.from(body).length.toLocaleString()} / 2,000자</span>}</span>
        <div className="comment-composer-buttons">
          <button type="button" className="comment-composer-toggle" aria-label="비밀 댓글" aria-pressed={visibility==="SECRET"} aria-describedby={`${uid}-secret-help`} title={visibility==="SECRET"?"비밀 댓글 해제":"비밀 댓글로 작성"} disabled={busy} onClick={()=>setVisibility(v=>v==="SECRET"?"PUBLIC":"SECRET")}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="3" fill="none" stroke="currentColor" strokeWidth="1.7"/>{visibility==="SECRET"?<path d="M8 10V7a4 4 0 0 1 8 0v3"/>:<path d="M8 10V7a4 4 0 0 1 7.5-2"/>}<circle cx="12" cy="15" r="1" fill="currentColor"/></svg>
          </button>
          <button type="submit" className="comment-composer-send" aria-label={busy?"댓글 등록 중":"댓글 등록"} title="댓글 등록" disabled={busy||!body.trim()}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m20 4-6.7 16-3.6-6-6-3.6L20 4Z"/><path d="m9.7 14 5.8-5.5"/></svg></button>
        </div>
      </div>
      <p id={`${uid}-secret-help`} className="sr-only">비밀 댓글은 댓글 작성자와 콘텐츠 작성자, 관리자만 볼 수 있어요.</p>
    </form>:session.phase!=="loading"&&<div className="comment-login"><p>댓글을 남기려면 로그인해 주세요.</p><NaverLoginButton/></div>}
  </section>;
}
