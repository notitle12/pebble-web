import {Suspense} from "react";
import { SiteHeader } from "@/components/site-header";
import { InsightContentList } from "@/features/content-insights/components/insight-content-list";
export const metadata = { title: "전체 콘텐츠 인사이트", robots: { index: false, follow: false } };
export default function Page() { return <><SiteHeader/><main className="page-shell detail-shell writer-shell"><Suspense fallback={<p role="status">인사이트를 불러오고 있어요.</p>}><InsightContentList/></Suspense></main></>; }
