import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { parsePostQuery } from "@/features/post/api/post-list";
import { InvalidPage, PostList, PostListLoading } from "@/features/post/components/post-list";
import { HomeFeed } from "@/features/post/components/home-feed";
import { KeywordSearch } from "@/features/search/components/keyword-search";
import { searchHref } from "@/features/search/query";
export const dynamic = "force-dynamic";
export default async function HomePage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const query=parsePostQuery(await searchParams);
  // 기존 키워드 검색 링크는 새 검색 화면으로 연결하되 분류 URL은 유지한다.
  if(query?.q && !query.tagId && !query.categoryId) redirect(searchHref({q:query.q,type:"posts",page:query.page}));
  const filtered=!!(query?.tagId||query?.categoryId);
  return <>
    <a className="skip-link" href="#main-content">본문으로 바로가기</a><SiteHeader home/>
    <main id="main-content" className="page-shell home-shell discovery-shell">
      <KeywordSearch/>
      {process.env.NODE_ENV==="development"&&process.env.PEBBLE_PREVIEW_MODE==="mock"&&<p className="preview-notice" role="status">목 데이터 미리보기 · 실제 게시글이 아닙니다</p>}
      <section className="pebble-banner" aria-labelledby="home-title">
        <div className="banner-copy"><p className="banner-eyebrow">A LITTLE, EVERY DAY</p><h1 id="home-title">하루의 작은 기록이<br/>나만의 길이 되도록.</h1><p>코드 한 줄, 새롭게 배운 것, 만들어 낸 프로젝트.<br/>작은 기록을 하나씩 쌓아가세요.</p><Link href="/me/blog" prefetch={false} className="banner-link">내 블로그에 기록 쌓기 <span aria-hidden="true">↗</span></Link></div>
        <div className="pebble-stack" aria-hidden="true"><span className="stone stone-one"/><span className="stone stone-two"/><span className="stone stone-three"/><span className="stone stone-four"/><span className="stack-caption">one day, one pebble.</span></div>
      </section>
      {!query?<InvalidPage/>:<Suspense key={JSON.stringify(query)} fallback={<PostListLoading/>}>{filtered?<PostList query={query}/>:<HomeFeed query={query}/>}</Suspense>}
    </main><footer className="site-footer">Pebble · 작은 기록이 쌓이는 곳</footer>
  </>;
}
