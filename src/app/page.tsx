import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { Suspense } from "react";
import { parsePostQuery } from "@/features/post/api/post-list";
import { InvalidPage, PostList, PostListLoading } from "@/features/post/components/post-list";

import { PostSearch } from "@/features/post/components/post-search";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const query = parsePostQuery(await searchParams);
  return <>
    <a className="skip-link" href="#main-content">본문으로 바로가기</a>
    <SiteHeader home />
    <main id="main-content" className="page-shell home-shell">
      <section className="intro home-intro">
        {process.env.NODE_ENV === "development" && process.env.PEBBLE_PREVIEW_MODE === "mock" && <p className="preview-notice" role="status">목 데이터 미리보기 · 실제 게시글이 아닙니다</p>}
        <p className="home-eyebrow">DEVELOPER JOURNALS</p><h1>개발의 과정이<br/>하나의 기록으로.</h1><p>개발자의 블로그에서 생각과 경험, 만들어 가는 프로젝트를 읽어보세요.</p><Link className="home-blog-link" href="/me/blog" prefetch={false}>내 블로그로 가기 <span aria-hidden="true">↗</span></Link>
      </section>
      {query === null ? <InvalidPage /> : <>
        <Suspense key={`search-${JSON.stringify(query)}`} fallback={<p role="status">검색 조건을 불러오고 있어요.</p>}><PostSearch query={query} /></Suspense>
        <Suspense key={JSON.stringify(query)} fallback={<PostListLoading />}><PostList query={query} /></Suspense>
      </>}
    </main>
    <footer className="site-footer">Pebble · 개발자의 생각을 담는 블로그</footer>
  </>;
}
