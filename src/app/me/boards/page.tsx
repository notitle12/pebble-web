import {SiteHeader} from "@/components/site-header";
import {BoardManagement} from "@/features/board/components/board-management";
export const metadata={title:"게시판 관리",robots:{index:false,follow:false}};
export default function Page(){return <><SiteHeader/><main className="page-shell board-manager-shell"><BoardManagement/></main></>;}
