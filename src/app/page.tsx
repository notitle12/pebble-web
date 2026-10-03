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
      <span className="header-label">개발자의 기록</span>
    </div></header>
    <main id="main-content" className="page-shell">
      <section className="intro"><p className="eyebrow">작은 경험이 모여, 더 나은 개발로</p>
        <h1>개발자의 기록을 만나다</h1><p>코드와 경험, 문제를 해결해 나가는 과정을 함께 나눠요.</p>
      </section>
      {page === null ? <InvalidPage /> : <Suspense key={page} fallback={<PostListLoading />}><PostList page={page} /></Suspense>}
    </main>
    <footer className="site-footer">Pebble · 함께 쌓아가는 개발 기록</footer>
  </>;
}
