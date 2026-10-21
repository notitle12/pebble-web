"use client";
import { MemberGate } from "../../auth/components/member-gate";
import { BlogLinksEditor } from "./blog-links-editor";
export function BlogLinksSettings() {
  return <MemberGate profile>{member => <BlogLinksEditor key={member.id} member={member}/>}</MemberGate>;
}
