import Link from "next/link";
import {PolicyNavigation} from "@/features/legal/components/policy-navigation";
export function SiteFooter(){
 return <footer className="site-footer"><div className="site-footer-inner"><div className="site-footer-identity"><Link href="/" className="site-footer-brand" aria-label="Pebble 메인"><span>Pebble</span></Link><p>작은 기록이 쌓이는 곳</p></div><nav aria-label="푸터 메뉴"><PolicyNavigation/></nav><small>© Pebble</small></div></footer>;
}
