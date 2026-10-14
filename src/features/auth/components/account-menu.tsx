"use client";
import Link from "next/link";
import {ThemeChoice} from "@/features/appearance/components/theme-choice";
import {useRef} from "react";
import {useRouter} from "next/navigation";
import {userSession,type Member} from "../user-session";
import {safeProfileReturnTo} from "@/features/member/profile-model";
import {safeMediaUrl} from "@/features/media/model";
export function AccountMenu({member}:{member:Member}){
  const router=useRouter();
  const menu=useRef<HTMLDetailsElement>(null);
  const image=safeMediaUrl(member.profileImageUrl);
  function closeMenu(){if(menu.current)menu.current.open=false;}
  return <details ref={menu} className="account-menu"><summary aria-label="프로필 메뉴"><span className="account-avatar">{image?<img src={image} alt=""/>:member.nickname.slice(0,1)}</span></summary><div className="account-menu-panel"><div className="account-menu-heading"><strong>{member.nickname}</strong><ThemeChoice/></div><button type="button" onClick={()=>{closeMenu();const origin=typeof window==="undefined"?null:safeProfileReturnTo(`${window.location.pathname}${window.location.search}`);router.push(`/settings/profile${origin?`?returnTo=${encodeURIComponent(origin)}`:""}`);}}>프로필 설정</button><Link href="/settings/blog" onClick={closeMenu}>블로그 설정</Link><Link href="/settings/account" onClick={closeMenu}>회원 탈퇴</Link><button type="button" onClick={()=>{closeMenu();void userSession.logout();}}>로그아웃</button></div></details>;
}
