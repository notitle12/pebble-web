"use client";
import Link from "next/link";
import {useUserSession} from "./member-gate";
import {NaverLoginButton} from "./naver-login-button";
import {useRouter} from "next/navigation";
import {userSession} from "../user-session";
import {safeProfileReturnTo} from "@/features/member/profile-model";
export function SessionLinks(){
  const session=useUserSession();
  const router=useRouter();
  return <nav className="session-links" aria-label="내 공간">
    <Link className="header-write" href="/posts/new" prefetch={false}>글 작성</Link>
    <Link href="/me/blog" prefetch={false}>내 블로그</Link>
    {session.phase==="ready"&&session.member?<><button className="header-logout" type="button" onClick={()=>void userSession.logout()}>로그아웃</button><details className="account-menu"><summary aria-label="프로필 메뉴"><span className="account-avatar">{session.member.profileImageUrl?<img src={session.member.profileImageUrl} alt=""/>:session.member.nickname.slice(0,1)}</span></summary><div className="account-menu-panel"><strong>{session.member.nickname}</strong><button type="button" onClick={()=>{const origin=typeof window==="undefined"?null:safeProfileReturnTo(`${window.location.pathname}${window.location.search}`);router.push(`/settings/profile${origin?`?returnTo=${encodeURIComponent(origin)}`:""}`);}}>{session.member.profileCompleted?"프로필":"블로그 생성"}</button>{session.member.profileCompleted&&<Link href="/settings/account">설정</Link>}</div></details></>:session.phase==="loading"?<span role="status">확인 중…</span>:<NaverLoginButton label="네이버 로그인" className="header-login"/>}
  </nav>;
}
