import Link from "next/link";
import { getPublicPosts, pageHref, PostListError, type PostQuery } from "../api/post-list";

export function PostListLoading() {
  return <section className="list-state" role="status" aria-live="polite">
    <span className="loading-dot" aria-hidden="true" />게시글을 불러오고 있어요.
  </section>;
}
export function InvalidPage() {
  return <section className="list-state"><h2>검색 조건을 확인해 주세요</h2>
    <p>검색어는 200자 이내, 태그와 페이지 번호는 올바른 값이어야 합니다.</p><Link className="button" href="/">첫 페이지로</Link>
  </section>;
}
const dateFormat = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Seoul" });

export async function PostList({ query }: { query: PostQuery }) {
  const { page, q, tagId } = query;
  const filtered = Boolean(q || tagId);
  let result;
  try { result = await getPublicPosts(page, undefined, undefined, query); }
  catch (error) {
    const network = error instanceof PostListError && error.kind === "network";
    return <section className="list-state" role="alert"><h2>게시글을 불러오지 못했어요</h2>
      <p>{network ? "연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요." : "일시적으로 목록을 표시할 수 없습니다. 잠시 후 다시 시도해 주세요."}</p>
      <a className="button" href={pageHref(page, query)}>다시 시도</a>
    </section>;
  }
  if (result.content.length === 0) {
    return <section className="list-state"><h2>{page === 0 ? (filtered ? "조건에 맞는 글이 없어요" : "아직 공개된 글이 없어요") : "이 페이지에는 게시글이 없어요"}</h2>
      <p>{page === 0 ? (filtered ? "검색어나 기술 태그를 바꿔서 다시 찾아보세요." : "새로운 개발 기록이 올라오면 이곳에서 만나볼 수 있어요.") : "글이 삭제되거나 목록이 변경되었을 수 있습니다."}</p>
      {page > 0 && <Link className="button" href={pageHref(0, query)}>첫 페이지로</Link>}
      {filtered && <Link className="button" href="/">조건 초기화</Link>}
    </section>;
  }
  return <section aria-label="공개 게시글 목록">
    <div className="list-heading"><h2>{filtered ? "검색 결과" : "최근 게시글"}</h2><span>총 {result.totalElements.toLocaleString("ko-KR")}개의 글</span></div>
    <ul className="post-list">{result.content.map(post => {
      const date = post.publishedAt ?? post.createdAt;
      return <li key={post.id}><article className="post-card">
        <div className="post-meta"><span>{post.author.nickname}</span><span aria-hidden="true">·</span><time dateTime={date}>{dateFormat.format(new Date(date))}</time></div>
        <h3>{post.title}</h3>
        {post.summary && <p className="post-summary">{post.summary}</p>}
        {post.tags.length > 0 && <ul className="tag-list" aria-label="기술 태그">{post.tags.map(tag => <li key={tag.id}>{tag.name}</li>)}</ul>}
      </article></li>;
    })}</ul>
    <nav className="pagination" aria-label="게시글 페이지 이동">
      {result.hasPrevious ? <Link className="page-link" href={pageHref(page - 1, query)} prefetch={false} aria-label="이전 페이지">← 이전</Link> : <span className="page-link disabled" aria-disabled="true">← 이전</span>}
      <span aria-current="page">{page + 1} / {result.totalPages} 페이지</span>
      {result.hasNext ? <Link className="page-link" href={pageHref(page + 1, query)} prefetch={false} aria-label="다음 페이지">다음 →</Link> : <span className="page-link disabled" aria-disabled="true">다음 →</span>}
    </nav>
  </section>;
}
