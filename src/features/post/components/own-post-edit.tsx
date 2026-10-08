"use client";
import Link from "next/link";
import {useUserSession} from "@/features/auth/components/member-gate";

export function OwnPostEdit({postId,authorId}:{postId:string;authorId:string}) {
  const {phase,member}=useUserSession();
  if(phase!=="ready"||member?.id!==authorId)return null;
  return <nav className="post-owner-actions" aria-label="게시글 관리"><Link aria-label="게시글 수정" href={`/posts/${postId}/edit`}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12.5 3.5 4 4M3 17l4.5-1 10-10a1.8 1.8 0 0 0-3.5-3.5l-10 10L3 17Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg><span>수정</span></Link></nav>;
}
