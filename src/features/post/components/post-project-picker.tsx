"use client";

import Link from "next/link";
import {useEffect,useId,useState} from "react";
import {userSession} from "../../auth/user-session";
import {parseOwnProjects,type OwnProjectPage} from "../../project/api/member-projects";

export function PostProjectPicker({memberId,projectId,onChange}:{memberId:string;projectId:string|null;onChange:(id:string|null)=>void}){
  const id=useId();
  const [page,setPage]=useState(0),[attempt,setAttempt]=useState(0);
  const [data,setData]=useState<OwnProjectPage|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
  const [known,setKnown]=useState<Record<string,string>>({});
  const [query,setQuery]=useState("");
  useEffect(()=>{
    let live=true;setLoading(true);setError("");setData(null);
    void userSession.request(`/members/me/projects?page=${page}&size=20&sort=createdAt,desc`).then(value=>{
      if(!live)return;
      const next=parseOwnProjects(value,page,memberId);setData(next);
      setKnown(current=>({...current,...Object.fromEntries(next.content.map(project=>[project.id,project.name]))}));
    }).catch(e=>{if(live)setError(e instanceof Error?e.message:"프로젝트를 불러오지 못했습니다.");}).finally(()=>{if(live)setLoading(false);});
    return()=>{live=false;};
  },[memberId,page,attempt]);
  const projects=data?.content.filter(project=>project.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))??[];
  return <section className="post-classification" aria-label="프로젝트 연결">
    <div className="post-classification-field">
      <label htmlFor={`${id}-search`}>이 페이지에서 프로젝트 찾기</label>
      <input id={`${id}-search`} type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="프로젝트 이름"/>
      <label htmlFor={`${id}-project`}>연결 프로젝트</label>
      <select id={`${id}-project`} value={projectId??""} onChange={event=>onChange(event.target.value||null)}>
        <option value="">연결 없음</option>
        {projectId&&!projects.some(project=>project.id===projectId)&&<option value={projectId}>{known[projectId]??`기존 프로젝트 (${projectId})`}</option>}
        {projects.map(project=><option key={project.id} value={project.id}>{project.name} · {project.visibilityStatus==="PUBLIC"?"공개":"비공개"}{project.isBlocked?" · 차단":""}</option>)}
      </select>
      <p className="post-classification-help">내 프로젝트 하나에 연결할 수 있어요. 비공개 프로젝트에 연결해도 글의 공개 범위는 바뀌지 않습니다.</p>
      {loading&&<p role="status">프로젝트를 불러오는 중…</p>}
      {error&&<p role="alert">{error} 현재 연결은 유지됩니다. <button type="button" onClick={()=>setAttempt(value=>value+1)}>다시 시도</button></p>}
      {data&&projects.length===0&&<p>{data.totalElements===0?"아직 프로젝트가 없어요.":"이 페이지에 검색 결과가 없어요. 다른 페이지도 확인해 주세요."}</p>}
      {data&&data.totalPages>1&&<nav aria-label="연결할 프로젝트 페이지">
        <button type="button" disabled={page===0} onClick={()=>{setQuery("");setPage(value=>value-1);}}>이전 프로젝트</button>
        <span>{page+1} / {data.totalPages}</span>
        <button type="button" disabled={page+1>=data.totalPages} onClick={()=>{setQuery("");setPage(value=>value+1);}}>다음 프로젝트</button>
      </nav>}
      <Link href="/me/projects" target="_blank" rel="noopener noreferrer">프로젝트 관리 열기</Link>
    </div>
  </section>;
}
