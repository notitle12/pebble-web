import {SiteHeader} from "@/components/site-header";
import {BoardManagement} from "@/features/board/components/board-management";
export const metadata={title:"글 폴더 관리",robots:{index:false,follow:false}};
export default function Page(){return <><SiteHeader/><main className="page-shell"><h1>글 폴더 관리</h1><BoardManagement/></main></>;}
