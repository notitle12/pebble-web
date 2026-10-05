import {SiteHeader} from "@/components/site-header";
import {PostWriteScreen} from "@/features/post/components/post-write-screen";
export const metadata={robots:{index:false,follow:false}};
export default function Page(){return <><SiteHeader/><main className="page-shell detail-shell writer-shell"><PostWriteScreen/></main></>;}
