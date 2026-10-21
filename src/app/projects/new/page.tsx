import {ProjectWriteScreen} from "@/features/project/components/project-write-screen";
export const metadata={title:"새 프로젝트 작성",robots:{index:false,follow:false}};
export default function Page(){return <><main className="page-shell writer-shell project-writer-shell"><ProjectWriteScreen/></main></>;}
