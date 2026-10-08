"use client";
import { useEffect, useState } from "react";
import { recordBlogVisit, type BlogVisits } from "../api/blog-tools";

const pendingVisits = new Map<string, Promise<BlogVisits>>();
function recordOnce(handle: string): Promise<BlogVisits> {
  const current = pendingVisits.get(handle);
  if (current) return current;
  const request = recordBlogVisit(handle).finally(() => pendingVisits.delete(handle));
  pendingVisits.set(handle, request);
  return request;
}

export function BlogVisitCount({ handle }: { handle: string }) {
  const [state, setState] = useState<{ handle: string; visits: BlogVisits | null; failed: boolean }>({ handle, visits: null, failed: false });
  const current = state.handle === handle ? state : { handle, visits: null, failed: false };
  useEffect(() => {
    let active = true;
    setState({ handle, visits: null, failed: false });
    void recordOnce(handle).then(visits => { if (active) setState({ handle, visits, failed: false }); }).catch(() => { if (active) setState({ handle, visits: null, failed: true }); });
    return () => { active = false; };
  }, [handle]);
  return <section className="blog-visit-count" aria-label="방문자 통계">
    <h2>방문자</h2>
    {current.visits ? <dl><div><dt>전체</dt><dd>{current.visits.totalVisitors.toLocaleString("ko-KR")}</dd></div><div><dt>오늘</dt><dd>{current.visits.todayVisitors.toLocaleString("ko-KR")}</dd></div></dl>
      : current.failed ? <p role="status">방문 통계를 불러오지 못했어요.</p> : <p role="status">방문 통계를 불러오는 중…</p>}
  </section>;
}
