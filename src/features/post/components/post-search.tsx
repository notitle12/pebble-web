import Link from "next/link";
import Form from "next/form";
import { getPublicTags, pageHref, type PostQuery, type PublicTag } from "../api/post-list";

export async function PostSearch({ query }: { query: PostQuery }) {
  let tags: PublicTag[] = [];
  let failed = false;
  try { tags = await getPublicTags(); } catch { failed = true; }
  const { q, tagId } = query;
  const missingTag = tagId && !tags.some(tag => tag.id === tagId);
  return <section className="search-panel" aria-label="게시글 검색">
    <Form action="/" className="search-form" prefetch={false} key={`${q ?? ""}-${tagId ?? ""}`} autoComplete="off">
      <div className="search-field"><label htmlFor="post-q">검색어</label>
        <input id="post-q" name="q" type="search" defaultValue={q ?? ""} placeholder="제목, 본문, 기술 태그 검색" aria-describedby="search-help" />
      </div>
      <div className="search-field"><label htmlFor="post-tag">기술 태그</label>
        <select id="post-tag" name={failed ? undefined : "tagId"} defaultValue={tagId ?? ""} disabled={failed}>
          <option value="">전체 태그</option>
          {missingTag && <option value={tagId}>선택한 태그 ({tagId})</option>}
          {tags.map(tag => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
        </select>
        {failed && tagId && <input type="hidden" name="tagId" value={tagId} />}
      </div>
      <button className="search-submit" type="submit">검색</button>
      {(q || tagId) && <Link className="search-reset" href="/">초기화</Link>}
    </Form>
    <p id="search-help" className="search-help">검색어는 200자까지 입력할 수 있어요. 검색하면 첫 페이지부터 표시합니다.</p>
    {failed && <p className="search-help" role="alert">태그를 불러오지 못했어요. 검색어로 찾거나 <a href={pageHref(query.page, query)}>다시 시도</a>해 주세요.</p>}
  </section>;
}
