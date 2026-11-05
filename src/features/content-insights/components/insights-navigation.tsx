import Link from "next/link";
import styles from "./content-insights.module.css";
import {insightPageHref,type InsightFilters,type InsightView} from '../insight-query';
export function InsightsNavigation({active,filters}:{active:InsightView;filters:InsightFilters}) {
  return <nav className={styles.routeTabs} aria-label="인사이트 메뉴">{([['overview','전체 인사이트'],['posts','게시글'],['projects','프로젝트']] as const).map(([view,label])=><Link key={view} href={insightPageHref(view,filters)} aria-current={active===view?'page':undefined}>{label}</Link>)}</nav>;
}
