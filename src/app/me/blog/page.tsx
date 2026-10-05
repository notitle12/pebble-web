import {SiteHeader} from "@/components/site-header";
import {MyBlog} from "@/features/auth/components/my-blog";
export const metadata={robots:{index:false,follow:false}};
export default function Page(){return <><SiteHeader/><main className="page-shell detail-shell"><MyBlog/></main></>;}
