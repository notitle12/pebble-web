"use client";
import {useEffect,useRef,useState} from "react";
import {NaverLoginButton} from "./naver-login-button";
import {loginDestination} from "../login-destination";

export const OPEN_LOGIN_DIALOG_EVENT = "pebble:open-login-dialog";

export function openLoginDialog(destination?:string){
 if(typeof window==="undefined")return;
 window.dispatchEvent(new CustomEvent(OPEN_LOGIN_DIALOG_EVENT,{detail:{destination:destination===undefined?undefined:loginDestination(destination)}}));
}

export function LoginDialog({showTrigger=true}:{showTrigger?:boolean}){
 const dialog=useRef<HTMLDialogElement>(null);
 const [open,setOpen]=useState(false);
 const [destination,setDestination]=useState<string|null>(null);
 useEffect(()=>{
  if(!open)return;
  const previous=document.body.style.overflow;
  document.body.style.overflow="hidden";
  return ()=>{document.body.style.overflow=previous;};
 },[open]);
 useEffect(()=>{
  const handleOpen=(event:Event)=>{
   const requested=(event as CustomEvent<{destination?:unknown}>).detail?.destination;
   setDestination(typeof requested==="string"?loginDestination(requested):null);
   if(dialog.current&&!dialog.current.open){
    try{dialog.current.showModal();}catch{/* ignore */}
   }
   setOpen(true);
  };
  window.addEventListener(OPEN_LOGIN_DIALOG_EVENT,handleOpen);
  return ()=>window.removeEventListener(OPEN_LOGIN_DIALOG_EVENT,handleOpen);
 },[]);
 return <>
  {showTrigger&&<button type="button" className="header-login" aria-haspopup="dialog" onClick={()=>{setDestination(null);dialog.current?.showModal();setOpen(true);}}>로그인</button>}
  <dialog ref={dialog} className="login-dialog" aria-labelledby="login-dialog-title" aria-describedby="login-dialog-description" onClose={()=>{setOpen(false);setDestination(null);}} onClick={event=>{
   if(event.target!==event.currentTarget)return;
   const bounds=event.currentTarget.getBoundingClientRect();
   if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)event.currentTarget.close();
  }}>
   <button type="button" className="login-dialog-close" aria-label="로그인 창 닫기" autoFocus onClick={()=>dialog.current?.close()}><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
   <div className="login-dialog-brand"><img src="/pebble-logo.svg" alt="" width={56} height={56}/><span>Pebble</span></div>
   <h2 id="login-dialog-title">로그인</h2>
   <p id="login-dialog-description">로그인에 필요한 네이버 계정 정보를 처리합니다. <a href="/terms" target="_blank" rel="noreferrer">이용약관</a>과 <a href="/privacy" target="_blank" rel="noreferrer">개인정보 처리방침</a>을 확인해 주세요.</p>
   {open&&<NaverLoginButton label="네이버로 로그인" className="naver-provider-button" providerIcon destination={destination??undefined}/>}
  </dialog>
 </>;
}
