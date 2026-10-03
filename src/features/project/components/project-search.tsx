import Link from "next/link";
import Form from "next/form";
import { getPublicTags, type PublicTag } from "../../tag/api/public-tags";
import { TagPicker } from "../../tag/components/tag-picker";
import { projectPageHref, type ProjectQuery } from "../api/project-list";
export async function ProjectSearch({ query }: { query: ProjectQuery }) {
  let tags: PublicTag[] = []; let failed = false;
  try { tags = await getPublicTags(); } catch { failed = true; }
  return <section className="search-panel" aria-label="프로젝트 검색">
    <Form action="/projects" prefetch={false} key={JSON.stringify(query)} autoComplete="off" className="search-form project-search-form">
      <div className="search-field"><label htmlFor="project-q">검색어</label><input id="project-q" name="q" type="search" defaultValue={query.q ?? ""} placeholder="프로젝트 이름, 소개, 기술 태그 검색" /></div>
      <div className="search-field"><label htmlFor="post-tag">기술 태그</label><TagPicker key={query.tagId ?? ""} tags={tags} selected={query.tagId} disabled={failed} /></div>
      <div className="search-field"><label htmlFor="project-status">진행 상태</label><select id="project-status" name="lifecycleStatus" defaultValue={query.lifecycleStatus ?? ""}><option value="">전체 상태</option><option value="IN_PROGRESS">진행 중</option><option value="COMPLETED">완료</option></select></div>
      <button className="search-submit" type="submit">검색</button>{(query.q || query.tagId || query.lifecycleStatus) && <Link className="search-reset" href="/projects">초기화</Link>}
    </Form><p className="search-help">검색어는 200자까지 입력할 수 있어요. 조건을 적용하면 첫 페이지부터 표시합니다.</p>
    {failed && <p className="search-help" role="alert">태그를 불러오지 못했어요. 다른 조건으로 찾거나 <a href={projectPageHref(query.page,query)}>다시 시도</a>해 주세요.</p>}
  </section>;
}
