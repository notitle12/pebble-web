import {Suspense} from "react";
import Link from "next/link";
import {SiteHeader} from "@/components/site-header";
import {LoadingIndicator} from "@/components/loading-state";
import {pageMetadata} from "@/features/seo/model";
import {parseUpdateQuery,UPDATE_TYPES,UPDATE_LABELS,updatesHref} from "@/features/update/public-updates";
import {UpdateList} from "@/features/update/update-list";
import styles from "@/features/update/updates.module.css";
export const dynamic="force-dynamic";
type Props={searchParams:Promise<Record<string,string|string[]|undefined>>};
export async function generateMetadata({searchParams}:Props){const query=parseUpdateQuery(await searchParams);return pageMetadata({path:query?updatesHref(query):"/updates",title:"업데이트",description:"Pebble의 새로운 기능, 성능 개선과 버그 수정 소식을 확인하세요.",noIndex:!query});}
export default async function Updates({searchParams}:Props){
 const query=parseUpdateQuery(await searchParams);
 return <><a className="skip-link" href="#main-content">본문으로 바로가기</a><SiteHeader updates/><main id="main-content" className={`page-shell ${styles.shell}`}><header className={styles.heading}><p className="page-eyebrow">PEBBLE UPDATES</p><h1>업데이트</h1><p>새로운 기능부터 성능 개선과 버그 수정까지,<br/>Pebble이 달라지는 소식을 전합니다.</p></header>{query?<><nav className={styles.filters} aria-label="업데이트 분류"><Link href="/updates" aria-current={!query.type?"page":undefined}>전체</Link>{UPDATE_TYPES.map(type=><Link key={type} href={updatesHref({page:0,type})} aria-current={query.type===type?"page":undefined}>{UPDATE_LABELS[type]}</Link>)}</nav><Suspense key={updatesHref(query)} fallback={<LoadingIndicator label="업데이트를 불러오는 중"/>}><UpdateList query={query}/></Suspense></>:<section className="list-state"><h2>조회 조건을 확인해 주세요</h2><Link className="button" href="/updates">전체 업데이트</Link></section>}</main></>;
}
