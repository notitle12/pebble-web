"use client";
import {useEffect,useRef,useState,type PointerEvent} from "react";
import {ContentManagement} from "@/features/content/components/content-management";
import Link from "next/link";
import {MemberGate} from "@/features/auth/components/member-gate";
import {userSession,type Member} from "@/features/auth/user-session";
import {MemberApiError} from "@/lib/member-api";
import {movePostRow} from "@/features/content/management-model";
import {parseOwnPost,parseOwnPosts,type OwnPostPage} from "../api/member-posts";
function Posts({member}:{member:Member}){
 const [page,setPage]=useState(0),[data,setData]=useState<OwnPostPage|null>(null),[error,setError]=useState(""),[attempt,setAttempt]=useState(0),[busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),[notice,setNotice]=useState(""),[drag,setDrag]=useState<{source:string;target:string}|null>(null);
 const focusAfterLoad=useRef<string|null>(null);
 const lock=useRef(false),mounted=useRef(false),dragging=useRef<{source:string;target:string}|null>(null);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const current=()=>mounted.current&&userSession.snapshot().phase==="ready"&&userSession.snapshot().member?.id===member.id;
 function refresh(){setData(null);setAttempt(n=>n+1);}
 useEffect(()=>{let live=true;setData(null);setError("");void userSession.request(`/members/me/posts?page=${page}&size=20`).then(value=>{if(live){setData(parseOwnPosts(value,page,member.id));setUncertain(false);}}).catch(e=>{if(live)setError(e instanceof Error?e.message:"목록을 불러오지 못했습니다.");});return()=>{live=false;};},[page,attempt,member.id]);
 useEffect(()=>{if(data&&!busy&&focusAfterLoad.current){document.querySelector<HTMLButtonElement>(`[data-post-id="${focusAfterLoad.current}"] .post-drag-handle`)?.focus();focusAfterLoad.current=null;}},[data,busy]);
 async function move(source:string,target:string){
  if(!data||lock.current||uncertain||!current())return;
  const change=movePostRow(data.content,source,target);if(!change)return;
  const before=data;lock.current=true;setBusy(true);setNotice("");setData({...data,content:change.items});
  try{
   const result=parseOwnPost(await userSession.request(`/posts/${source}`,{method:"PATCH",body:{displayOrder:change.displayOrder}}));
   if(result.id!==source||result.author.id!==member.id)throw new MemberApiError(0,"INVALID_RESPONSE","순서 저장 결과를 확인하지 못했어요.");
   if(current()){setNotice("글 순서를 저장했어요.");refresh();}
  }catch(e){if(current()){
   setData(before);const unknown=e instanceof MemberApiError&&(e.status===0||e.status>=500);setUncertain(unknown);
   setNotice(unknown?"저장 결과를 확인하지 못했어요. 목록을 다시 불러와 주세요.":e instanceof Error?e.message:"순서를 저장하지 못했어요.");
  }}finally{lock.current=false;if(mounted.current)setBusy(false);}
 }
 function endDrag(event:PointerEvent<HTMLButtonElement>){const active=dragging.current,target=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>('[data-post-id]')?.dataset.postId;dragging.current=null;setDrag(null);if(active&&target)void move(active.source,target);}
 return <section className="own-posts"><div className="list-heading"><h1>게시글 관리</h1><Link className="button" href="/posts/new">글 작성</Link></div><p className="own-posts-help">손잡이를 드래그해 글 순서를 바꿔 보세요. 키보드로는 손잡이에서 ↑ ↓를 누르면 돼요.</p>
 {notice&&<p role={uncertain?"alert":"status"} className="own-posts-notice">{notice}{uncertain&&<button className="button" onClick={refresh}>목록 다시 불러오기</button>}</p>}
 {error?<section className="list-state"><p role="alert">{error}</p><button className="button" onClick={refresh}>다시 불러오기</button></section>:!data?<p role="status">내 글을 불러오고 있어요.</p>:!data.content.length?<section className="list-state"><h2>아직 작성한 글이 없어요</h2><p>새 글을 작성하고 비공개로 저장해 보세요.</p></section>:<ul className="own-post-list" aria-label="게시글 순서" aria-busy={busy}>
 {data.content.map((post,index)=><li className="own-post-row" key={post.id} data-post-id={post.id} data-dragging={drag?.source===post.id} data-drop={drag&&drag.source!==post.id&&drag.target===post.id?(data.content.findIndex(p=>p.id===drag.source)<index?"after":"before"):undefined}>
 <button type="button" className="post-drag-handle" aria-label={`${post.title} 순서 이동`} disabled={busy||uncertain} onKeyDown={event=>{if(event.key!=="ArrowUp"&&event.key!=="ArrowDown")return;event.preventDefault();const target=data.content[index+(event.key==="ArrowUp"?-1:1)];if(target){focusAfterLoad.current=post.id;void move(post.id,target.id);}}} onPointerDown={event=>{if(event.button!==0||busy||uncertain)return;event.preventDefault();event.currentTarget.focus();event.currentTarget.setPointerCapture(event.pointerId);dragging.current={source:post.id,target:post.id};setDrag(dragging.current);}} onPointerMove={event=>{if(!dragging.current)return;const target=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>('[data-post-id]')?.dataset.postId;if(target&&data.content.some(p=>p.id===target)){dragging.current={...dragging.current,target};setDrag(dragging.current);}}} onPointerUp={endDrag} onPointerCancel={()=>{dragging.current=null;setDrag(null);}}><svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M7 5h.01M13 5h.01M7 10h.01M13 10h.01M7 15h.01M13 15h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg></button>
 <span className="own-post-order">{post.displayOrder+1}</span><span className="own-post-visibility">{post.visibilityStatus==="HIDDEN"?"비공개":"공개"}{post.isBlocked?" · 차단":""}</span><Link className="own-post-title" href={`/posts/${post.id}/edit`}>{post.title}</Link>
 <time className="own-post-date" dateTime={post.createdAt}>{new Intl.DateTimeFormat("ko-KR",{year:"numeric",month:"2-digit",day:"2-digit",timeZone:"Asia/Seoul"}).format(new Date(post.createdAt))}</time>
 <fieldset className="own-post-actions" disabled={busy}><Link href={`/posts/${post.id}/edit`}>수정</Link>{post.visibilityStatus==="PUBLIC"&&!post.isBlocked&&<Link href={`/blogs/${post.author.handle}/posts/${post.urlKey}`}>보기</Link>}<ContentManagement kind="posts" id={post.id} title={post.title} memberId={member.id} onChanged={refresh}/></fieldset>
 </li>)}</ul>}
 {data&&<nav className="pagination" aria-label="내 글 페이지"><button className="button" disabled={busy||!data.hasPrevious} onClick={()=>{setNotice("");setPage(n=>n-1);}}>이전</button><span>{page+1} / {Math.max(1,data.totalPages)}</span><button className="button" disabled={busy||!data.hasNext} onClick={()=>{setNotice("");setPage(n=>n+1);}}>다음</button></nav>}
 </section>;
}
export function MyPosts(){return <MemberGate>{member=><Posts key={member.id} member={member}/>}</MemberGate>;}
