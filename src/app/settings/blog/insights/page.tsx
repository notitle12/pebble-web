import {Suspense} from "react";
import { SiteHeader } from "@/components/site-header";
import { ContentInsights } from "@/features/content-insights/components/content-insights";
export const metadata = { title: "인사이트", robots: { index: false, follow: false } };
export default function Page() { return <><SiteHeader/><main className="page-shell detail-shell writer-shell"><Suspense fallback={<p role="status">인사이트를 불러오고 있어요.</p>}><ContentInsights/></Suspense></main></>; }
