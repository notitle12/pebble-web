import Link from "next/link";
import { getPublicProjects, projectPageHref, type ProjectQuery } from "../api/project-list";
export function ProjectsLoading() { return <section className="list-state" role="status">프로젝트를 불러오고 있어요.</section>; }
const format = new Intl.DateTimeFormat("ko-KR",{dateStyle:"long",timeZone:"Asia/Seoul"});
export async function ProjectList({query}: {query:ProjectQuery}) {
  let result;
  try {result=await getPublicProjects(query);} catch {
    return <section className="list-state" role="alert"><h2>프로젝트를 불러오지 못했어요</h2><p>잠시 후 다시 시도해 주세요.</p><a className="button" href={projectPageHref(query.page,query)}>다시 시도</a></section>;
  }
  const filtered=Boolean(query.q || query.tagId || query.lifecycleStatus);
  if(!result.content.length) return <section className="list-state"><h2>{query.page>0 ? "이 페이지에는 프로젝트가 없어요" : filtered ? "조건에 맞는 프로젝트가 없어요" : "아직 공개된 프로젝트가 없어요"}</h2><p>{filtered ? "검색어나 필터를 바꿔서 다시 찾아보세요." : "새로운 프로젝트가 공개되면 이곳에서 만나볼 수 있어요."}</p>
    {query.page>0 && <Link className="button" href={projectPageHref(0,query)}>첫 페이지로</Link>}{filtered && <Link className="button" href="/projects">조건 초기화</Link>}</section>;
  return <section aria-label="공개 프로젝트 목록"><div className="list-heading"><h2>{filtered ? "검색 결과" : "최근 프로젝트"}</h2><span>총 {result.totalElements.toLocaleString("ko-KR")}개의 프로젝트</span></div>
    <ul className="post-list">{result.content.map(project=>{const date=project.publishedAt ?? project.createdAt;return <li key={project.id}><article className="post-card"><div className="post-meta"><span>{project.owner.nickname}</span><time dateTime={date}>{format.format(new Date(date))}</time><span className={`project-status ${project.lifecycleStatus === "COMPLETED" ? "completed" : ""}`}>{project.lifecycleStatus === "COMPLETED" ? "완료" : "진행 중"}</span></div><h3>{project.name}</h3>{project.summary && <p className="post-summary">{project.summary}</p>}<ul className="tag-list" aria-label="기술 태그">{project.tags.map(tag=><li key={tag.id}>{tag.name}</li>)}</ul></article></li>;})}</ul>
    <nav className="pagination" aria-label="프로젝트 페이지 이동">{result.hasPrevious ? <Link className="page-link" href={projectPageHref(query.page-1,query)} prefetch={false} aria-label="이전 페이지">← 이전</Link> : <span className="page-link disabled" aria-disabled="true">← 이전</span>}<span aria-current="page">{query.page+1} / {result.totalPages} 페이지</span>{result.hasNext ? <Link className="page-link" href={projectPageHref(query.page+1,query)} prefetch={false} aria-label="다음 페이지">다음 →</Link> : <span className="page-link disabled" aria-disabled="true">다음 →</span>}</nav>
  </section>;
}
