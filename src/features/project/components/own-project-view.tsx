"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {MemberGate} from "@/features/auth/components/member-gate";
import {userSession,type Member} from "@/features/auth/user-session";
import {safeMediaUrl} from "@/features/media/model";
import {safeExternalUrl} from "../api/project-list";
import {parseOwnProject,projectId,type OwnProject} from "../api/member-projects";
import {legacyProjectDocument} from "../project-document";
import {projectImagePreviews} from "../project-images";
import {ProjectDocumentView} from "./project-document-view";
import {ProjectTechnologySummary} from "./project-technology-summary";
function View({id,member}:{id:string;member:Member}){
 const [project,setProject]=useState<OwnProject|null>(null),[error,setError]=useState(""),[attempt,setAttempt]=useState(0);
 useEffect(()=>{let live=true;setProject(null);setError("");void userSession.request(`/projects/${projectId(id)}`).then(raw=>{const next=parseOwnProject(raw,member.id,id);if(live)setProject(next);}).catch(e=>{if(live)setError(e instanceof Error?e.message:"프로젝트를 불러오지 못했어요.");});return()=>{live=false;};},[id,member.id,attempt]);
 if(error)return <section className="list-state"><p role="alert">{error}</p><button className="button" onClick={()=>setAttempt(n=>n+1)}>다시 불러오기</button><Link href="/me/projects">프로젝트 관리</Link></section>;
 if(!project)return <p role="status">프로젝트를 불러오는 중</p>;
 return <><Link className="detail-back" href="/me/projects">← 프로젝트 관리</Link><article className="post-detail"><header><div className="post-heading-bar"><p>{project.visibilityStatus==="HIDDEN"?"비공개 · 작성자만 볼 수 있어요":"작성자 보기"}{project.isBlocked?" · 이용 제한":""}</p><nav className="blog-owner-actions" aria-label="내 프로젝트 관리"><Link href={`/projects/${id}/edit`}>프로젝트 수정</Link><Link href="/me/projects">프로젝트 관리</Link></nav></div><h1 title={project.name}>{project.name}</h1>{project.summary&&<p>{project.summary}</p>}<ProjectTechnologySummary selected={project.techStacks.map(t=>t.id)} existing={project.techStacks}/></header><div className="post-body">{project.media.filter(m=>m.mediaRole!=="BODY").map(m=>{const src=safeMediaUrl(m.url);return src?<img key={m.id} className="content-thumbnail" src={src} alt={m.altText??"프로젝트 이미지"}/>:null;})}<ProjectDocumentView document={project.document??legacyProjectDocument(project)} imagePreviews={projectImagePreviews(id,project.media)}/>{project.executionInstructions&&<section className="text-block"><h2>실행 방법</h2><p>{project.executionInstructions}</p></section>}{project.links.length>0&&<section className="text-block"><h2>프로젝트 링크</h2><ul className="project-links">{project.links.map(link=>{const href=safeExternalUrl(link.url);return <li key={link.id}>{href?<a href={href} target="_blank" rel="noopener noreferrer">{link.label??link.linkType} ↗</a>:<span>사용할 수 없는 링크</span>}</li>;})}</ul></section>}</div></article></>;
}
export function OwnProjectView({id}:{id:string}){return <MemberGate>{member=><View key={`${member.id}:${id}`} member={member} id={id}/>}</MemberGate>;}
