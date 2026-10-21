"use client";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {ContentManagement} from "@/features/content/components/content-management";
import {useUserSession} from "@/features/auth/components/member-gate";
export function ProjectOwnerActions({ownerId,projectId,title}:{ownerId:string;projectId:string;title:string}) {
 const router=useRouter();
 const {phase,member}=useUserSession();
 if(phase!=="ready"||member?.id!==ownerId)return null;
 return <nav className="blog-owner-actions" aria-label="내 프로젝트 관리"><Link href={`/projects/${projectId}/edit`}>프로젝트 수정</Link><ContentManagement kind="projects" id={projectId} title={title} memberId={ownerId} onChanged={()=>router.replace("/me/projects")}/></nav>;
}
