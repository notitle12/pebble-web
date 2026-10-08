import { SiteHeader } from "@/components/site-header";
import { BlogManagement } from "@/features/member/components/blog-management";

export const metadata = { robots: { index: false, follow: false } };
export default function Page() {
  return <><SiteHeader/><main className="page-shell detail-shell writer-shell"><BlogManagement/></main></>;
}
