"use client";
import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import {MemberGate} from "@/features/auth/components/member-gate";
import {userSession,type Member} from "@/features/auth/user-session";
import {parseOwnProject,projectId,projectWriteFailure,type OwnProject} from "../api/member-projects";
import {buildProjectSaveBody,emptyProject,projectEditorValue,type ProjectEditorValue,type ProjectVisibility} from "../project-editor-model";
import {ProjectEditor} from "./project-editor";
function Writer({member,id}:{member:Member;id?:string}) {
  const [project,setProject]=useState<OwnProject|null>(null),[value,setValue]=useState<ProjectEditorValue>(emptyProject),[loading,setLoading]=useState(!!id),[error,setError]=useState(""),[busy,setBusy]=useState(false),[saved,setSaved]=useState(""),[attempt,setAttempt]=useState(0);
  const saving=useRef(false),mounted=useRef(false);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useEffect(()=>{
    if(!id)return;let live=true;setLoading(true);setError("");
    void Promise.resolve().then(()=>userSession.request(`/projects/${projectId(id)}`)).then(response=>{if(!live)return;const next=parseOwnProject(response,member.id,id);setProject(next);setValue(projectEditorValue(next));}).catch(e=>{if(live)setError(projectWriteFailure(e));}).finally(()=>{if(live)setLoading(false);});
    return()=>{live=false;};
  },[id,member.id,attempt]);
  if(loading)return <section className="list-state" role="status">프로젝트를 불러오고 있어요.</section>;
  if(id&&!project)return <section className="list-state"><h1>프로젝트를 열지 못했어요</h1><p role="alert">{error}</p><button className="button" onClick={()=>setAttempt(n=>n+1)}>다시 불러오기</button><Link className="button" href="/me/projects">내 프로젝트로</Link></section>;
  async function save(visibility:ProjectVisibility) {
    if(saving.current)return;
    saving.current=true;setBusy(true);setError("");setSaved("");
    try {
      const body=buildProjectSaveBody(value,project??undefined,visibility),target=project?.id??id;
      if(target&&!Object.keys(body).length){setSaved("변경된 내용이 없습니다.");return;}
      const next=parseOwnProject(await userSession.request(target?`/projects/${projectId(target)}`:"/projects",{method:target?"PATCH":"POST",body}),member.id,target);
      const current=userSession.snapshot();
      if(!mounted.current||current.phase!=="ready"||current.member?.id!==member.id)return;
      setProject(next);setValue(projectEditorValue(next));setSaved(next.visibilityStatus==="PUBLIC"?"공개로 저장했습니다.":"비공개로 저장했습니다.");
      if(!target)window.history.replaceState(null,"",`/projects/${next.id}/edit`);
    }catch(e){if(mounted.current)setError(projectWriteFailure(e));throw e;}
    finally {saving.current=false;if(mounted.current)setBusy(false);}
  }
  return <><h1>{project||id?"프로젝트 수정":"새 프로젝트 작성"}</h1><div className="writer-status"><Link href="/me/projects">← 내 프로젝트</Link><p>{project?.visibilityStatus==="PUBLIC"?"저장하면 공개 프로젝트에 반영됩니다.":"비공개 프로젝트는 나만 볼 수 있어요."}</p></div>{project?.isBlocked&&<p role="alert">관리자에 의해 차단된 프로젝트입니다. 차단은 작성자가 해제할 수 없습니다.</p>}{error&&<p role="alert">{error}</p>}{saved&&<p role="status">{saved}</p>}{project?.visibilityStatus==="PUBLIC"&&!project.isBlocked&&<Link className="button writer-public-link" href={`/projects/${project.id}`} prefetch={false}>공개 프로젝트 확인</Link>}<ProjectEditor value={value} onChange={setValue} busy={busy} visibility={project?.visibilityStatus??"HIDDEN"} blocked={project?.isBlocked??false} existingTags={project?.tags} onSave={save}/></>;
}
export function ProjectWriteScreen({id}:{id?:string}) {return <MemberGate profile preserveOnExpiry>{member=><Writer key={`${member.id}:${id??"new"}`} member={member} id={id}/>}</MemberGate>;}
