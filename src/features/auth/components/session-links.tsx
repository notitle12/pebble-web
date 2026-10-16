"use client";
import Link from "next/link";
import {useUserSession} from "./member-gate";
import {LoginDialog} from "./login-dialog";
import {AccountMenu} from "./account-menu";
import {ProtectedActionLink} from "./protected-action-link";
export function SessionLinks(){
  const session=useUserSession();
  return <nav className="session-links" aria-label="내 공간">
    {session.phase==="ready"&&session.member&&!session.member.agreementsAccepted?<Link className="header-write" href="/agreements" prefetch={false}>약관 동의</Link>:<><ProtectedActionLink className="header-write" href="/posts/new">글 작성</ProtectedActionLink><ProtectedActionLink className="header-write" href="/projects/new">프로젝트 생성</ProtectedActionLink><ProtectedActionLink href="/me/blog">내 블로그</ProtectedActionLink></>}
    {session.phase==="ready"&&session.member?<AccountMenu member={session.member}/>:session.phase==="loading"?<span role="status">확인 중…</span>:null}
    <LoginDialog showTrigger={session.phase!=="ready"&&session.phase!=="loading"}/>
  </nav>;
}
