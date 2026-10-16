"use client";
import {useRef,useState} from "react";
import {loginDestination} from "../login-destination";
import {withdrawalIntentKey,type NaverMode} from "../withdrawal-intent";
import {userSession} from "../user-session";

export function NaverLoginButton({label="네이버로 로그인",className="button naver-login",mode="login",providerIcon=false,destination}:{label?:string;className?:string;mode?:NaverMode;providerIcon?:boolean;destination?:string}){
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  const starting=useRef(false);
  const isLogin = mode === "login";
  return <span className="login-action"><button type="button" className={isLogin ? undefined : className} style={isLogin ? {padding:0,border:0,background:"transparent",cursor:"pointer",display:"block",width:"100%",maxWidth:340,margin:"0 auto"} : undefined} disabled={busy} onClick={async()=>{
    if(starting.current)return;starting.current=true;setBusy(true);setError("");
    try{
      const href=mode==="withdrawal"?await userSession.startWithdrawal():await userSession.authorization();
      const clientId=new URL(href).searchParams.get("client_id");
      if(process.env.NODE_ENV==="development" && ["local-preview","test-client-id"].includes(clientId??""))throw new Error("현재 API는 테스트용 네이버 설정입니다. 실제 로그인을 사용하려면 API의 NAVER_CLIENT_ID·NAVER_CLIENT_SECRET과 네이버에 등록한 콜백 주소를 설정해야 합니다.");
      if(mode==="withdrawal") {
        const states=new URL(href).searchParams.getAll("state"),state=states[0];if(!state||states.length!==1)throw new Error("탈퇴 인증 요청을 확인하지 못했습니다.");
        try{sessionStorage.setItem(withdrawalIntentKey,JSON.stringify({mode,state}));}catch{throw new Error("브라우저 저장소를 사용할 수 없어 탈퇴 인증을 시작하지 못했습니다.");}
      }else {try{sessionStorage.removeItem(withdrawalIntentKey);sessionStorage.setItem("pebble-login-destination",loginDestination(destination??window.location.pathname));}catch{/* Login still works when browser storage is unavailable. */}}
      window.location.assign(href);
    }catch(e){setError(e instanceof Error?e.message:"로그인을 시작하지 못했습니다.");starting.current=false;setBusy(false);}
  }} aria-label={isLogin ? "네이버 로그인" : label}>{isLogin ? <img src="/auth/naver-login-btn.png" alt="네이버 로그인" width={1024} height={133} style={{display:"block",width:"100%",height:"auto",borderRadius:6}}/> : <>{providerIcon&&<img src="/auth/naver-login-icon.png" alt="" width={48} height={48}/>}{busy?"네이버로 이동 중…":label}</>}</button>{error&&<span className="login-error" role="alert">{error}</span>}</span>;
}
