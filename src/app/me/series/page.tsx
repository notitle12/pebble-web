import {SiteHeader} from "@/components/site-header";
import {MySeries} from "@/features/post/components/my-series";
export const metadata={robots:{index:false,follow:false}};
export default function Page(){return <><SiteHeader/><main className="page-shell detail-shell"><MySeries/></main></>;}
