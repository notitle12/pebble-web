import Link from "next/link";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import { PolicyBackButton } from "./policy-back-button";

export function PolicyDocument({title,version,children}:{title:string;version:string;children:ReactNode}) {
 return <><SiteHeader/><main className="page-shell legal-shell" id="main-content"><article className="legal-document">
  <PolicyBackButton/>
  <header><p className="legal-eyebrow">PEBBLE</p><h1>{title}</h1><p className="legal-version">문서 버전 {version}</p></header>
  {children}
  <footer className="legal-document-footer"><PolicyBackButton/><Link href="/terms">이용약관</Link><Link href="/privacy">개인정보 처리방침</Link><Link href="/">홈으로</Link></footer>
 </article></main></>;
}
