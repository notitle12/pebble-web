import Image from "next/image";
import Link from "next/link";
export function SiteHeader({ home = false, projects = false, tags = false, categories = false }: { home?: boolean; projects?: boolean; tags?: boolean; categories?: boolean }) {
  return <header className="site-header"><div className="header-inner">
    <Link className="brand" href="/" aria-label="Pebble 홈"><Image src="/pebble-logo.svg" alt="" width={36} height={36} priority /><span>Pebble</span></Link>
    <nav className="header-nav" aria-label="공개 탐색"><Link href="/" aria-current={home ? "page" : undefined}>글</Link><Link href="/projects" aria-current={projects ? "page" : undefined}>프로젝트</Link><Link href="/tags" aria-current={tags ? "page" : undefined}>태그</Link><Link href="/categories" aria-current={categories ? "page" : undefined}>분류</Link></nav>
    <span className="header-label">공개 탐색</span>
  </div></header>;
}
