"use client";
import Link from "next/link";
import {useUserSession} from "./member-gate";
export function BlogOwnerActions({handle}:{handle:string}){
  const {phase,member}=useUserSession();
  if(phase!=="ready" || member?.handle!==handle)return null;
  return <nav className="blog-owner-actions" aria-label="내 블로그 관리"><Link href="/posts/new">새 글 쓰기</Link><Link href="/me/posts">글 관리</Link><Link href="/me/projects">프로젝트 관리</Link></nav>;
}
