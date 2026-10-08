"use client";
import Link from "next/link";
import {useUserSession} from "./member-gate";
export function BlogOwnerActions({handle}:{handle:string}){
  const {phase,member}=useUserSession();
  if(phase!=="ready" || member?.handle!==handle)return null;
  return <nav className="blog-owner-actions" aria-label="내 블로그 관리"><Link href="/settings/blog">블로그 설정</Link></nav>;
}
