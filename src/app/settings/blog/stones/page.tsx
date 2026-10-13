import {SiteHeader} from "@/components/site-header";
import {StoneGardenSettings} from "@/features/blog-home/components/stone-garden-settings";
export const metadata={robots:{index:false,follow:false}};
export default function Page(){return <><SiteHeader/><main className="page-shell stone-settings-shell"><StoneGardenSettings/></main></>;}
