"use client";
import Link from "next/link";
import {useUserSession} from "@/features/auth/components/member-gate";

export function OwnPostEdit({postId,authorId}:{postId:string;authorId:string}) {
  const {phase,member}=useUserSession();
  if(phase!=="ready"||member?.id!==authorId)return null;
  return <nav className="post-owner-actions" aria-label="게시글 관리"><Link href={`/posts/${postId}/edit`}>게시글 수정</Link></nav>;
}
