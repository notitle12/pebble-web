"use client";
import {useEffect,useSyncExternalStore,type ReactNode} from "react";
import Link from "next/link";
import {initialSession,listenSessionChanges,userSession,type Member} from "../user-session";
export function useUserSession(){
  const session=useSyncExternalStore(userSession.subscribe,userSession.snapshot,()=>initialSession);
  useEffect(()=>{listenSessionChanges();void userSession.ensure();},[]);
  return session;
}
export function MemberGate({children,profile=false,preserveOnExpiry=false}:{children:(member:Member)=>ReactNode;profile?:boolean;preserveOnExpiry?:boolean}){
  const session=useUserSession();
  if(session.phase==="loading" && !(preserveOnExpiry && session.member))return <div className="list-state" role="status">로그인 상태를 확인하고 있어요.</div>;
  const expired=preserveOnExpiry && session.phase!=="ready" && session.member!==null;
  if((session.phase==="ready" || expired) && session.member){
    if(profile && !session.member.profileCompleted)return <div className="list-state"><h2>블로그를 먼저 설정해 주세요</h2><p>블로그명과 공개 아이디를 설정하면 글을 저장할 수 있어요.</p><Link className="button" href="/settings/profile">블로그 설정</Link></div>;
    return <><div hidden={!expired} className="list-state"><p role="alert">{session.message} 입력 내용은 이 화면에 유지됩니다.</p>{session.phase!=="loading"&&<Link className="button" href="/login">다시 로그인</Link>}</div><div inert={expired}>{children(session.member)}</div></>;
  }
  return <div className="list-state"><h2>로그인이 필요해요</h2><p role={session.phase==="error"?"alert":undefined}>{session.message||"내 글을 작성하고 저장하려면 Naver로 로그인해 주세요."}</p><Link className="button" href="/login">Naver 로그인</Link>{session.phase==="error"&&<button className="button" onClick={()=>void userSession.logout()}>로그아웃 다시 시도</button>}</div>;
}
