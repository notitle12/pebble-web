import Image from "next/image";
import Link from "next/link";
export function SiteHeader({ home = false, projects = false }: { home?: boolean; projects?: boolean }) {
  return <header className="site-header"><div className="header-inner">
    <Link className="brand" href="/" aria-label="Pebble 홈"><Image src="/pebble-logo.svg" alt="" width={36} height={36} priority /><span>Pebble</span></Link>
    <nav className="header-nav" aria-label="공개 탐색"><Link href="/" aria-current={home ? "page" : undefined}>글</Link><Link href="/projects" aria-current={projects ? "page" : undefined}>프로젝트</Link></nav>
    <span className="header-label">공개 탐색</span>
  </div></header>;
}
