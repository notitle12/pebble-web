import {SiteHeader} from "@/components/site-header";
import {ProjectWriteScreen} from "@/features/project/components/project-write-screen";
export const metadata={title:"프로젝트 수정",robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{id:string}>}) {return <><SiteHeader/><main className="page-shell detail-shell"><ProjectWriteScreen id={(await params).id}/></main></>;}
