export function KeywordSearch({ value = "", type = "all" }: { value?: string; type?: "all" | "posts" | "projects" }) {
  return <form action="/search" method="get" className="keyword-search" role="search">
    <button type="submit" aria-label="검색"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg></button>
    <label className="visually-hidden" htmlFor="discovery-keyword">검색어</label>
    <input id="discovery-keyword" name="q" type="search" defaultValue={value} maxLength={200} placeholder="어떤 기록을 찾고 있나요?" autoComplete="off"/>
    {type !== "all" && <input type="hidden" name="type" value={type}/>}
  </form>;
}
