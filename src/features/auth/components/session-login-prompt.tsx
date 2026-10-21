"use client";
import {useEffect} from "react";
import {usePathname} from "next/navigation";
import Link from "next/link";
import {openLoginDialog} from "./login-dialog";
import {loginDestination} from "../login-destination";
export function SessionLoginPrompt({message=""}:{message?:string}){
 const pathname=usePathname(),destination=loginDestination(pathname);
 useEffect(()=>{openLoginDialog(destination);},[destination]);
 return <section className="list-state"><h2>로그인이 필요합니다</h2>{message&&<p role="status">{message}</p>}<div className="form-actions"><button type="button" className="button" onClick={()=>openLoginDialog(destination)}>로그인</button><Link className="button" href="/">메인으로</Link></div></section>;
}
