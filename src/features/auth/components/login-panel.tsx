"use client";
import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import {NaverLoginButton} from "./naver-login-button";
import {loginDestination} from "../login-destination";
import {callbackMode,withdrawalIntentKey} from "../withdrawal-intent";
import {MemberApiError} from "@/lib/member-api";
import {formatSeoulDateTime} from "@/lib/date-time";
import {userSession} from "../user-session";
export function LoginPanel(){return <section className="list-state login-panel"><p className="login-eyebrow">PEBBLE BLOG</p><h1>나만의 개발 기록을 시작하세요</h1><p>네이버 계정으로 로그인하면 글을 쓰고 내 블로그를 관리할 수 있어요. 탈퇴 예약 후 7일 안에 같은 계정으로 로그인하면 계정이 복구됩니다.</p><NaverLoginButton/><p><Link href="/">블로그 글 둘러보기</Link></p></section>;}
export function NaverCallback(){
 const started=useRef(false),[error,setError]=useState(""),[scheduledAt,setScheduledAt]=useState<string|null>(null),[withdrawn,setWithdrawn]=useState(false);
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
    if(mode==="withdrawal"){setScheduledAt(result as string);setWithdrawn(true);}
    else if(userSession.snapshot().phase==="ready")window.location.replace(userSession.snapshot().member?.profileCompleted?destination:"/settings/profile");
    else setError("로그인 상태가 변경되었습니다. 다시 로그인해 주세요.");
  }).catch(error=>{const isPending=error instanceof MemberApiError&&error.code==="WITHDRAWAL_PENDING";setScheduledAt(isPending?error.withdrawalScheduledAt??null:null);setError(error instanceof Error?error.message:"요청을 완료하지 못했습니다.");});
 },[]);
 return <section className="list-state">{withdrawn?<><h1>탈퇴를 예약했어요</h1><p>네이버 연결을 해제했습니다. 삭제 예정일까지 7일 동안 계정과 콘텐츠가 숨겨집니다.</p>{scheduledAt&&<p>삭제 예정: {formatSeoulDateTime(scheduledAt)}</p>}<p>기한 전에 같은 네이버 계정으로 로그인하면 계정이 복구되고 탈퇴 예약이 취소됩니다.</p><Link href="/">블로그 둘러보기</Link><Link href="/login">계정 복구하기</Link></>:error?<><h1>요청을 완료하지 못했어요</h1><p role="alert">{error}</p>{scheduledAt&&<p>삭제 예정: {formatSeoulDateTime(scheduledAt)}</p>}<NaverLoginButton label="다시 로그인"/><Link href="/settings/account">계정 설정으로 돌아가기</Link></>:<p role="status">인증 요청을 처리하고 있어요.</p>}</section>;
}
