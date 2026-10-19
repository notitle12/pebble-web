import Link from "next/link";
import Form from "next/form";
import { type ProjectQuery } from "../api/project-list";
export function ProjectSearch({ query }: { query: ProjectQuery }) {
  return <section className="search-panel" aria-label="프로젝트 검색">
    <Form action="/projects" prefetch={false} key={JSON.stringify(query)} autoComplete="off" className="search-form project-search-form">
      <div className="search-field"><label htmlFor="project-q">검색어</label><input id="project-q" name="q" type="search" defaultValue={query.q ?? ""} placeholder="프로젝트 이름, 소개, 기술 스택 검색" /></div>
      <div className="search-field"><label htmlFor="project-status">진행 상태</label><select id="project-status" name="lifecycleStatus" defaultValue={query.lifecycleStatus ?? ""}><option value="">전체 상태</option><option value="IN_PROGRESS">진행 중</option><option value="COMPLETED">완료</option></select></div>
      <button className="search-submit" type="submit">검색</button>{(query.q || query.techStackId || query.lifecycleStatus) && <Link className="search-reset" href="/projects">초기화</Link>}
    </Form><p className="search-help">검색어는 200자까지 입력할 수 있어요. 조건을 적용하면 첫 페이지부터 표시합니다.</p>
  </section>;
}
