import Link from "next/link";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import { getLegalPolicyConfig } from "../policy";

export function PolicyDocument({title,version,children}:{title:string;version:string;children:ReactNode}) {
 const config=getLegalPolicyConfig();
 return <><SiteHeader/><main className="page-shell legal-shell" id="main-content"><article className="legal-document">
  <header><p className="legal-eyebrow">PEBBLE</p><h1>{title}</h1><p className="legal-version">문서 버전 {version}{config.ready?" · 시행일 2026년 10월 15일":" · 검토용 초안"}</p></header>
  {!config.ready&&<aside className="legal-draft" role="status"><strong>공개 준비 중인 문서입니다.</strong><p>운영 주체·문의 창구와 개인정보 처리 내용을 확인하고 있어요. 이 초안으로 신규 동의를 받지 않습니다.</p></aside>}
  {children}
  <footer className="legal-document-footer"><Link href="/terms">이용약관</Link><Link href="/privacy">개인정보 처리방침</Link><Link href="/">홈으로</Link></footer>
 </article></main></>;
}
