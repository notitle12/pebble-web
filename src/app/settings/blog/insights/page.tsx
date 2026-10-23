import { SiteHeader } from "@/components/site-header";
import { ContentInsights } from "@/features/content-insights/components/content-insights";
export const metadata = { title: "인사이트", robots: { index: false, follow: false } };
export default function Page() { return <><SiteHeader/><main className="page-shell detail-shell writer-shell"><ContentInsights/></main></>; }
