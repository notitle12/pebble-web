import {SiteHeader} from "@/components/site-header";
import {AccountSettings} from "@/features/member/components/account-settings";
export const metadata={robots:{index:false,follow:false}};
export default function Page(){return <><SiteHeader/><main className="page-shell detail-shell writer-shell"><AccountSettings/></main></>;}
