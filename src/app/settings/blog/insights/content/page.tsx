import { SiteHeader } from "@/components/site-header";
import { InsightContentList } from "@/features/content-insights/components/insight-content-list";
export const metadata = { title: "전체 콘텐츠 인사이트", robots: { index: false, follow: false } };
export default function Page() { return <><SiteHeader/><main className="page-shell detail-shell writer-shell"><InsightContentList/></main></>; }
