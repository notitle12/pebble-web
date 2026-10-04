"use client";
import Link from "next/link";
import {useUserSession} from "@/features/auth/components/member-gate";
export function ProjectOwnerActions({ownerId,projectId}:{ownerId:string;projectId:string}) {
 const {phase,member}=useUserSession();
 if(phase!=="ready"||member?.id!==ownerId)return null;
 return <nav className="blog-owner-actions" aria-label="내 프로젝트 관리"><Link href={`/projects/${projectId}/edit`}>프로젝트 수정</Link><Link href="/me/projects">프로젝트 관리</Link></nav>;
}
