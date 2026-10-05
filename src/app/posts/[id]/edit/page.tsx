import {SiteHeader} from "@/components/site-header";
import {PostWriteScreen} from "@/features/post/components/post-write-screen";
export const metadata={robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{id:string}>}){const{id}=await params;return <><SiteHeader/><main className="page-shell detail-shell writer-shell"><PostWriteScreen id={id}/></main></>;}
