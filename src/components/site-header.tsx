import {SessionLinks} from "@/features/auth/components/session-links";
import Image from "next/image";
import Link from "next/link";
export function SiteHeader({ home = false, posts = false, projects = false }: { home?: boolean; posts?: boolean; projects?: boolean; tags?: boolean; categories?: boolean }) {
  return <header className="site-header"><div className="header-inner">
    <Link className="brand" href="/" aria-label="Pebble 메인"><Image src="/pebble-logo.svg" alt="" width={28} height={28} priority /><span>Pebble</span></Link>
    <nav className="header-nav" aria-label="공개 탐색"><Link href="/" aria-current={home ? "page" : undefined}>메인</Link><Link href="/posts" aria-current={posts ? "page" : undefined}>게시글</Link><Link href="/projects" aria-current={projects ? "page" : undefined}>프로젝트</Link></nav>
    <SessionLinks/>
  </div></header>;
}
