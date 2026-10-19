import Link from "next/link";
import {LikeCount} from "@/features/like/components/like-count";
import { ProjectCover } from "./project-cover";
import { projectHref, type ProjectSummary } from "../api/project-list";
const format = new Intl.DateTimeFormat("ko-KR",{dateStyle:"long",timeZone:"Asia/Seoul"});
export function ProjectCards({projects,startIndex=1}:{projects:ProjectSummary[];startIndex?:number}) {
  return <ul className="project-grid">{projects.map((project, idx)=>{const date=project.publishedAt ?? project.createdAt;const href=projectHref(project.id)!;return <li key={project.id}><article className="project-tile"><Link className="project-cover-link" href={href} prefetch={false} aria-label={`${project.name} 프로젝트 보기`}><ProjectCover title={project.name} techStacks={project.techStacks.map(tag=>tag.name)} index={startIndex + idx} imageUrl={project.thumbnailUrl} /></Link><div className="project-tile-body"><div className="post-meta"><span>{project.owner.nickname}</span><time dateTime={date}>{format.format(new Date(date))}</time><span className={`project-status ${project.lifecycleStatus === "COMPLETED" ? "completed" : ""}`}>{project.lifecycleStatus === "COMPLETED" ? "완료" : "진행 중"}</span><LikeCount count={project.likeCount}/></div><h3><Link href={href} prefetch={false}>{project.name}</Link></h3>{project.summary && <p className="post-summary">{project.summary}</p>}<ul className="tag-list" aria-label="기술 스택">{project.techStacks.map(tag=><li key={tag.id}>{tag.name}</li>)}</ul></div></article></li>;})}</ul>;
}
