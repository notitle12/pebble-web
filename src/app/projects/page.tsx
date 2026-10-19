import { Suspense } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { parseProjectQuery } from "@/features/project/api/project-list";
import { ProjectList, ProjectsLoading } from "@/features/project/components/project-list";
import { PopularProjects } from "@/features/project/components/popular-projects";
import { ProjectSearch } from "@/features/project/components/project-search";
export const dynamic="force-dynamic";
export const metadata={title:"프로젝트",description:"개발자의 공개 프로젝트를 검색어와 진행 상태로 찾아보세요."};
export default async function Projects({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const query=parseProjectQuery(await searchParams);
  return <><a className="skip-link" href="#main-content">본문으로 바로가기</a><SiteHeader projects /><main className="page-shell editorial-shell projects-shell" id="main-content"><section className="intro">{process.env.NODE_ENV==="development" && process.env.PEBBLE_PREVIEW_MODE==="mock" && <p className="preview-notice">목 데이터 미리보기 · 실제 프로젝트가 아닙니다</p>}<p className="page-eyebrow">THE WORK / 프로젝트</p><h1>아이디어가<br/><span>실제가 되기까지.</span></h1><p>직접 만든 것들, 해결한 문제들.<br/>개발자의 프로젝트와 그 과정을 살펴보세요.</p></section>
    {query ? <><ProjectSearch query={query}/>{query.page===0&&!query.q&&!query.techStackId&&!query.lifecycleStatus&&<Suspense fallback={<ProjectsLoading/>}><PopularProjects/></Suspense>}<Suspense key={JSON.stringify(query)} fallback={<ProjectsLoading/>}><ProjectList query={query}/></Suspense></> : <section className="list-state"><h2>검색 조건을 확인해 주세요</h2><p>검색어는 200자 이내, 진행 상태·페이지는 올바른 값이어야 합니다.</p><Link className="button" href="/projects">조건 초기화</Link></section>}
  </main></>;
}
