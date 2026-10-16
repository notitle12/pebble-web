"use client";
import {useEffect,useRef,useState,type PointerEvent} from "react";
import Link from "next/link";
import {movePostRow,removeManagedRow,confirmDeletion} from "@/features/content/management-model";
import {ContentManagement} from "@/features/content/components/content-management";
import {MemberGate} from "@/features/auth/components/member-gate";
import {ProtectedActionLink} from "@/features/auth/components/protected-action-link";
import {userSession,type Member} from "@/features/auth/user-session";
import {MemberApiError} from "@/lib/member-api";
import {parseOwnProject,parseOwnProjects,projectWriteFailure,type OwnProjectPage} from "../api/member-projects";

function Projects({member}:{member:Member}) {
 const [page,setPage]=useState(0),[visibility,setVisibility]=useState(""),[data,setData]=useState<OwnProjectPage|null>(null),[error,setError]=useState(""),[attempt,setAttempt]=useState(0);
 const [busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),[notice,setNotice]=useState("");
 const syncedPage=useRef<number|null>(null),lock=useRef(false),mounted=useRef(false),dragging=useRef<{source:string;target:string;x:number;y:number;active:boolean}|null>(null);
 const [drag,setDrag]=useState<{source:string;target:string}|null>(null);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const current=()=>mounted.current&&userSession.snapshot().phase==="ready"&&userSession.snapshot().member?.id===member.id;
 function refresh(){setData(null);setNotice("");if(data&&page>=data.totalPages)setPage(Math.max(0,data.totalPages-1));setAttempt(n=>n+1);}
 useEffect(()=>{
  if(syncedPage.current===page){syncedPage.current=null;return;}
  let live=true;setData(null);setError("");
  void userSession.request(`/members/me/projects?page=${page}&size=20&sort=displayOrder,asc${visibility?`&visibilityStatus=${visibility}`:""}`)
   .then(value=>{if(live){setData(parseOwnProjects(value,page,member.id));setUncertain(false);}})
   .catch(e=>{if(live)setError(e instanceof Error?e.message:"프로젝트를 불러오지 못했어요.");});
  return()=>{live=false;};
 },[page,visibility,attempt,member.id]);

 async function synchronize(targetPage=page){
  const value=await userSession.request(`/members/me/projects?page=${targetPage}&size=20&sort=displayOrder,asc${visibility?`&visibilityStatus=${visibility}`:""}`),next=parseOwnProjects(value,targetPage,member.id);
  if(current()){setData(next);if(targetPage!==page){syncedPage.current=targetPage;setPage(targetPage);}}
 }
 async function removeRow(row:OwnProjectPage['content'][number]){
  if(!data||lock.current||uncertain||!current())return;
  const before=data,next=removeManagedRow(data,row.id);let saved=false;
  lock.current=true;setBusy(true);setNotice("");setData(next);
  try{
   confirmDeletion(await userSession.request(`/projects/${row.id}`,{method:"DELETE"}));saved=true;
   if(current()&&(before.hasNext||!next.content.length&&page>0))await synchronize(Math.max(0,Math.min(page,next.totalPages-1)));
  }catch(e){if(current()){
   if(!saved)setData(before);
   const unknown=saved||!(e instanceof MemberApiError)||e.status===0||e.status>=500;setUncertain(unknown);
   setNotice(saved?"삭제는 완료됐지만 목록을 확인하지 못했어요. 목록을 다시 불러와 주세요.":unknown?"삭제 결과를 확인하지 못했어요. 목록을 다시 불러와 주세요.":e instanceof Error?e.message:"삭제하지 못했어요.");
  }}finally{lock.current=false;if(mounted.current)setBusy(false);}
 }
 async function toggleVisibility(project:OwnProjectPage['content'][number]) {
  if(!data||lock.current||uncertain||project.isBlocked||!current())return;
  const next=project.visibilityStatus==="PUBLIC"?"HIDDEN":"PUBLIC",before=data;let saved=false;
  lock.current=true;setBusy(true);setNotice("");
  const optimistic:OwnProjectPage={...data,content:data.content.map(row=>row.id===project.id?{...row,visibilityStatus:next}:row)};
  const filtered=visibility?removeManagedRow(optimistic,project.id,false):optimistic;setData(filtered);
  try {
   const result=parseOwnProject(await userSession.request(`/projects/${project.id}`,{method:"PATCH",body:{visibilityStatus:next}}),member.id,project.id);
   if(result.visibilityStatus!==next)throw new MemberApiError(0,"INVALID_RESPONSE","공개 상태 저장 결과를 확인하지 못했어요.");
   saved=true;
   if(current()&&visibility&&(before.hasNext||!filtered.content.length&&page>0))await synchronize(Math.max(0,Math.min(page,filtered.totalPages-1)));
  } catch(e) {
   if(current()){
    if(!saved)setData(before);const unknown=saved||!(e instanceof MemberApiError)||e.status===0||e.status>=500;setUncertain(unknown);
    setNotice(saved?"변경은 저장됐지만 목록을 확인하지 못했어요. 목록을 다시 불러와 주세요.":unknown?"저장 결과를 확인하지 못했어요. 목록을 다시 불러와 주세요.":projectWriteFailure(e));
   }
  } finally {lock.current=false;if(mounted.current)setBusy(false);}
 }
 async function move(source:string,target:string){
  if(!data||lock.current||uncertain||!current())return;
  const change=movePostRow(data.content,source,target);if(!change)return;
  const before=data;let saved=false;lock.current=true;setBusy(true);setNotice("");setData({...data,content:change.items});
  try{const result=parseOwnProject(await userSession.request(`/projects/${source}/order`,{method:"PATCH",body:{targetId:target}}),member.id,source);
   saved=true;if(current())await synchronize();
  }catch(e){if(current()){if(!saved)setData(before);const unknown=saved||!(e instanceof MemberApiError)||e.status===0||e.status>=500;setUncertain(unknown);setNotice(saved?"변경은 저장됐지만 목록을 확인하지 못했어요. 목록을 다시 불러와 주세요.":unknown?"저장 결과를 확인하지 못했어요. 목록을 다시 불러와 주세요.":projectWriteFailure(e));}}
  finally{lock.current=false;if(mounted.current)setBusy(false);}
 }
 function endDrag(event:PointerEvent<HTMLLIElement>){const active=dragging.current,target=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>('[data-project-id]')?.dataset.projectId;dragging.current=null;setDrag(null);if(active?.active&&target)void move(active.source,target);}
 const movePage=(next:number)=>{setData(null);setNotice("");setPage(next);};
 return <section className="own-posts own-projects">
  <div className="list-heading"><h1>프로젝트 관리</h1><ProtectedActionLink className="button" href="/projects/new">프로젝트 작성</ProtectedActionLink></div>
  <p className="own-posts-help">제목을 눌러 프로젝트를 보고, 행의 여백을 드래그해 순서를 바꿀 수 있어요.</p>
  <div className="own-post-filter"><label>공개 상태 <select aria-label="공개 상태별 프로젝트 보기" value={visibility} disabled={busy} onChange={e=>{setData(null);setVisibility(e.target.value);setPage(0);setNotice("");setUncertain(false);}}><option value="">전체 프로젝트</option><option value="PUBLIC">공개</option><option value="HIDDEN">비공개</option></select></label><p>전체 프로젝트의 표시 순서를 변경해요.</p></div>
  {notice&&<p className="own-posts-notice" role={uncertain?"alert":"status"}>{notice}{uncertain&&<button className="button" onClick={refresh}>목록 다시 불러오기</button>}</p>}
  {error?<section className="list-state"><p role="alert">{error}</p><button className="button" onClick={refresh}>다시 불러오기</button></section>:!data?<p role="status">내 프로젝트를 불러오고 있어요.</p>:!data.content.length?<section className="list-state"><h2>{page>0?"이 페이지에는 프로젝트가 없어요.":visibility?"해당 상태의 프로젝트가 없어요.":"아직 작성한 프로젝트가 없어요."}</h2>{page>0&&<button className="button" onClick={()=>movePage(0)}>첫 페이지로</button>}</section>:<ul className="own-post-list" aria-label="프로젝트 관리 목록" aria-busy={busy}>
   {data.content.map((project,index)=><li className="own-post-row own-project-row" key={project.id} tabIndex={0} aria-label={`${project.name}, Alt와 위·아래 방향키로 순서 변경`} onKeyDown={event=>{if(event.target!==event.currentTarget||!event.altKey||!["ArrowUp","ArrowDown"].includes(event.key))return;const target=data.content[index+(event.key==="ArrowUp"?-1:1)];if(target){event.preventDefault();void move(project.id,target.id);}}} data-project-id={project.id} onPointerDown={event=>{if(event.button!==0||event.pointerType==="touch"||busy||uncertain||(event.target as Element).closest("button,a,input,select,textarea,form,dialog"))return;event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);dragging.current={source:project.id,target:project.id,x:event.clientX,y:event.clientY,active:false};}} onPointerMove={event=>{const start=dragging.current;if(!start)return;if(!start.active){if(Math.hypot(event.clientX-start.x,event.clientY-start.y)<5)return;start.active=true;}const target=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>('[data-project-id]')?.dataset.projectId;start.target=target??start.source;setDrag({source:start.source,target:start.target});}} onPointerUp={endDrag} onPointerCancel={()=>{dragging.current=null;setDrag(null);}} data-dragging={drag?.source===project.id} data-drop={drag&&drag.source!==project.id&&drag.target===project.id?(data.content.findIndex(p=>p.id===drag.source)<index?"after":"before"):undefined}>
    <span className="own-post-order">{project.displayOrder+1}</span>
    <button type="button" className="own-post-visibility" disabled={busy||uncertain||project.isBlocked} title={project.isBlocked?"차단된 프로젝트는 공개 범위를 변경할 수 없어요.":"클릭하여 공개 범위 변경"} aria-label={`${project.name}: ${project.visibilityStatus==="PUBLIC"?"공개, 비공개로 변경":"비공개, 공개로 변경"}`} onClick={()=>void toggleVisibility(project)}>{project.visibilityStatus==="HIDDEN"?"비공개":"공개"}{project.isBlocked?" · 차단":""}</button>
    <span className="own-project-title"><span className="own-post-title"><Link className="own-content-link" href={project.visibilityStatus==="PUBLIC"&&!project.isBlocked?`/projects/${project.id}`:`/projects/${project.id}/view`}>{project.name}</Link></span><span className="own-project-lifecycle">{project.lifecycleStatus==="COMPLETED"?"완료":"진행 중"}</span></span>
    <time className="own-post-date" dateTime={project.createdAt}>{new Intl.DateTimeFormat("ko-KR",{year:"numeric",month:"2-digit",day:"2-digit",timeZone:"Asia/Seoul"}).format(new Date(project.createdAt))}</time>
    <fieldset className="own-post-actions" disabled={busy||uncertain}><Link href={`/projects/${project.id}/edit`}>수정</Link><Link href={project.visibilityStatus==="PUBLIC"&&!project.isBlocked?`/projects/${project.id}`:`/projects/${project.id}/view`}>보기</Link><ContentManagement kind="projects" id={project.id} title={project.name} memberId={member.id} onChanged={refresh} onDelete={()=>removeRow(project)}/></fieldset>
   </li>)}
  </ul>}
  {data&&<nav className="pagination" aria-label="내 프로젝트 페이지"><button className="button" disabled={busy||!data.hasPrevious} onClick={()=>movePage(page-1)}>이전</button><span>{Math.min(page+1,Math.max(1,data.totalPages))} / {Math.max(1,data.totalPages)}</span><button className="button" disabled={busy||!data.hasNext} onClick={()=>movePage(page+1)}>다음</button></nav>}
 </section>;
}
export function MyProjects(){return <MemberGate preserveOnRefresh>{member=><Projects key={member.id} member={member}/>}</MemberGate>;}
