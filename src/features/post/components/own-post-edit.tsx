"use client";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {ContentManagement} from "@/features/content/components/content-management";
import {useUserSession} from "@/features/auth/components/member-gate";
export function OwnPostEdit({postId,authorId,title}:{postId:string;authorId:string;title:string}) {
 const router=useRouter(),{phase,member}=useUserSession();
 if(phase!=="ready"||member?.id!==authorId)return null;
 return <nav className="blog-owner-actions" aria-label="게시글 관리"><Link aria-label="게시글 수정" href={`/posts/${postId}/edit`}>수정</Link><ContentManagement kind="posts" id={postId} title={title} memberId={authorId} onChanged={()=>router.replace("/me/posts")}/></nav>;
}
