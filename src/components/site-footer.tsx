import Link from "next/link";
export function SiteFooter(){
 return <footer className="site-footer"><div className="site-footer-inner"><div className="site-footer-identity"><Link href="/" className="site-footer-brand" aria-label="Pebble 메인"><img src="/pebble-logo.svg" width="20" height="20" alt=""/><span>Pebble</span></Link><p>작은 기록이 쌓이는 곳</p></div><nav aria-label="푸터 메뉴"><Link href="/">메인</Link><Link href="/posts">게시글</Link><Link href="/projects">프로젝트</Link></nav><small>© Pebble</small></div></footer>;
}
