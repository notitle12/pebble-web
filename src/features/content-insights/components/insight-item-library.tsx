"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { userSession, type Member } from "../../auth/user-session";
import { getInsightItems, insightDetailHref, insightHref, type ContentKind, type InsightItem } from "../model";
import styles from "./content-insights.module.css";
function Rows({ kind, query, member }: { kind: ContentKind; query: string; member: Member }) {
  const [page, setPage] = useState(0), [attempt, setAttempt] = useState(0);
  const [rows, setRows] = useState<InsightItem[]>([]), [total, setTotal] = useState(0), [loading, setLoading] = useState(true), [error, setError] = useState("");
  useEffect(() => { let live = true; setLoading(true); setError("");
    getInsightItems(kind, page, query, path => userSession.request(path)).then(result => { if (!live) return; setRows(current => page === 0 ? result.items : [...current, ...result.items.filter(item => !current.some(old => old.id === item.id))]); setTotal(result.totalElements); }).catch(() => { if (live) setError("콘텐츠 목록을 불러오지 못했어요. 다시 시도해 주세요."); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [kind, query, page, attempt, member.id]);
  return <div className={styles.libraryResults} aria-busy={loading}>{rows.length > 0 && <ul className={styles.libraryList}>{rows.map(item => <li key={item.id}><div className={styles.item}><Link href={insightHref(kind, item, member.handle)}>{item.title || "제목 없음"}</Link><small>{[item.draft && "임시 저장", item.visibilityStatus === "HIDDEN" && "비공개", item.isBlocked && "이용 제한", `누적 ${item.views.toLocaleString("ko-KR")}회`].filter(Boolean).join(" · ")}</small></div><Link className={styles.detailLink} href={insightDetailHref(kind, item.id)}>상세 통계</Link></li>)}</ul>}{loading && <p className={styles.empty} role="status">콘텐츠를 불러오고 있어요.</p>}{!loading && !error && rows.length === 0 && <p className={styles.empty}>검색 조건에 맞는 콘텐츠가 없어요.</p>}{error && <p role="alert" className={styles.empty}>{error} <button type="button" className={styles.textButton} onClick={() => setAttempt(value => value + 1)}>다시 불러오기</button></p>}{!loading && !error && rows.length < total && page < 10000 && <button type="button" className={styles.more} onClick={() => setPage(value => value + 1)}>더 불러오기</button>}</div>;
}
export function InsightItemLibrary({ member }: { member: Member }) {
  const [open, setOpen] = useState(false), [kind, setKind] = useState<ContentKind>("posts"), [input, setInput] = useState(""), [query, setQuery] = useState("");
  return <section className={styles.library}><button className={styles.libraryToggle} type="button" aria-expanded={open} aria-controls="insight-library" onClick={() => setOpen(value => !value)}><span>콘텐츠별 통계</span><span aria-hidden="true">{open ? "−" : "+"}</span></button>{open && <div id="insight-library"><p className={styles.libraryIntro}>조회 수가 없는 콘텐츠도 찾아볼 수 있어요.</p><div className={styles.libraryControls}><div className={styles.kindTabs} aria-label="콘텐츠 종류">{(["posts", "projects"] as const).map(value => <button type="button" key={value} aria-pressed={kind === value} onClick={() => setKind(value)}>{value === "posts" ? "게시글" : "프로젝트"}</button>)}</div><form className={styles.search} onSubmit={event => { event.preventDefault(); setQuery(input.trim()); }}><label className="sr-only" htmlFor="insight-content-search">콘텐츠 제목 검색</label><input id="insight-content-search" value={input} maxLength={100} onChange={event => setInput(event.target.value)} placeholder="제목 검색"/><button type="submit">검색</button></form></div><Rows key={`${member.id}/${kind}/${query}`} kind={kind} query={query} member={member}/></div>}</section>;
}
