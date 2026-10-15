"use client";
import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import {NaverLoginButton} from "./naver-login-button";
import {loginDestination} from "../login-destination";
import {callbackMode,withdrawalIntentKey} from "../withdrawal-intent";
import {userSession} from "../user-session";
export function LoginPanel(){return <section className="list-state login-panel"><p className="login-eyebrow">PEBBLE BLOG</p><h1>나만의 개발 기록을 시작하세요</h1><p>회원 가입은 네이버가 제공한 출생연도와 생일로 만 14세 이상임을 확인한 경우에 진행됩니다. 나이 확인에 사용한 생년 정보는 저장하지 않습니다. 로그인하면 <Link href="/terms" target="_blank" rel="noreferrer">이용약관</Link>과 <Link href="/privacy" target="_blank" rel="noreferrer">개인정보 처리방침</Link> 안내를 확인할 수 있습니다. 회원 탈퇴 시 계정과 콘텐츠는 즉시 삭제되며 복구할 수 없습니다.</p><NaverLoginButton className="naver-provider-button" providerIcon/><p><Link href="/">블로그 글 둘러보기</Link></p></section>;}
export function NaverCallback(){
 const started=useRef(false),[error,setError]=useState(""),[withdrawn,setWithdrawn]=useState(false);
 useEffect(()=>{
  if(started.current)return;started.current=true;
  let destination="/me/posts",stored:string|null=null;
  try{destination=loginDestination(sessionStorage.getItem("pebble-login-destination"));sessionStorage.removeItem("pebble-login-destination");stored=sessionStorage.getItem(withdrawalIntentKey);sessionStorage.removeItem(withdrawalIntentKey);}catch{}
  const params=new URLSearchParams(window.location.search),code=params.get("code"),state=params.get("state");
  window.history.replaceState(null,"",window.location.pathname);
  if(params.has("error")){setError("네이버 인증을 완료하지 않았습니다. 다시 시작해 주세요.");return;}
  if(!code||!state||params.getAll("code").length!==1||params.getAll("state").length!==1||code.length>4096||state.length>256){setError("로그인 응답이 올바르지 않습니다. 다시 시작해 주세요.");return;}
  let mode;try{mode=callbackMode(stored,state);}catch(error){setError(error instanceof Error?error.message:"요청을 확인하지 못했습니다.");return;}
  const action=mode==="withdrawal"?userSession.completeWithdrawal(code,state):userSession.complete(code,state);
  void action.then(result=>{
    if(mode==="withdrawal"){setWithdrawn(result===true);if(result!==true)setError("탈퇴 결과를 확인하지 못했습니다.");}
    else if(userSession.snapshot().phase==="ready"){const member=userSession.snapshot().member;if(member&&!member.agreementsAccepted)window.location.replace(`/agreements?returnTo=${encodeURIComponent(destination)}`);else window.location.replace(member?.profileCompleted?destination:`/settings/profile?returnTo=${encodeURIComponent(destination)}`);}
    else setError("로그인 상태가 변경되었습니다. 다시 로그인해 주세요.");
  }).catch(error=>{setError(error instanceof Error?error.message:"요청을 완료하지 못했습니다.");});
 },[]);
 return <section className="list-state">{withdrawn?<><h1>회원 탈퇴가 완료되었어요</h1><p>회원 정보와 콘텐츠를 운영 데이터베이스에서 삭제했습니다. 관련 이미지 파일은 삭제 작업으로 회수됩니다.</p><Link href="/">블로그 둘러보기</Link></>:error?<><h1>요청을 완료하지 못했어요</h1><p role="alert">{error}</p><NaverLoginButton label="다시 로그인"/><Link href="/settings/account">계정 설정으로 돌아가기</Link></>:<p role="status">인증 요청을 처리하고 있어요.</p>}</section>;
}
