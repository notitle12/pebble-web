import {SiteHeader} from "@/components/site-header";
import {ProjectWriteScreen} from "@/features/project/components/project-write-screen";
export const metadata={title:"새 프로젝트 작성",robots:{index:false,follow:false}};
export default function Page(){return <><SiteHeader/><main className="page-shell detail-shell"><ProjectWriteScreen/></main></>;}
