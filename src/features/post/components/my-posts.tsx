"use client";
import {useEffect,useId,useRef,useState,type PointerEvent} from "react";
import {deleteSelectedContent} from "@/features/content/bulk-delete";
import dialogStyles from "@/features/content/components/content-management.module.css";
import {ContentManagement} from "@/features/content/components/content-management";
import Link from "next/link";
import {MemberGate} from "@/features/auth/components/member-gate";
import {ProtectedActionLink} from "@/features/auth/components/protected-action-link";
import {userSession,type Member} from "@/features/auth/user-session";
import {parseBoards,flattenBoards,type Board} from "@/features/board/api/boards";
import {MemberApiError} from "@/lib/member-api";
import {movePostRow,removeManagedRow,confirmDeletion} from "@/features/content/management-model";
import {parseOwnPost,parseOwnPosts,type OwnPostPage} from "../api/member-posts";
function Posts({member}:{member:Member}){
 const [page,setPage]=useState(0),[data,setData]=useState<OwnPostPage|null>(null),[error,setError]=useState(""),[attempt,setAttempt]=useState(0),[busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),[notice,setNotice]=useState(""),[drag,setDrag]=useState<{source:string;target:string}|null>(null);
 const [boardId,setBoardId]=useState(""),[boards,setBoards]=useState<Board[]>([]),[boardError,setBoardError]=useState(""),[boardAttempt,setBoardAttempt]=useState(0);
 const [selected,setSelected]=useState<string[]>([]),[confirmBulk,setConfirmBulk]=useState(false);
 const bulkDialog=useRef<HTMLDialogElement>(null),selectAll=useRef<HTMLInputElement>(null),bulkTitle=useId();
 const selectedRows=data?.content.filter(post=>selected.includes(post.id))??[];
 useEffect(()=>{setSelected([]);setConfirmBulk(false);},[page,boardId]);
 useEffect(()=>{if(selectAll.current)selectAll.current.indeterminate=selectedRows.length>0&&selectedRows.length!==(data?.content.length??0);},[selectedRows.length,data]);
 useEffect(()=>{const dialog=bulkDialog.current;if(confirmBulk)dialog?.showModal();else if(dialog?.open)dialog.close();},[confirmBulk]);
 const syncedPage=useRef<number|null>(null),lock=useRef(false),mounted=useRef(false),dragging=useRef<{source:string;target:string;x:number;y:number;active:boolean}|null>(null);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const current=()=>mounted.current&&userSession.snapshot().phase==="ready"&&userSession.snapshot().member?.id===member.id;
 function refresh(){setSelected([]);setData(null);setNotice("");if(data&&page>=data.totalPages)setPage(Math.max(0,data.totalPages-1));setAttempt(n=>n+1);}
 useEffect(()=>{let live=true;setBoardError("");void userSession.request("/members/me/boards").then(value=>{if(live)setBoards(parseBoards(value,true));}).catch(e=>{if(live)setBoardError(e instanceof Error?e.message:"게시판을 불러오지 못했어요.");});return()=>{live=false;};},[member.id,boardAttempt]);
 useEffect(()=>{if(syncedPage.current===page){syncedPage.current=null;return;}let live=true;setData(null);setError("");void userSession.request(`/members/me/posts?page=${page}&size=20${boardId?`&boardId=${encodeURIComponent(boardId)}`:""}`).then(value=>{if(live){setData(parseOwnPosts(value,page,member.id,boardId||undefined));setUncertain(false);}}).catch(e=>{if(live)setError(e instanceof Error?e.message:"목록을 불러오지 못했습니다.");});return()=>{live=false;};},[page,attempt,member.id,boardId]);

 async function synchronize(targetPage=page){
  const value=await userSession.request(`/members/me/posts?page=${targetPage}&size=20${boardId?`&boardId=${encodeURIComponent(boardId)}`:""}`),next=parseOwnPosts(value,targetPage,member.id,boardId||undefined);
  if(current()){setData(next);if(targetPage!==page){syncedPage.current=targetPage;setPage(targetPage);}}
  return next;
 }
 async function removeRow(row:OwnPostPage['content'][number]){
  if(!data||lock.current||uncertain||!current())return;
  const before=data,next=removeManagedRow(data,row.id);let saved=false;
  lock.current=true;setBusy(true);setNotice("");setData(next);
  try{
   confirmDeletion(await userSession.request(`/posts/${row.id}`,{method:"DELETE"}));saved=true;
   if(current()&&(before.hasNext||!next.content.length&&page>0))await synchronize(Math.max(0,Math.min(page,next.totalPages-1)));
  }catch(e){if(current()){
   if(!saved)setData(before);
   const unknown=saved||!(e instanceof MemberApiError)||e.status===0||e.status>=500;setUncertain(unknown);
   setNotice(saved?"삭제는 완료됐지만 목록을 확인하지 못했어요. 목록을 다시 불러와 주세요.":unknown?"삭제 결과를 확인하지 못했어요. 목록을 다시 불러와 주세요.":e instanceof Error?e.message:"삭제하지 못했어요.");
  }}finally{lock.current=false;if(mounted.current)setBusy(false);}
 }
 async function removeSelected(){
  if(!data||!selectedRows.length||lock.current||uncertain||!current())return;
  const before=data,ids=selectedRows.map(post=>post.id);
  lock.current=true;setBusy(true);setNotice("");setConfirmBulk(false);
  setData(ids.reduce((next,id)=>removeManagedRow(next,id),before));
  try{
   const result=await deleteSelectedContent("posts",ids,(path,options)=>userSession.request(path,options),current);
   if(!current())return;
   const confirmed=result.deleted.reduce((next,id)=>removeManagedRow(next,id),before);
   setData(confirmed);setSelected([]);
   const unknown=result.error!==undefined&&(!(result.error instanceof MemberApiError)||result.error.status===0||result.error.status>=500);
   let needsReload=unknown;
   if(result.error!==undefined||before.hasNext||!confirmed.content.length&&page>0){
    try{const targetPage=Math.max(0,Math.min(page,confirmed.totalPages-1));const latest=await synchronize(targetPage);if(current()&&!latest.content.length&&targetPage>0)await synchronize(Math.max(0,latest.totalPages-1));needsReload=false;}
    catch{needsReload=true;}
   }
   if(!current())return;
   setUncertain(needsReload);
   setNotice(needsReload?"삭제 결과를 확인하려면 목록을 다시 불러와 주세요.":result.error!==undefined?`${result.deleted.length}개의 삭제를 확인했습니다. 일부 글은 처리하지 못해 중단했습니다. 현재 목록을 확인해 주세요.`:`${result.deleted.length}개의 글을 삭제했습니다.`);
  }catch{if(current()){setData(before);setSelected([]);setUncertain(true);setNotice("삭제 결과를 확인하려면 목록을 다시 불러와 주세요.");}}
  finally{lock.current=false;if(mounted.current)setBusy(false);}
 }
 async function move(source:string,target:string){
  if(!data||lock.current||uncertain||!current())return;
  const change=movePostRow(data.content,source,target,!!boardId);if(!change)return;
  const before=data;let saved=false;lock.current=true;setBusy(true);setNotice("");setData({...data,content:change.items});
  try{
   const result=parseOwnPost(await userSession.request(`/posts/${source}`,{method:"PATCH",body:boardId?{boardDisplayOrder:change.displayOrder}:{displayOrder:change.displayOrder}}));
   if(result.id!==source||result.author.id!==member.id)throw new MemberApiError(0,"INVALID_RESPONSE","순서 저장 결과를 확인하지 못했어요.");
   saved=true;if(current())await synchronize();
  }catch(e){if(current()){
   if(!saved)setData(before);const unknown=saved||!(e instanceof MemberApiError)||e.status===0||e.status>=500;setUncertain(unknown);
   setNotice(saved?"변경은 저장됐지만 목록을 확인하지 못했어요. 목록을 다시 불러와 주세요.":unknown?"저장 결과를 확인하지 못했어요. 목록을 다시 불러와 주세요.":e instanceof Error?e.message:"순서를 저장하지 못했어요.");
  }}finally{lock.current=false;if(mounted.current)setBusy(false);}
 }
 async function toggleVisibility(post:OwnPostPage["content"][number]){
  if(!data||lock.current||uncertain||post.draft||post.isBlocked||!current())return;
  const next=post.visibilityStatus==="PUBLIC"?"HIDDEN":"PUBLIC",before=data;
  lock.current=true;setBusy(true);setNotice("");setData({...data,content:data.content.map(row=>row.id===post.id?{...row,visibilityStatus:next}:row)});
  try{
   const result=parseOwnPost(await userSession.request(`/posts/${post.id}`,{method:"PATCH",body:{visibilityStatus:next}}));
   if(result.id!==post.id||result.author.id!==member.id||result.visibilityStatus!==next)throw new MemberApiError(0,"INVALID_RESPONSE","공개 상태 저장 결과를 확인하지 못했어요.");
  }catch(e){if(current()){setData(before);const unknown=!(e instanceof MemberApiError)||e.status===0||e.status>=500;setUncertain(unknown);setNotice(unknown?"저장 결과를 확인하지 못했어요. 목록을 다시 불러와 주세요.":e instanceof Error?e.message:"공개 상태를 바꾸지 못했어요.");}}
  finally{lock.current=false;if(mounted.current)setBusy(false);}
 }
 function endDrag(event:PointerEvent<HTMLLIElement>){const active=dragging.current,target=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>('[data-post-id]')?.dataset.postId;dragging.current=null;setDrag(null);if(active?.active&&target)void move(active.source,target);}
 return <section className="own-posts"><div className="list-heading"><h1>게시글 관리</h1><ProtectedActionLink className="button" href="/posts/new">글 작성</ProtectedActionLink></div><p className="own-posts-help">글 행을 드래그해 순서를 바꾸고, 공개·비공개를 눌러 공개 범위를 변경하세요.</p>
 <div className="own-post-filter"><label>게시판 <select aria-label="게시판별 글 보기" value={boardId} disabled={busy} onChange={event=>{setData(null);setPage(0);setNotice("");setUncertain(false);setBoardId(event.target.value);dragging.current=null;setDrag(null);}}><option value="">전체 게시글</option>{flattenBoards(boards).map(board=><option key={board.id} value={board.id}>{`${"　".repeat(board.depth)}${board.depth?"└ ":""}${board.name}`}</option>)}</select></label><p>{boardId?"이 게시판 안의 순서만 변경해요. 전체 게시글 순서는 유지돼요.":"전체 게시글의 표시 순서를 변경해요."}</p></div>
 {boardError&&<p role="alert">{boardError} <button className="button" onClick={()=>setBoardAttempt(n=>n+1)}>게시판 다시 불러오기</button></p>}
 {notice&&<p role={uncertain?"alert":"status"} className="own-posts-notice">{notice}{uncertain&&<button className="button" onClick={refresh}>목록 다시 불러오기</button>}</p>}
 {error?<section className="list-state"><p role="alert">{error}</p><button className="button" onClick={refresh}>다시 불러오기</button></section>:!data?<p role="status">내 글을 불러오고 있어요.</p>:!data.content.length?busy?<p role="status">선택한 글을 삭제하는 중…</p>:<section className="list-state"><h2>{boardId?"이 게시판에 글이 없어요":"아직 작성한 글이 없어요"}</h2><p>새 글을 작성하고 비공개로 저장해 보세요.</p></section>:<><div className="own-post-selection"><label><input ref={selectAll} type="checkbox" aria-label="이 페이지의 게시글 전체 선택" checked={data.content.length>0&&selectedRows.length===data.content.length} disabled={busy||uncertain} onChange={event=>setSelected(event.target.checked?data.content.map(post=>post.id):[])}/>이 페이지 전체 선택</label><span aria-live="polite">{selectedRows.length}개 선택</span><button type="button" className="button" disabled={busy||uncertain||!selectedRows.length} onClick={()=>setConfirmBulk(true)}>선택 삭제</button></div><ul className="own-post-list" aria-label="게시글 순서" aria-busy={busy}>
 {data.content.map((post,index)=><li className="own-post-row" key={post.id} tabIndex={0} aria-label={`${post.title}, Alt와 위·아래 방향키로 순서 변경`} onKeyDown={event=>{if(event.target!==event.currentTarget||!event.altKey||!["ArrowUp","ArrowDown"].includes(event.key))return;const target=data.content[index+(event.key==="ArrowUp"?-1:1)];if(target){event.preventDefault();void move(post.id,target.id);}}} data-post-id={post.id} onPointerDown={event=>{if(event.button!==0||event.pointerType==="touch"||busy||uncertain||(event.target as Element).closest("button,a,input,label,select,textarea,form,[role=group]"))return;event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);dragging.current={source:post.id,target:post.id,x:event.clientX,y:event.clientY,active:false};}} onPointerMove={event=>{const start=dragging.current;if(!start)return;if(!start.active){if(Math.hypot(event.clientX-start.x,event.clientY-start.y)<5)return;start.active=true;}const target=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>('[data-post-id]')?.dataset.postId;start.target=target??start.source;setDrag({source:start.source,target:start.target});}} onPointerUp={endDrag} onPointerCancel={()=>{dragging.current=null;setDrag(null);}} data-dragging={drag?.source===post.id} data-drop={drag&&drag.source!==post.id&&drag.target===post.id?(data.content.findIndex(p=>p.id===drag.source)<index?"after":"before"):undefined}>
 <label className="own-post-select"><input type="checkbox" checked={selected.includes(post.id)} disabled={busy||uncertain} aria-label={`${post.title} 선택`} onChange={event=>setSelected(before=>event.target.checked?[...before.filter(id=>id!==post.id),post.id]:before.filter(id=>id!==post.id))}/><span className="own-post-order">{(boardId?post.boardDisplayOrder!:post.displayOrder)+1}</span></label><button type="button" className="own-post-visibility" disabled={busy||uncertain||post.isBlocked||post.draft===true} title={post.draft?"임시저장 글은 수정 화면에서 발행해 주세요.":post.isBlocked?"차단된 글은 공개 범위를 변경할 수 없어요.":"클릭하여 공개 범위 변경"} aria-label={`${post.title}: ${post.visibilityStatus==="PUBLIC"?"공개, 비공개로 변경":"비공개, 공개로 변경"}`} onClick={()=>void toggleVisibility(post)}>{post.draft?"임시저장":post.visibilityStatus==="HIDDEN"?"비공개":"공개"}{post.isBlocked?" · 차단":""}</button><span className="own-post-title"><Link className="own-content-link" href={post.visibilityStatus==="PUBLIC"&&!post.isBlocked?`/blogs/${post.author.handle}/posts/${post.urlKey}`:`/posts/${post.id}/view`}>{post.title}</Link></span>
 <time className="own-post-date" dateTime={post.createdAt}>{new Intl.DateTimeFormat("ko-KR",{year:"numeric",month:"2-digit",day:"2-digit",timeZone:"Asia/Seoul"}).format(new Date(post.createdAt))}</time>
 <fieldset className="own-post-actions" disabled={busy||uncertain}><Link href={`/posts/${post.id}/edit`}>수정</Link><Link prefetch={false} aria-label={`${post.title} 통계`} href={`/settings/blog/insights/posts/${post.id}`}>통계</Link><Link href={post.visibilityStatus==="PUBLIC"&&!post.isBlocked?`/blogs/${post.author.handle}/posts/${post.urlKey}`:`/posts/${post.id}/view`}>보기</Link><ContentManagement kind="posts" id={post.id} title={post.title} memberId={member.id} onChanged={refresh} onDelete={()=>removeRow(post)}/></fieldset>
 </li>)}</ul></>}
 {data&&<nav className="pagination" aria-label="내 글 페이지"><button className="button" disabled={busy||!data.hasPrevious} onClick={()=>{setNotice("");setPage(n=>n-1);}}>이전</button><span>{Math.min(page+1,Math.max(1,data.totalPages))} / {Math.max(1,data.totalPages)}</span><button className="button" disabled={busy||!data.hasNext} onClick={()=>{setNotice("");setPage(n=>n+1);}}>다음</button></nav>}
 <dialog ref={bulkDialog} className={dialogStyles.dialog} aria-labelledby={bulkTitle} onCancel={()=>setConfirmBulk(false)} onClose={()=>setConfirmBulk(false)}><h2 id={bulkTitle}>선택한 글을 삭제하시겠습니까?</h2><p>선택한 {selectedRows.length}개의 글을 삭제합니다. 삭제한 글과 댓글은 복구할 수 없습니다.</p><ul className="own-post-delete-titles">{selectedRows.map(post=><li key={post.id}>{post.title}</li>)}</ul><div className={dialogStyles.actions}><button type="button" className="button" autoFocus onClick={()=>setConfirmBulk(false)}>취소</button><button type="button" className="button" disabled={busy||!selectedRows.length} onClick={()=>void removeSelected()}>삭제</button></div></dialog>
 </section>;
}
export function MyPosts(){return <MemberGate preserveOnRefresh>{member=><Posts key={member.id} member={member}/>}</MemberGate>;}
