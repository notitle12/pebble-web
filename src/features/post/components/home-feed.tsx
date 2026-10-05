import Link from "next/link";
import { getPublicPosts, pageHref, type PostQuery } from "../api/post-list";
import { selectPopularRecent } from "../home-selection";
import { PostCards } from "./post-cards";
export async function HomeFeed({query}:{query:PostQuery}) {
  let result;
  try { result = await getPublicPosts(query.page,undefined,undefined,query); }
  catch { return <section className="list-state" role="alert"><h2>기록을 불러오지 못했어요</h2><p>잠시 후 다시 시도해 주세요.</p><a className="button" href={pageHref(query.page,query)}>다시 시도</a></section>; }
  const popular = query.page === 0 ? selectPopularRecent(result.content) : [];
  return <>
    {query.page===0 && <section className="discovery-section popular-section" aria-labelledby="popular-title">
      <div className="discovery-heading"><div><span className="section-eyebrow">함께 읽는 기록</span><h2 id="popular-title">공감받은 글</h2></div><p>최근 공개 글 20개 중 좋아요가 많은 글</p></div>
      {popular.length ? <PostCards posts={popular} showTags={false}/> : <p className="quiet-empty">공감이 쌓인 글을 이곳에서 만나보세요.</p>}
    </section>}
    <section className="discovery-section latest-section" aria-labelledby="latest-title">
      <div className="discovery-heading"><div><span className="section-eyebrow">오늘 더해진 이야기</span><h2 id="latest-title">최신 글</h2></div><p>{result.totalElements.toLocaleString("ko-KR")}개의 공개 기록</p></div>
      {result.content.length ? <PostCards posts={result.content} showTags={false}/> : <div className="quiet-empty"><p>{query.page ? "이 페이지에는 글이 없어요." : "아직 공개된 기록이 없어요. 첫 번째 이야기를 기다리고 있어요."}</p>{query.page>0&&<Link className="button" href="/">첫 페이지로</Link>}</div>}
      {!!result.content.length && <nav className="pagination" aria-label="최신 글 페이지 이동">{result.hasPrevious?<Link className="page-link" href={pageHref(query.page-1)} prefetch={false}>← 이전</Link>:<span className="page-link disabled" aria-disabled="true">← 이전</span>}<span aria-current="page">{query.page+1} / {result.totalPages}</span>{result.hasNext?<Link className="page-link" href={pageHref(query.page+1)} prefetch={false}>다음 →</Link>:<span className="page-link disabled" aria-disabled="true">다음 →</span>}</nav>}
    </section>
  </>;
}
