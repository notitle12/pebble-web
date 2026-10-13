"use client";
import Link from "next/link";
import {useUserSession} from "./member-gate";
import {LoginDialog} from "./login-dialog";
import {AccountMenu} from "./account-menu";
export function SessionLinks(){
  const session=useUserSession();
  return <nav className="session-links" aria-label="내 공간">
    <Link className="header-write" href="/posts/new" prefetch={false}>글 작성</Link>
    <Link className="header-write" href="/projects/new" prefetch={false}>프로젝트 생성</Link>
    <Link href="/me/blog" prefetch={false}>내 블로그</Link>
    {session.phase==="ready"&&session.member?<AccountMenu member={session.member}/>:session.phase==="loading"?<span role="status">확인 중…</span>:<LoginDialog/>}
  </nav>;
}
