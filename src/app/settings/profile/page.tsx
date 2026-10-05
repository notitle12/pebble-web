import {SiteHeader} from "@/components/site-header";
import {ProfileSetup} from "@/features/member/components/profile-setup";
import {Suspense} from "react";
export const metadata={robots:{index:false,follow:false}};
export default function Page(){return <><SiteHeader/><main className="page-shell detail-shell writer-shell"><Suspense fallback={<div className="list-state" role="status">프로필 화면을 불러오고 있어요.</div>}><ProfileSetup/></Suspense></main></>;}
