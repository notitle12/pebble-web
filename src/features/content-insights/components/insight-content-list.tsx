"use client";
import Link from "next/link";
import { MemberGate } from "../../auth/components/member-gate";
import { InsightsNavigation } from "./insights-navigation";
import { InsightItemLibrary } from "./insight-item-library";
import styles from "./content-insights.module.css";
export function InsightContentList() {
  return <MemberGate profile>{member => <section className={styles.insights} key={member.id}><Link className={styles.back} href="/settings/blog">← 블로그 관리</Link><p className="profile-eyebrow">{member.blogName ?? "Pebble"}</p><div className={styles.heading}><div><h1>인사이트</h1><p>각 콘텐츠의 통계를 확인하고 비교해 보세요.</p></div></div><InsightsNavigation active="content"/><InsightItemLibrary member={member}/></section>}</MemberGate>;
}
