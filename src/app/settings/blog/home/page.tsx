import { SiteHeader } from "@/components/site-header";
import { BlogHomeSettings } from "@/features/blog-home/components/blog-home-settings";
export const metadata = { robots: { index: false, follow: false } };
export default function Page() { return <><SiteHeader/><main className="page-shell detail-shell writer-shell"><BlogHomeSettings/></main></>; }
