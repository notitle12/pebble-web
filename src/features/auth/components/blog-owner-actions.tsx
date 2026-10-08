"use client";
import Link from "next/link";
import {useUserSession} from "./member-gate";
export function BlogOwnerActions({handle}:{handle:string}){
  const {phase,member}=useUserSession();
  if(phase!=="ready" || member?.handle!==handle)return null;
  return <nav className="blog-owner-actions" aria-label="내 블로그 관리"><Link href="/settings/blog"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"><path d="m9.5 3-.6 2.1-1.5.9-2.1-.5-2.5 4.3 1.5 1.6v1.8l-1.5 1.6 2.5 4.3 2.1-.5 1.5.9.6 2.1h5l.6-2.1 1.5-.9 2.1.5 2.5-4.3-1.5-1.6v-1.8l1.5-1.6-2.5-4.3-2.1.5-1.5-.9-.6-2.1Z"/><circle cx="12" cy="12" r="3"/></svg><span>블로그 설정</span></Link></nav>;
}
