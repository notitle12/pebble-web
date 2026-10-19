import Link from "next/link";
import { getPopularProjects } from "../api/project-list";
import { ProjectCards } from "./project-cards";

export async function PopularProjects({retryHref="/projects"}:{retryHref?:string}) {
  let result;
  let failed=false;
  try { result=await getPopularProjects(); } catch { failed=true; }
  return <section className="discovery-section popular-projects-section" aria-labelledby="popular-projects-title">
    <div className="discovery-heading"><div><span className="section-eyebrow">함께 주목하는 작업</span><h2 id="popular-projects-title">인기 프로젝트</h2></div><Link href="/projects" prefetch={false}>프로젝트 더 보기 →</Link></div>
    {failed ? <div className="list-state" role="alert"><p>인기 프로젝트를 불러오지 못했어요.</p><a className="button" href={retryHref}>다시 시도</a></div>
      : result?.content.length ? <ProjectCards projects={result.content.slice(0,3)}/>
      : <p className="quiet-empty">공감이 쌓인 프로젝트를 이곳에서 만나보세요.</p>}
  </section>;
}
