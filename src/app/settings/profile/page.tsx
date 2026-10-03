import {SiteHeader} from "@/components/site-header";
import {ProfileSetup} from "@/features/member/components/profile-setup";
export const metadata={robots:{index:false,follow:false}};
export default function Page(){return <><SiteHeader/><main className="page-shell detail-shell writer-shell"><ProfileSetup/></main></>;}
