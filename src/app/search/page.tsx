import Link from "next/link";
import { Suspense } from "react";
import { SiteHeader } from "@/components/site-header";
import { KeywordSearch } from "@/features/search/components/keyword-search";
import { SearchResults } from "@/features/search/components/search-results";
import { parseSearchQuery,searchHref } from "@/features/search/query";
export const dynamic="force-dynamic";
export const metadata={title:"검색"};
export default async function SearchPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const query=parseSearchQuery(await searchParams);
  return <><a className="skip-link" href="#main-content">본문으로 바로가기</a><SiteHeader/><main id="main-content" className="page-shell home-shell discovery-shell search-shell"><KeywordSearch value={query?.q} type={query?.type}/>{!query?<section className="list-state"><h1>검색 조건을 확인해 주세요</h1><p>검색어는 200자 이내로 입력해 주세요.</p><Link className="button" href="/search">다시 검색</Link></section>:<><h1 className="search-title">{query.q?<><span>‘{query.q}’</span> 검색 결과</>:"기록 검색"}</h1><nav className="search-tabs" aria-label="검색 결과 종류">{([['all','전체'],['posts','게시글'],['projects','프로젝트']] as const).map(([type,label])=><Link key={type} href={searchHref({...query,type},0)} aria-current={query.type===type?"page":undefined} prefetch={false}>{label}</Link>)}</nav><Suspense key={JSON.stringify(query)} fallback={<p className="list-state" role="status">검색 결과를 불러오고 있어요.</p>}><SearchResults query={query}/></Suspense></>}</main><footer className="site-footer">Pebble · 작은 기록이 쌓이는 곳</footer></>;
}
