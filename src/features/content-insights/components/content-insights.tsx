"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { MemberGate } from "../../auth/components/member-gate";
import { userSession, type Member } from "../../auth/user-session";
import { getContentInsights, INSIGHT_DAYS, type ContentInsights as InsightsData, type InsightDays, type InsightItem } from "../model";
import { InsightTrendChart } from "./insight-trend-chart";
import styles from "./content-insights.module.css";
import { InsightsNavigation } from "./insights-navigation";
import {useInsightFilters} from "./use-insight-filters";
import {insightDetailLink,insightPageHref,type InsightFilters} from "../insight-query";

const number = (value: number) => value.toLocaleString("ko-KR");
const label = (days: InsightDays) => `${days}일`;
function Ranking({ kind, rows, filters }: { kind: "posts" | "projects"; rows: InsightItem[]; filters:InsightFilters }) {
  const name = kind === "posts" ? "게시글" : "프로젝트";
  return <section className={styles.ranking} aria-labelledby={`insight-${kind}-title`}><div className={styles.sectionHeading}><h2 id={`insight-${kind}-title`}>많이 읽은 {name}</h2><Link className={styles.detailLink} href={insightPageHref(kind,{...filters,query:"",sort:"VIEWS",direction:"DESC"})}>전체 보기</Link></div>
    {rows.length === 0 ? <p className={styles.empty}>이 기간에 조회된 {name}이 없어요.</p> : <ol>{rows.map((item, index) => <li key={item.id}><span className={styles.rank}>{index + 1}</span><div className={styles.item}><Link prefetch={false} href={insightDetailLink(kind,item.id,filters,"overview")}>{item.title || "제목 없음"}</Link>{(item.visibilityStatus === "HIDDEN" || item.isBlocked || item.draft) && <small>{[item.draft && "임시 저장", item.visibilityStatus === "HIDDEN" && "비공개", item.isBlocked && "이용 제한"].filter(Boolean).join(" · ")}</small>}</div><div className={styles.rankingMeta}><span className={styles.views}>{number(item.views)}<small>회</small></span></div></li>)}</ol>}
  </section>;
}
function Trend({ data }: { data: InsightsData }) {
  return <section className={styles.trend} aria-labelledby="insight-trend-title"><div className={styles.sectionHeading}><h2 id="insight-trend-title">조회 추이</h2></div>
    <div className={styles.legend}><span><i className={styles.postDot}/>게시글</span><span><i className={styles.projectDot}/>프로젝트</span></div>
    <InsightTrendChart rows={data.daily.map(day => ({ label: day.date, values: [day.postViews, day.projectViews] }))} series={[{ label: "게시글", kind: "post" }, { label: "프로젝트", kind: "project" }]} compactDates label={`${data.chartDays}일간 게시글 및 프로젝트의 일별 조회 추이`}/>

  </section>;
}
function Dashboard({ member }: { member: Member }) {
  const {filters,change}=useInsightFilters();
  const days=filters.days,setDays=(days:InsightDays)=>change({days});
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ days: InsightDays; data: InsightsData | null; error: string; loading: boolean }>({ days: 7, data: null, error: "", loading: true });
  useEffect(() => {
    let live = true;
    setState({ days, data: null, error: "", loading: true });
    getContentInsights(days, path => userSession.request(path)).then(data => { if (live) setState({ days, data, error: "", loading: false }); }).catch(() => { if (live) setState({ days, data: null, error: "조회 통계를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.", loading: false }); });
    return () => { live = false; };
  }, [days, attempt, member.id]);
  const loading = state.days !== days || state.loading, data = state.days === days ? state.data : null;
  return <section className={styles.insights} aria-labelledby="insights-title"><Link className={styles.back} href="/settings/blog">← 블로그 관리</Link><p className="profile-eyebrow">{member.blogName ?? "Pebble"}</p><div className={styles.heading}><div><h1 id="insights-title">인사이트</h1><p>어떤 기록을 많이 읽었는지 확인해 보세요.</p></div><button type="button" className={styles.reload} disabled={loading} onClick={() => setAttempt(value => value + 1)} aria-label="조회 통계 새로고침">새로고침</button></div>
    <InsightsNavigation active="overview" filters={filters}/><div className={styles.tabs} role="tablist" aria-label="조회 기간">{INSIGHT_DAYS.map((value, index) => <button id={`insight-tab-${value}`} key={value} role="tab" type="button" aria-selected={days === value} aria-controls="insight-panel" tabIndex={days === value ? 0 : -1} onClick={() => setDays(value)} onKeyDown={event => { const key = event.key; if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(key)) return; event.preventDefault(); const next = key === "Home" ? 0 : key === "End" ? INSIGHT_DAYS.length - 1 : (index + (key === "ArrowRight" ? 1 : -1) + INSIGHT_DAYS.length) % INSIGHT_DAYS.length; setDays(INSIGHT_DAYS[next]); document.getElementById(`insight-tab-${INSIGHT_DAYS[next]}`)?.focus(); }}>{label(value)}</button>)}</div>
    <div id="insight-panel" role="tabpanel" aria-labelledby={`insight-tab-${days}`} aria-busy={loading}>{loading ? <p className={styles.state} role="status">조회 통계를 불러오고 있어요.</p> : !data ? <div className={styles.state}><p role="alert">{state.error}</p><button type="button" className="button" onClick={() => setAttempt(value => value + 1)}>다시 불러오기</button></div> : <>
      <p className={styles.period}>{data.fromDate ? `${data.fromDate} – ${data.toDate}` : `집계 시작 – ${data.toDate}`} · 한국시간 기준</p><dl className={styles.summary}><div><dt>게시글 조회</dt><dd>{number(data.postViews)}<small>회</small></dd></div><div><dt>프로젝트 조회</dt><dd>{number(data.projectViews)}<small>회</small></dd></div></dl>
      <Trend data={data}/><div className={styles.rankings}><Ranking kind="posts" rows={data.posts} filters={filters}/><Ranking kind="projects" rows={data.projects} filters={filters}/></div>

    </>}</div></section>;
}
export function ContentInsights() { return <MemberGate profile>{member => <Dashboard key={member.id} member={member}/>}</MemberGate>; }
