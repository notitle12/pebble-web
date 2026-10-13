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
 const lock=useRef(false),mounted=useRef(false),dragging=useRef<{source:string;target:string;x:number;y:number;active:boolean}|null>(null);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const current=()=>mounted.current&&userSession.snapshot().phase==="ready"&&userSession.snapshot().member?.id===member.id;
 function refresh(){setData(null);setAttempt(n=>n+1);}
 useEffect(()=>{let live=true;setData(null);setError("");void userSession.request(`/members/me/posts?page=${page}&size=20`).then(value=>{if(live){setData(parseOwnPosts(value,page,member.id));setUncertain(false);}}).catch(e=>{if(live)setError(e instanceof Error?e.message:"목록을 불러오지 못했습니다.");});return()=>{live=false;};},[page,attempt,member.id]);
 async function move(source:string,target:string){
  if(!data||lock.current||uncertain||!current())return;
  const change=movePostRow(data.content,source,target);if(!change)return;
  const before=data;lock.current=true;setBusy(true);setNotice("");setData({...data,content:change.items});
  try{
   const result=parseOwnPost(await userSession.request(`/posts/${source}`,{method:"PATCH",body:{displayOrder:change.displayOrder}}));
   if(result.id!==source||result.author.id!==member.id)throw new MemberApiError(0,"INVALID_RESPONSE","순서 저장 결과를 확인하지 못했어요.");
   if(current()){setNotice("글 순서를 저장했어요.");refresh();}
  }catch(e){if(current()){
   setData(before);const unknown=!(e instanceof MemberApiError)||e.status===0||e.status>=500;setUncertain(unknown);
   setNotice(unknown?"저장 결과를 확인하지 못했어요. 목록을 다시 불러와 주세요.":e instanceof Error?e.message:"순서를 저장하지 못했어요.");
  }}finally{lock.current=false;if(mounted.current)setBusy(false);}
 }
 async function toggleVisibility(post:OwnPostPage["content"][number]){
  if(!data||lock.current||uncertain||post.draft||post.isBlocked||!current())return;
  const next=post.visibilityStatus==="PUBLIC"?"HIDDEN":"PUBLIC",before=data;
  lock.current=true;setBusy(true);setNotice("");setData({...data,content:data.content.map(row=>row.id===post.id?{...row,visibilityStatus:next}:row)});
  try{
   const result=parseOwnPost(await userSession.request(`/posts/${post.id}`,{method:"PATCH",body:{visibilityStatus:next}}));
   if(result.id!==post.id||result.author.id!==member.id||result.visibilityStatus!==next)throw new MemberApiError(0,"INVALID_RESPONSE","공개 상태 저장 결과를 확인하지 못했어요.");
   if(current())setNotice(next==="PUBLIC"?"글을 공개했어요.":"글을 비공개로 바꿨어요.");
  }catch(e){if(current()){setData(before);const unknown=!(e instanceof MemberApiError)||e.status===0||e.status>=500;setUncertain(unknown);setNotice(unknown?"저장 결과를 확인하지 못했어요. 목록을 다시 불러와 주세요.":e instanceof Error?e.message:"공개 상태를 바꾸지 못했어요.");}}
  finally{lock.current=false;if(mounted.current)setBusy(false);}
 }
 function endDrag(event:PointerEvent<HTMLLIElement>){const active=dragging.current,target=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>('[data-post-id]')?.dataset.postId;dragging.current=null;setDrag(null);if(active?.active&&target)void move(active.source,target);}
 return <section className="own-posts"><div className="list-heading"><h1>게시글 관리</h1><Link className="button" href="/posts/new">글 작성</Link></div><p className="own-posts-help">글 행을 드래그해 순서를 바꾸고, 공개·비공개를 눌러 공개 범위를 변경하세요.</p>
 {notice&&<p role={uncertain?"alert":"status"} className="own-posts-notice">{notice}{uncertain&&<button className="button" onClick={refresh}>목록 다시 불러오기</button>}</p>}
 {error?<section className="list-state"><p role="alert">{error}</p><button className="button" onClick={refresh}>다시 불러오기</button></section>:!data?<p role="status">내 글을 불러오고 있어요.</p>:!data.content.length?<section className="list-state"><h2>아직 작성한 글이 없어요</h2><p>새 글을 작성하고 비공개로 저장해 보세요.</p></section>:<ul className="own-post-list" aria-label="게시글 순서" aria-busy={busy}>
 {data.content.map((post,index)=><li className="own-post-row" key={post.id} data-post-id={post.id} onPointerDown={event=>{if(event.button!==0||event.pointerType==="touch"||busy||uncertain||(event.target as Element).closest("button,a,input,select,textarea,form,[role=group]"))return;event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);dragging.current={source:post.id,target:post.id,x:event.clientX,y:event.clientY,active:false};}} onPointerMove={event=>{const start=dragging.current;if(!start)return;if(!start.active){if(Math.hypot(event.clientX-start.x,event.clientY-start.y)<5)return;start.active=true;}const target=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>('[data-post-id]')?.dataset.postId;start.target=target??start.source;setDrag({source:start.source,target:start.target});}} onPointerUp={endDrag} onPointerCancel={()=>{dragging.current=null;setDrag(null);}} data-dragging={drag?.source===post.id} data-drop={drag&&drag.source!==post.id&&drag.target===post.id?(data.content.findIndex(p=>p.id===drag.source)<index?"after":"before"):undefined}>
 <span className="own-post-order">{post.displayOrder+1}</span><button type="button" className="own-post-visibility" disabled={busy||uncertain||post.isBlocked||post.draft===true} title={post.draft?"임시저장 글은 수정 화면에서 발행해 주세요.":post.isBlocked?"차단된 글은 공개 범위를 변경할 수 없어요.":"클릭하여 공개 범위 변경"} aria-label={`${post.title}: ${post.visibilityStatus==="PUBLIC"?"공개, 비공개로 변경":"비공개, 공개로 변경"}`} onClick={()=>void toggleVisibility(post)}>{post.draft?"임시저장":post.visibilityStatus==="HIDDEN"?"비공개":"공개"}{post.isBlocked?" · 차단":""}</button><span className="own-post-title">{post.title}</span>
 <time className="own-post-date" dateTime={post.createdAt}>{new Intl.DateTimeFormat("ko-KR",{year:"numeric",month:"2-digit",day:"2-digit",timeZone:"Asia/Seoul"}).format(new Date(post.createdAt))}</time>
 <fieldset className="own-post-actions" disabled={busy}><Link href={`/posts/${post.id}/edit`}>수정</Link>{post.visibilityStatus==="PUBLIC"&&!post.isBlocked&&<Link href={`/blogs/${post.author.handle}/posts/${post.urlKey}`}>보기</Link>}<ContentManagement kind="posts" id={post.id} title={post.title} memberId={member.id} onChanged={refresh}/></fieldset>
 </li>)}</ul>}
 {data&&<nav className="pagination" aria-label="내 글 페이지"><button className="button" disabled={busy||!data.hasPrevious} onClick={()=>{setNotice("");setPage(n=>n-1);}}>이전</button><span>{page+1} / {Math.max(1,data.totalPages)}</span><button className="button" disabled={busy||!data.hasNext} onClick={()=>{setNotice("");setPage(n=>n+1);}}>다음</button></nav>}
 </section>;
}
export function MyPosts(){return <MemberGate>{member=><Posts key={member.id} member={member}/>}</MemberGate>;}
