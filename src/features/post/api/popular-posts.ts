import type { PostPage, PostSummary } from "./post-list.ts";

export function comparePopularPosts(a: PostSummary, b: PostSummary): number {
  return (b.likeCount ?? 0) - (a.likeCount ?? 0)
    || Date.parse(b.publishedAt ?? b.createdAt) - Date.parse(a.publishedAt ?? a.createdAt)
    || (BigInt(a.id) < BigInt(b.id) ? 1 : BigInt(a.id) > BigInt(b.id) ? -1 : 0);
}

// The API does not support sorting by likes. Keep only the top three while
// scanning every validated page, so older popular posts are included too.
export async function loadPopularPosts<P extends PostPage>(loadPage: (page: number) => Promise<P>, active = () => true): Promise<P> {
  const first = await loadPage(0);
  let top = [...first.content].sort(comparePopularPosts).slice(0, 3);
  for (let page = 1; page < first.totalPages; page += 3) {
    if (!active()) throw new Error("인기 글 조회가 취소됐어요.");
    const pages=await Promise.all(Array.from({length:Math.min(3,first.totalPages-page)},(_,offset)=>{
      if (!active()) throw new Error("인기 글 조회가 취소됐어요.");
      return loadPage(page+offset);
    }));
    if (!active()) throw new Error("인기 글 조회가 취소됐어요.");
    top = [...new Map([...top, ...pages.flatMap(result=>result.content)].map(post => [post.id, post])).values()].sort(comparePopularPosts).slice(0, 3);
  }
  return { ...first, content: top };
}
