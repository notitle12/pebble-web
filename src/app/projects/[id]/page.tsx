import {projectSearchData} from "@/features/seo/model";
import {StructuredData} from "@/features/seo/json-ld";
import {PublicProjectMedia} from "@/features/media/components/public-project-media";
import {safeMediaUrl} from "@/features/media/model";
import {LikePanel} from "@/features/like/components/like-panel";
import {ProjectOwnerActions} from "@/features/project/components/project-owner-actions";
import {CommentsPanel} from "@/features/comment/components/comments-panel";
import {cache,Suspense} from "react";
import Link from "next/link";
import {notFound} from "next/navigation";
import type {Metadata} from "next";
import {SiteHeader} from "@/components/site-header";
import {GuestApiError} from "@/lib/public-api";
import {parsePage} from "@/lib/list-query";
import {getPublicProject,projectHref,safeExternalUrl} from "@/features/project/api/project-list";
import {ProjectPosts} from "@/features/project/components/project-posts";
import {legacyProjectDocument} from "@/features/project/project-document";
import {ProjectDocumentView} from "@/features/project/components/project-document-view";
import {ProjectCoverImage} from "@/features/project/components/project-cover-image";
const readProject=cache(getPublicProject);
type Props={params:Promise<{id:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>};
export const dynamic="force-dynamic";
export async function generateMetadata({params}:Props):Promise<Metadata> {
  try {const project=await readProject((await params).id);return projectSearchData(project).metadata;} catch {return {title:"프로젝트",robots:{index:false,follow:false}};}
}
export default async function ProjectDetail({params,searchParams}:Props) {
  const {id}=await params;const query=await searchParams;
  const page=Object.keys(query).some(key=>key!=="page") ? null : parsePage(query.page);
  let project;
  try {project=await readProject(id);} catch(error) {
    if(error instanceof GuestApiError && error.kind==="not-found") notFound();
    return <><SiteHeader/><main className="page-shell detail-shell post-reading-shell project-reading-shell"><section className="list-state" role="alert"><h1>프로젝트를 불러오지 못했어요</h1><p>잠시 후 다시 시도해 주세요.</p><a className="button" href={projectHref(id,page??0)??"/projects"}>다시 시도</a><Link className="button" href="/projects">프로젝트 목록으로</Link></section></main></>;
  }
  const date=project.publishedAt??project.createdAt;
  const thumb = project.media.find(item => item.mediaRole === "THUMBNAIL");
  const coverUrl = safeMediaUrl(thumb?.url ?? project.thumbnailUrl ?? null);
  return <><a className="skip-link" href="#main-content">본문으로 바로가기</a><SiteHeader/><main className="page-shell detail-shell post-reading-shell project-reading-shell" id="main-content"><Link className="detail-back" href="/projects">← 공개 프로젝트 목록</Link>
    {process.env.NODE_ENV==="development" && process.env.PEBBLE_PREVIEW_MODE==="mock" && <p className="preview-notice">목 데이터 미리보기 · 실제 프로젝트가 아닙니다</p>}
    <StructuredData value={projectSearchData(project).schema}/>
    <article className="post-detail"><header><div className="post-heading-bar"><div className="post-meta"><span>{project.owner.nickname}</span><time dateTime={date}>{new Intl.DateTimeFormat("ko-KR",{dateStyle:"long",timeZone:"Asia/Seoul"}).format(new Date(date))}</time><span className={`project-status ${project.lifecycleStatus==="COMPLETED"?"completed":""}`}>{project.lifecycleStatus==="COMPLETED"?"완료":"진행 중"}</span></div><ProjectOwnerActions ownerId={project.owner.id} projectId={project.id} title={project.name}/></div><h1 title={project.name}>{project.name}</h1>{project.summary && <p>{project.summary}</p>}
      {coverUrl && <ProjectCoverImage src={coverUrl} alt={`${project.name} 대표 이미지`} />}
    </header><div className="post-body">
      <PublicProjectMedia key={project.id} id={project.id} initial={project.media}/>
      <ProjectDocumentView
        document={project.document ?? legacyProjectDocument(project)}
        techStacks={project.techStacks}
        period={{
          startedOn: project.startedOn,
          completedOn: project.completedOn,
          lifecycleStatus: project.lifecycleStatus,
        }}
      />
      {project.executionInstructions && <section className="text-block"><h2>실행 방법</h2><p>{project.executionInstructions}</p></section>}
      {project.links.length>0 && <section className="text-block"><h2>프로젝트 링크</h2><ul className="project-links">{[...project.links].sort((a,b)=>a.displayOrder-b.displayOrder).map(link=>{const href=safeExternalUrl(link.url);return <li key={link.id}>{href ? <a href={href} target="_blank" rel="noopener noreferrer">{link.label??link.linkType} ↗<span className="sr-only"> (새 탭)</span></a> : <span>사용할 수 없는 링크</span>}</li>;})}</ul></section>}
    {page===null ? <section className="related-posts list-state"><h2>관련 글 페이지를 확인해 주세요</h2><Link className="button" href={projectHref(id)!}>관련 글 첫 페이지로</Link></section> : <Suspense key={page} fallback={<p className="related-posts list-state" role="status">관련 글을 불러오고 있어요.</p>}><ProjectPosts id={id} page={page}/></Suspense>}
      <LikePanel target="projects" contentId={project.id} initialCount={project.likeCount}/>
    </div></article>

  <CommentsPanel target="projects" contentId={project.id} ownerId={project.owner.id}/></main></>;
}
