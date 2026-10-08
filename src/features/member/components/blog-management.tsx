"use client";
import Link from "next/link";
import { MemberGate } from "@/features/auth/components/member-gate";

const destinations = [
  ["프로필과 외부 링크", "/settings/profile", "블로그 이름, 프로필 사진, GitHub와 사이트 링크를 관리합니다."],
  ["게시판 관리", "/me/boards", "블로그의 게시판과 글 분류를 관리합니다."],
  ["게시글 관리", "/me/posts", "공개 글과 비공개 글을 관리합니다."],
  ["프로젝트 관리", "/me/projects", "블로그에 공개할 프로젝트를 관리합니다."],
  ["계정 설정", "/settings/account", "계정 상태와 탈퇴 예약을 관리합니다."],
] as const;

export function BlogManagement() {
  return <MemberGate>{member => <section className="blog-management" aria-labelledby="blog-management-title">
    <p className="profile-eyebrow">{member.blogName ?? "Pebble"}</p><h1 id="blog-management-title">블로그 관리</h1>
    <p className="blog-management-intro">내 블로그와 콘텐츠 설정을 관리합니다.</p>
    <nav aria-label="블로그 관리 메뉴"><ul>{destinations.map(([label, href, description]) => <li key={href}><Link href={href}><span>{label}</span><small>{description}</small><span className="blog-management-arrow" aria-hidden="true">→</span></Link></li>)}</ul></nav>
    {member.handle&&<Link className="blog-management-public" href={`/blogs/${encodeURIComponent(member.handle)}`}>내 블로그 보기</Link>}
  </section>}</MemberGate>;
}
