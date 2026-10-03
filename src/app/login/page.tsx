import {SiteHeader} from "@/components/site-header";
import {LoginPanel} from "@/features/auth/components/login-panel";
export const metadata={robots:{index:false,follow:false}};
export default function Page(){return <><SiteHeader/><main className="page-shell detail-shell writer-shell"><LoginPanel/></main></>;}
