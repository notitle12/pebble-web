import {SiteHeader} from "@/components/site-header";
import {MyPosts} from "@/features/post/components/my-posts";
export const metadata={robots:{index:false,follow:false}};
export default function Page(){return <><SiteHeader/><main className="page-shell detail-shell writer-shell"><MyPosts/></main></>;}
