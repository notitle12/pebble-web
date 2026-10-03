import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { parsePage } from "@/features/post/api/post-list";
import { InvalidPage, PostList, PostListLoading } from "@/features/post/components/post-list";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const page = parsePage((await searchParams).page);
  return <>
    <a className="skip-link" href="#main-content">본문으로 바로가기</a>
    <header className="site-header"><div className="header-inner">
      <Link className="brand" href="/" aria-label="Pebble 홈"><Image src="/pebble-logo.svg" alt="" width={36} height={36} priority /><span>Pebble</span></Link>
      <nav className="header-nav" aria-label="공개 탐색"><Link href="/" aria-current="page">글</Link></nav>
      <span className="header-label">공개 탐색</span>
    </div></header>
    <main id="main-content" className="page-shell">
      <section className="intro">
        {process.env.NODE_ENV === "development" && process.env.PEBBLE_PREVIEW_MODE === "mock" && <p className="preview-notice" role="status">목 데이터 미리보기 · 실제 게시글이 아닙니다</p>}
        <h1>개발자의 기록과 프로젝트를 만나보세요</h1><p>다양한 개발자의 경험과 기술 기록을 둘러보세요.</p>
      </section>
      {page === null ? <InvalidPage /> : <Suspense key={page} fallback={<PostListLoading />}><PostList page={page} /></Suspense>}
    </main>
    <footer className="site-footer">Pebble · 함께 쌓아가는 개발 기록</footer>
  </>;
}
