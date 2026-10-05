import {SiteHeader} from "@/components/site-header";
import {NaverCallback} from "@/features/auth/components/login-panel";
export const metadata={referrer:"no-referrer",robots:{index:false,follow:false}};
export default function Page(){return <><SiteHeader/><main className="page-shell detail-shell writer-shell"><NaverCallback/></main></>;}
