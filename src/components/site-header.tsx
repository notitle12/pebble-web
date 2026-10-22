import {SessionLinks} from "@/features/auth/components/session-links";
import Image from "next/image";
import Link from "next/link";
import {IntentLink} from "./intent-link";
export function SiteHeader({ home = false, posts = false, projects = false, updates = false }: { home?: boolean; posts?: boolean; projects?: boolean; updates?: boolean; techStacks?: boolean; categories?: boolean }) {
  return <header className="site-header"><div className="header-inner">
    <Link className="brand" href="/" aria-label="Pebble 메인"><Image src="/pebble-logo.svg" alt="" width={28} height={28} priority /><span>Pebble</span></Link>
    <nav className="header-nav" aria-label="공개 탐색"><IntentLink href="/" aria-current={home ? "page" : undefined}>메인</IntentLink><IntentLink href="/posts" aria-current={posts ? "page" : undefined}>게시글</IntentLink><IntentLink href="/projects" aria-current={projects ? "page" : undefined}>프로젝트</IntentLink><IntentLink href="/updates" aria-current={updates ? "page" : undefined}>업데이트</IntentLink></nav>
    <SessionLinks/>
  </div></header>;
}
