import Link from "next/link";
import { getPopularPosts } from "../api/post-list";
import { PostCards } from "./post-cards";

export async function PopularPosts({retryHref="/",showTags=true,title="인기 게시글"}:{retryHref?:string;showTags?:boolean;title?:string}) {
  let result;
  let failed=false;
  try { result=await getPopularPosts(); } catch { failed=true; }
  return <section className="discovery-section popular-section" aria-labelledby="popular-posts-title">
    <div className="discovery-heading"><div><span className="section-eyebrow">함께 읽는 기록</span><h2 id="popular-posts-title">{title}</h2></div><Link href="/posts" prefetch={false}>게시글 더 보기 →</Link></div>
    {failed ? <div className="list-state" role="alert"><p>인기 게시글을 불러오지 못했어요.</p><a className="button" href={retryHref}>다시 시도</a></div>
      : result?.content.length ? <PostCards posts={result.content.slice(0,3)} showTags={showTags}/>
      : <p className="quiet-empty">공감이 쌓인 글을 이곳에서 만나보세요.</p>}
  </section>;
}
