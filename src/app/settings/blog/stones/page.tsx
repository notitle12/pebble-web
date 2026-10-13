import {SiteHeader} from "@/components/site-header";
import {StoneEditor} from "@/features/blog-home/components/stone-editor";
export const metadata={robots:{index:false,follow:false}};
export default function Page(){return <><SiteHeader/><main className="page-shell stone-settings-shell"><StoneEditor/></main></>;}
