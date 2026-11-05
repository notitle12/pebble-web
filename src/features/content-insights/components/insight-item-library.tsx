"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { userSession, type Member } from "../../auth/user-session";
import { getInsightItems, type ContentKind, type InsightItem, type InsightSort, type InsightDirection } from "../model";
import styles from "./content-insights.module.css";
import {insightDetailLink,type InsightFilters} from '../insight-query';
function Rows({ kind, query, sort, direction, member,filters }: { kind: ContentKind; query: string; sort: InsightSort; direction: InsightDirection; member: Member;filters:InsightFilters }) {
  const [page, setPage] = useState(0), [attempt, setAttempt] = useState(0);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [rows, setRows] = useState<InsightItem[]>([]), [total, setTotal] = useState(0), [loading, setLoading] = useState(true), [error, setError] = useState("");
  useEffect(() => { let live = true; setLoading(true); setError("");
    getInsightItems(kind, page, query, path => userSession.request(path), { sort, direction }).then(result => { if (!live) return; setRows(current => page === 0 ? result.items : [...current, ...result.items.filter(item => !current.some(old => old.id === item.id))]); setTotal(result.totalElements); setLikeCounts(current => page === 0 ? result.likeCounts : { ...current, ...result.likeCounts }); }).catch(() => { if (live) setError("콘텐츠 목록을 불러오지 못했어요. 다시 시도해 주세요."); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [kind, query, sort, direction, page, attempt, member.id]);
  return <div className={styles.libraryResults} aria-busy={loading}>{rows.length > 0 && <ul className={styles.libraryList}>{rows.map(item => <li key={item.id}><div className={styles.item}><Link prefetch={false} href={insightDetailLink(kind,item.id,filters,kind)}>{item.title || "제목 없음"}</Link><small>{[item.draft && "임시 저장", item.visibilityStatus === "HIDDEN" && "비공개", item.isBlocked && "이용 제한", `누적 ${item.views.toLocaleString("ko-KR")}회`, sort === "POPULAR" && `공감 ${(likeCounts[item.id] ?? 0).toLocaleString("ko-KR")}개`].filter(Boolean).join(" · ")}</small></div></li>)}</ul>}{loading && <p className={styles.empty} role="status">콘텐츠를 불러오고 있어요.</p>}{!loading && !error && rows.length === 0 && <p className={styles.empty}>검색 조건에 맞는 콘텐츠가 없어요.</p>}{error && <p role="alert" className={styles.empty}>{error} <button type="button" className={styles.textButton} onClick={() => setAttempt(value => value + 1)}>다시 불러오기</button></p>}{!loading && !error && rows.length < total && page < 10000 && <button type="button" className={styles.more} onClick={() => setPage(value => value + 1)}>더 불러오기</button>}</div>;
}
export function InsightItemLibrary({member,filters,onChange}:{member:Member;filters:InsightFilters;onChange:(patch:Partial<InsightFilters>)=>void}) {
  const {kind,sort,direction,query}=filters;
  const [input,setInput]=useState(query);
  useEffect(()=>setInput(query),[query]);
  return <section className={styles.contentLibrary} aria-label="전체 콘텐츠 통계">
    <div className={styles.libraryControls}><div className={styles.sortChoices} aria-label="콘텐츠 정렬">{([['LATEST','최신순'],['VIEWS','조회순'],['POPULAR','인기순']] as const).map(([value,label])=><button type="button" key={value} aria-pressed={sort===value} onClick={()=>onChange({sort:value,direction:'DESC'})}>{label}</button>)}<button type="button" className={styles.direction} aria-label={`정렬 방향: ${direction==='DESC'?'내림차순':'오름차순'}`} title="정렬 방향 바꾸기" onClick={()=>onChange({direction:direction==='DESC'?'ASC':'DESC'})}><svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d={direction==='DESC'?'M10 4v12m-4-4 4 4 4-4':'M10 16V4m-4 4 4-4 4 4'}/></svg></button></div>
      <form className={styles.search} onSubmit={event=>{event.preventDefault();onChange({query:input.trim()});}}><label className="sr-only" htmlFor="insight-content-search">콘텐츠 제목 검색</label><input id="insight-content-search" value={input} maxLength={100} onChange={event=>setInput(event.target.value)} placeholder="제목 검색"/><button type="submit">검색</button></form></div>
    <p className={styles.sortNote}>{sort==='VIEWS'?'누적 조회 수 기준':sort==='POPULAR'?'공감 수 기준':'작성일 기준'} · 조회가 없거나 비공개인 콘텐츠도 표시합니다.</p>
    <Rows key={`${member.id}/${kind}/${query}/${sort}/${direction}`} kind={kind} query={query} sort={sort} direction={direction} member={member} filters={filters}/>
  </section>;
}
