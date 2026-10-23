"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { MemberGate } from "../../auth/components/member-gate";
import { userSession, type Member } from "../../auth/user-session";
import { getContentInsights, INSIGHT_DAYS, insightDetailHref, insightHref, insightPoints, type ContentInsights as InsightsData, type InsightDays, type InsightItem } from "../model";
import styles from "./content-insights.module.css";
import { InsightItemLibrary } from "./insight-item-library";

const number = (value: number) => value.toLocaleString("ko-KR");
const label = (days: InsightDays) => days === 0 ? "전체" : `${days}일`;
function Ranking({ kind, rows, handle }: { kind: "posts" | "projects"; rows: InsightItem[]; handle: string | null }) {
  const name = kind === "posts" ? "게시글" : "프로젝트";
  return <section className={styles.ranking} aria-labelledby={`insight-${kind}-title`}><div className={styles.sectionHeading}><h2 id={`insight-${kind}-title`}>인기 {name}</h2><span>최대 10개</span></div>
    {rows.length === 0 ? <p className={styles.empty}>이 기간에 조회된 {name}이 없어요.</p> : <ol>{rows.map((item, index) => <li key={item.id}><span className={styles.rank}>{index + 1}</span><div className={styles.item}><Link href={insightHref(kind, item, handle)}>{item.title || "제목 없음"}</Link>{(item.visibilityStatus === "HIDDEN" || item.isBlocked || item.draft) && <small>{[item.draft && "임시 저장", item.visibilityStatus === "HIDDEN" && "비공개", item.isBlocked && "이용 제한"].filter(Boolean).join(" · ")}</small>}</div><div className={styles.rankingMeta}><span className={styles.views}>{number(item.views)}<small>회</small></span><Link className={styles.detailLink} href={insightDetailHref(kind, item.id)}>상세 통계</Link></div></li>)}</ol>}
  </section>;
}
function Trend({ data }: { data: InsightsData }) {
  const maximum = Math.max(1, ...data.daily.flatMap(day => [day.postViews, day.projectViews]));
  return <section className={styles.trend} aria-labelledby="insight-trend-title"><div className={styles.sectionHeading}><h2 id="insight-trend-title">조회 추이</h2>{data.days === 0 && <span>최근 30일</span>}</div>
    <div className={styles.legend}><span><i className={styles.postDot}/>게시글</span><span><i className={styles.projectDot}/>프로젝트</span></div>
    <div className={styles.chart}><span className={styles.maximum}>{number(maximum)}</span><svg viewBox="0 0 720 160" role="img" aria-label={`${data.chartDays}일간 게시글 및 프로젝트의 일별 조회 추이. 아래 일별 조회 수에서 상세 숫자를 확인할 수 있습니다.`}><path d="M16 24H704 M16 82H704 M16 140H704" className={styles.grid}/><polyline points={insightPoints(data.daily, "postViews")} className={styles.postLine}/><polyline points={insightPoints(data.daily, "projectViews")} className={styles.projectLine}/></svg><div className={styles.axis}><span>{data.daily[0].date.slice(5).replace("-", ".")}</span><span>{data.toDate.slice(5).replace("-", ".")}</span></div></div>
    <details className={styles.daily}><summary>일별 조회 수</summary><div className={styles.tableScroll}><table><caption className="sr-only">한국시간 기준 일별 조회 수</caption><thead><tr><th scope="col">날짜</th><th scope="col">게시글</th><th scope="col">프로젝트</th></tr></thead><tbody>{[...data.daily].reverse().map(day => <tr key={day.date}><th scope="row">{day.date}</th><td>{number(day.postViews)}</td><td>{number(day.projectViews)}</td></tr>)}</tbody></table></div></details>
  </section>;
}
function Dashboard({ member }: { member: Member }) {
  const [days, setDays] = useState<InsightDays>(30), [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ days: InsightDays; data: InsightsData | null; error: string; loading: boolean }>({ days: 30, data: null, error: "", loading: true });
  useEffect(() => {
    let live = true;
    setState({ days, data: null, error: "", loading: true });
    getContentInsights(days, path => userSession.request(path)).then(data => { if (live) setState({ days, data, error: "", loading: false }); }).catch(() => { if (live) setState({ days, data: null, error: "조회 통계를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.", loading: false }); });
    return () => { live = false; };
  }, [days, attempt, member.id]);
  const loading = state.days !== days || state.loading, data = state.days === days ? state.data : null;
  return <section className={styles.insights} aria-labelledby="insights-title"><Link className={styles.back} href="/settings/blog">← 블로그 관리</Link><p className="profile-eyebrow">{member.blogName ?? "Pebble"}</p><div className={styles.heading}><div><h1 id="insights-title">인사이트</h1><p>어떤 기록을 많이 읽었는지 확인해 보세요.</p></div><button type="button" className={styles.reload} disabled={loading} onClick={() => setAttempt(value => value + 1)} aria-label="조회 통계 새로고침">새로고침</button></div>
    <div className={styles.tabs} role="tablist" aria-label="조회 기간">{INSIGHT_DAYS.map((value, index) => <button id={`insight-tab-${value}`} key={value} role="tab" type="button" aria-selected={days === value} aria-controls="insight-panel" tabIndex={days === value ? 0 : -1} onClick={() => setDays(value)} onKeyDown={event => { const key = event.key; if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(key)) return; event.preventDefault(); const next = key === "Home" ? 0 : key === "End" ? INSIGHT_DAYS.length - 1 : (index + (key === "ArrowRight" ? 1 : -1) + INSIGHT_DAYS.length) % INSIGHT_DAYS.length; setDays(INSIGHT_DAYS[next]); document.getElementById(`insight-tab-${INSIGHT_DAYS[next]}`)?.focus(); }}>{label(value)}</button>)}</div>
    <div id="insight-panel" role="tabpanel" aria-labelledby={`insight-tab-${days}`} aria-busy={loading}>{loading ? <p className={styles.state} role="status">조회 통계를 불러오고 있어요.</p> : !data ? <div className={styles.state}><p role="alert">{state.error}</p><button type="button" className="button" onClick={() => setAttempt(value => value + 1)}>다시 불러오기</button></div> : <>
      <p className={styles.period}>{data.fromDate ? `${data.fromDate} – ${data.toDate}` : `집계 시작 – ${data.toDate}`} · 한국시간 기준</p><dl className={styles.summary}><div><dt>게시글 조회</dt><dd>{number(data.postViews)}<small>회</small></dd></div><div><dt>프로젝트 조회</dt><dd>{number(data.projectViews)}<small>회</small></dd></div></dl>
      <Trend data={data}/><div className={styles.rankings}><Ranking kind="posts" rows={data.posts} handle={member.handle}/><Ranking kind="projects" rows={data.projects} handle={member.handle}/></div>
      <InsightItemLibrary member={member}/><aside className={styles.note}><p>{new Intl.DateTimeFormat("ko-KR", { dateStyle: "long", timeZone: "Asia/Seoul" }).format(new Date(data.trackingStartedAt))}부터 집계하며, 이전 조회는 포함하지 않습니다.</p><p>공개 콘텐츠를 3초 이상 읽은 방문을 브라우저별·콘텐츠별 하루 한 번 집계합니다. 로그인한 작성자 본인의 조회는 제외하며, 브라우저·기기·쿠키 설정에 따라 실제 독자 수와 다를 수 있어요.</p><p>일별 통계는 최근 90일, 월별 통계는 최근 24개월 동안 보관하며 이전 통계는 연도별 합계로 통합합니다. 전체 조회는 누적으로 보여줍니다. 비공개·이용 제한 콘텐츠의 이전 조회는 유지되며, 삭제한 콘텐츠는 제외됩니다.</p></aside>
    </>}</div></section>;
}
export function ContentInsights() { return <MemberGate profile>{member => <Dashboard key={member.id} member={member}/>}</MemberGate>; }
