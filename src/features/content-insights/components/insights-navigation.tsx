import Link from "next/link";
import styles from "./content-insights.module.css";
export function InsightsNavigation({ active }: { active: "overview" | "content" }) {
  return <nav className={styles.routeTabs} aria-label="인사이트 메뉴"><Link href="/settings/blog/insights" aria-current={active === "overview" ? "page" : undefined}>개요</Link><Link href="/settings/blog/insights/content" aria-current={active === "content" ? "page" : undefined}>전체 콘텐츠</Link></nav>;
}
