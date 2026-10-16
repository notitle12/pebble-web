"use client";
import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import {ContentManagement} from "@/features/content/components/content-management";
import {MemberGate} from "@/features/auth/components/member-gate";
import {ProtectedActionLink} from "@/features/auth/components/protected-action-link";
import {userSession,type Member} from "@/features/auth/user-session";
import {MemberApiError} from "@/lib/member-api";
import {parseOwnProject,parseOwnProjects,projectWriteFailure,type OwnProjectPage} from "../api/member-projects";

function Projects({member}:{member:Member}) {
 const [page,setPage]=useState(0),[visibility,setVisibility]=useState(""),[data,setData]=useState<OwnProjectPage|null>(null),[error,setError]=useState(""),[attempt,setAttempt]=useState(0);
 const [busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),[notice,setNotice]=useState("");
 const lock=useRef(false),mounted=useRef(false);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const current=()=>mounted.current&&userSession.snapshot().phase==="ready"&&userSession.snapshot().member?.id===member.id;
 function refresh(){setData(null);setNotice("");setAttempt(n=>n+1);}
 useEffect(()=>{
  let live=true;setData(null);setError("");
  void userSession.request(`/members/me/projects?page=${page}&size=20&sort=createdAt,desc${visibility?`&visibilityStatus=${visibility}`:""}`)
   .then(value=>{if(live){setData(parseOwnProjects(value,page,member.id));setUncertain(false);}})
   .catch(e=>{if(live)setError(e instanceof Error?e.message:"프로젝트를 불러오지 못했어요.");});
  return()=>{live=false;};
 },[page,visibility,attempt,member.id]);
 async function toggleVisibility(project:OwnProjectPage['content'][number]) {
  if(!data||lock.current||uncertain||project.isBlocked||!current())return;
  const next=project.visibilityStatus==="PUBLIC"?"HIDDEN":"PUBLIC",before=data;
  lock.current=true;setBusy(true);setNotice("");
  setData({...data,content:data.content.map(row=>row.id===project.id?{...row,visibilityStatus:next}:row)});
  try {
   const result=parseOwnProject(await userSession.request(`/projects/${project.id}`,{method:"PATCH",body:{visibilityStatus:next}}),member.id,project.id);
   if(result.visibilityStatus!==next)throw new MemberApiError(0,"INVALID_RESPONSE","공개 상태 저장 결과를 확인하지 못했어요.");
   if(current()){
    setNotice(next==="PUBLIC"?"프로젝트를 공개했어요.":"프로젝트를 비공개로 바꿨어요.");
    if(visibility)refresh();
   }
  } catch(e) {
   if(current()){
    setData(before);const unknown=!(e instanceof MemberApiError)||e.status===0||e.status>=500;setUncertain(unknown);
    setNotice(unknown?"저장 결과를 확인하지 못했어요. 목록을 다시 불러와 주세요.":projectWriteFailure(e));
   }
  } finally {lock.current=false;if(mounted.current)setBusy(false);}
 }
 const movePage=(next:number)=>{setData(null);setNotice("");setPage(next);};
 return <section className="own-posts own-projects">
  <div className="list-heading"><h1>프로젝트 관리</h1><ProtectedActionLink className="button" href="/projects/new">프로젝트 작성</ProtectedActionLink></div>
  <p className="own-posts-help">공개·비공개를 눌러 공개 범위를 변경하고, 프로젝트를 수정하거나 삭제할 수 있어요.</p>
  <div className="own-post-filter"><label>공개 상태 <select aria-label="공개 상태별 프로젝트 보기" value={visibility} disabled={busy} onChange={e=>{setData(null);setVisibility(e.target.value);setPage(0);setNotice("");setUncertain(false);}}><option value="">전체 프로젝트</option><option value="PUBLIC">공개</option><option value="HIDDEN">비공개</option></select></label><p>최근 작성한 프로젝트부터 표시해요.</p></div>
  {notice&&<p className="own-posts-notice" role={uncertain?"alert":"status"}>{notice}{uncertain&&<button className="button" onClick={refresh}>목록 다시 불러오기</button>}</p>}
  {error?<section className="list-state"><p role="alert">{error}</p><button className="button" onClick={refresh}>다시 불러오기</button></section>:!data?<p role="status">내 프로젝트를 불러오고 있어요.</p>:!data.content.length?<section className="list-state"><h2>{page>0?"이 페이지에는 프로젝트가 없어요.":visibility?"해당 상태의 프로젝트가 없어요.":"아직 작성한 프로젝트가 없어요."}</h2>{page>0&&<button className="button" onClick={()=>movePage(0)}>첫 페이지로</button>}</section>:<ul className="own-post-list" aria-label="프로젝트 관리 목록" aria-busy={busy}>
   {data.content.map((project,index)=><li className="own-post-row own-project-row" key={project.id}>
    <span className="own-post-order">{page*20+index+1}</span>
    <button type="button" className="own-post-visibility" disabled={busy||uncertain||project.isBlocked} title={project.isBlocked?"차단된 프로젝트는 공개 범위를 변경할 수 없어요.":"클릭하여 공개 범위 변경"} aria-label={`${project.name}: ${project.visibilityStatus==="PUBLIC"?"공개, 비공개로 변경":"비공개, 공개로 변경"}`} onClick={()=>void toggleVisibility(project)}>{project.visibilityStatus==="HIDDEN"?"비공개":"공개"}{project.isBlocked?" · 차단":""}</button>
    <span className="own-project-title"><span className="own-post-title">{project.name}</span><span className="own-project-lifecycle">{project.lifecycleStatus==="COMPLETED"?"완료":"진행 중"}</span></span>
    <time className="own-post-date" dateTime={project.createdAt}>{new Intl.DateTimeFormat("ko-KR",{year:"numeric",month:"2-digit",day:"2-digit",timeZone:"Asia/Seoul"}).format(new Date(project.createdAt))}</time>
    <fieldset className="own-post-actions" disabled={busy}><Link href={`/projects/${project.id}/edit`}>수정</Link>{project.visibilityStatus==="PUBLIC"&&!project.isBlocked&&<Link href={`/projects/${project.id}`}>보기</Link>}<ContentManagement kind="projects" id={project.id} title={project.name} memberId={member.id} onChanged={refresh}/></fieldset>
   </li>)}
  </ul>}
  {data&&<nav className="pagination" aria-label="내 프로젝트 페이지"><button className="button" disabled={busy||!data.hasPrevious} onClick={()=>movePage(page-1)}>이전</button><span>{page+1} / {Math.max(1,data.totalPages)}</span><button className="button" disabled={busy||!data.hasNext} onClick={()=>movePage(page+1)}>다음</button></nav>}
 </section>;
}
export function MyProjects(){return <MemberGate>{member=><Projects key={member.id} member={member}/>}</MemberGate>;}
