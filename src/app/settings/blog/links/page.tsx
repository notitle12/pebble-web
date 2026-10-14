import { SiteHeader } from "@/components/site-header";
import { BlogLinksSettings } from "@/features/blog-tools/components/blog-links-settings";
export const metadata = { robots: { index: false, follow: false } };
export default function Page() { return <><SiteHeader/><main className="page-shell detail-shell writer-shell"><BlogLinksSettings/></main></>; }
