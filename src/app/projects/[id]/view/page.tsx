import {SiteHeader} from "@/components/site-header";
import {OwnProjectView} from "@/features/project/components/own-project-view";
export const metadata={title:"내 프로젝트 보기",robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <><SiteHeader/><main className="page-shell detail-shell"><OwnProjectView id={id}/></main></>;}
