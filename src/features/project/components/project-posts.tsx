import Link from "next/link";
import {getProjectPosts} from "../api/project-posts";
import {projectHref} from "../api/project-list";
import {PostCards} from "../../post/components/post-cards";
export async function ProjectPosts({id,page}:{id:string;page:number}) {
  const href=(next:number)=>projectHref(id,next)!;
  let result;
  try {result=await getProjectPosts(id,page);} catch {return <section className="related-posts list-state" role="alert"><h2>관련 글을 불러오지 못했어요</h2><p>잠시 후 다시 시도해 주세요.</p><a className="button" href={href(page)}>관련 글 다시 시도</a></section>;}
  return <section className="related-posts" aria-label="프로젝트 관련 게시글"><div className="list-heading"><h2>관련 게시글</h2><span>총 {result.totalElements}개의 글</span></div>
    {result.content.length ? <PostCards posts={result.content}/> : <section className="list-state"><h3>{page>0 ? "이 페이지에는 관련 글이 없어요" : "아직 연결된 공개 글이 없어요"}</h3>{page>0 && <Link className="button" href={href(0)}>관련 글 첫 페이지로</Link>}</section>}
    {result.content.length>0 && <nav className="pagination" aria-label="관련 게시글 페이지 이동">{result.hasPrevious ? <Link className="page-link" href={href(page-1)} prefetch={false} aria-label="이전 관련 글 페이지">← 이전</Link> : <span className="page-link disabled" aria-disabled="true">← 이전</span>}<span aria-current="page">{page+1} / {result.totalPages} 페이지</span>{result.hasNext ? <Link className="page-link" href={href(page+1)} prefetch={false} aria-label="다음 관련 글 페이지">다음 →</Link> : <span className="page-link disabled" aria-disabled="true">다음 →</span>}</nav>}
  </section>;
}
