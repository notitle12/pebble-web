"use client";
import Link from "next/link";
import {useUserSession} from "./member-gate";
import {NaverLoginButton} from "./naver-login-button";
export function SessionLinks(){
  const session=useUserSession();
  return <nav className="session-links" aria-label="내 공간">
    <Link href="/me/blog" prefetch={false}>내 블로그</Link>
    {session.phase==="ready"?<><Link href="/me/posts" prefetch={false}>글 관리</Link><Link href="/me/projects" prefetch={false}>프로젝트 관리</Link></>:session.phase==="loading"?<span role="status">확인 중…</span>:<NaverLoginButton label="네이버 로그인" className="header-login"/>}
  </nav>;
}
