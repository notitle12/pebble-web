import {SiteHeader} from "@/components/site-header";
import {MyProjects} from "@/features/project/components/my-projects";
export const metadata={title:"내 프로젝트",robots:{index:false,follow:false}};
export default function Page(){return <><SiteHeader/><main className="page-shell detail-shell"><MyProjects/></main></>;}
