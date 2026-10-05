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
        <p className="home-eyebrow">생각을 쓰고, 경험을 나누고.</p><h1>만드는 사람들의<br/><span>오래 남는 기록.</span></h1><p>한 줄의 코드부터 하나의 프로젝트까지.<br/>개발자의 작업과 그 뒤에 있는 이야기를 읽어보세요.</p><Link className="home-blog-link" href="/me/blog" prefetch={false}>내 블로그로 가기 <span aria-hidden="true">↗</span></Link>
        <aside className="hero-note"><span className="hero-note-index">PEBBLE / JOURNAL</span><p>좋은 기록은<br/>다음 작업의 시작이 됩니다.</p><Link href="/projects">만들어진 프로젝트 둘러보기 <span aria-hidden="true">↗</span></Link></aside>
      </section>
      {query === null ? <InvalidPage /> : <>
        <Suspense key={`search-${JSON.stringify(query)}`} fallback={<p role="status">검색 조건을 불러오고 있어요.</p>}><PostSearch query={query} /></Suspense>
        <Suspense key={JSON.stringify(query)} fallback={<PostListLoading />}><PostList query={query} /></Suspense>
      </>}
    </main>
    <footer className="site-footer">Pebble · 개발자의 생각을 담는 블로그</footer>
  </>;
}
