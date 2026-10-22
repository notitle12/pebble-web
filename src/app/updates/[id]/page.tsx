import {cache} from "react";
import Link from "next/link";
import {notFound} from "next/navigation";
import {SiteHeader} from "@/components/site-header";
import {GuestApiError} from "@/lib/public-api";
import {pageMetadata} from "@/features/seo/model";
import {getPublicUpdate,UPDATE_LABELS,updateDate} from "@/features/update/public-updates";
import styles from "@/features/update/updates.module.css";
export const dynamic="force-dynamic";
const readUpdate=cache(getPublicUpdate);
type Props={params:Promise<{id:string}>};
export async function generateMetadata({params}:Props){try{const item=await readUpdate((await params).id);return pageMetadata({path:`/updates/${item.id}`,title:item.title,description:item.summary||"Pebble의 업데이트 소식입니다."});}catch{return {title:"업데이트",robots:{index:false,follow:false}};}}
export default async function UpdateDetail({params}:Props){
 const {id}=await params;let item;
 try{item=await readUpdate(id);}catch(error){if(error instanceof GuestApiError&&error.kind==="not-found")notFound();return <><SiteHeader/><main className={`page-shell ${styles.shell}`}><section className="list-state" role="alert"><h1>업데이트를 불러오지 못했어요</h1><p>잠시 후 다시 시도해 주세요.</p><a className="button" href={`/updates/${encodeURIComponent(id)}`}>다시 시도</a><Link className="button" href="/updates">업데이트 목록</Link></section></main></>;}
 return <><a className="skip-link" href="#main-content">본문으로 바로가기</a><SiteHeader/><main className={`page-shell ${styles.shell}`} id="main-content"><Link className={styles.back} href="/updates">← 업데이트 목록</Link><article className={styles.article}><header><div className={styles.meta}><span className={styles.badge}>{UPDATE_LABELS[item.type]}</span>{item.version&&<span>{item.version}</span>}<time dateTime={item.publishedAt}>{updateDate(item.publishedAt)}</time></div><h1>{item.title}</h1>{item.summary&&<p className={styles.summary}>{item.summary}</p>}</header><div className={styles.body}>{item.body}</div></article></main></>;
}
