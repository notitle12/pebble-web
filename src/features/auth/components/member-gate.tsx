"use client";
import {useEffect,useSyncExternalStore,type ReactNode} from "react";
import Link from "next/link";
import {LoadingIndicator} from "@/components/loading-state";
import {SessionLoginPrompt} from "./session-login-prompt";
import {initialSession,listenSessionChanges,memberRequiresAgreement,userSession,type Member} from "../user-session";
export function useUserSession(){
  const session=useSyncExternalStore(userSession.subscribe,userSession.snapshot,()=>initialSession);
  useEffect(()=>{listenSessionChanges();void userSession.ensure();},[]);
  return session;
}
export function MemberGate({children,profile=false,preserveOnExpiry=false,preserveOnRefresh=false,requireAgreements=true,fallback}:{children:(member:Member)=>ReactNode;profile?:boolean;preserveOnExpiry?:boolean;preserveOnRefresh?:boolean;requireAgreements?:boolean;fallback?:ReactNode}){
  const session=useUserSession();
  const refreshing=(preserveOnRefresh||preserveOnExpiry)&&session.phase==="loading"&&session.member!==null;
  if(session.phase==="loading" && !((preserveOnExpiry||preserveOnRefresh) && session.member))return fallback !== undefined ? <>{fallback}</> : <LoadingIndicator label="로그인 상태를 확인하는 중" section/>;
  const expired=preserveOnExpiry && session.phase!=="ready" && session.phase!=="loading" && session.member!==null;
  if((session.phase==="ready" || expired || refreshing) && session.member){
    if(requireAgreements && memberRequiresAgreement(session.member))return <div className="list-state"><h2>이용 동의를 확인해 주세요</h2><p>서비스 기능을 이용하려면 약관과 개인정보 수집·이용에 동의해야 합니다.</p><Link className="button" href="/agreements">약관 동의하기</Link><p><Link href="/settings/account">계정 탈퇴</Link></p></div>;
    if(profile && !session.member.profileCompleted)return <div className="list-state"><h2>블로그를 먼저 설정해 주세요</h2><p>블로그명과 공개 아이디를 설정하면 글을 저장할 수 있어요.</p><Link className="button" href="/settings/profile">블로그 설정</Link></div>;
    return <>{expired&&<SessionLoginPrompt message={`${session.message} 입력 내용은 이 화면에 유지됩니다.`}/>}<div inert={expired||refreshing||session.phase==="loading"}>{children(session.member)}</div></>;
  }
  if(fallback !== undefined)return <>{fallback}</>;
  return <SessionLoginPrompt message={session.message}/>;
}
