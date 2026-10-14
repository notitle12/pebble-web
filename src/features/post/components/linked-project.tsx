import Link from "next/link";
import {readLinkedProject} from "../api/linked-project";

export async function LinkedProject({id}:{id:string}){
  const result=await readLinkedProject(id);
  if(result.status==="absent")return null;
  if(result.status==="error")return <section className="linked-project" aria-label="연결 프로젝트"><p role="status">연결 프로젝트를 불러오지 못했어요. 잠시 후 페이지를 새로고침해 주세요.</p></section>;
  const project=result.project;
  return <aside className="linked-project" aria-label="연결 프로젝트">
    <span>이 글의 프로젝트 · {project.lifecycleStatus==="COMPLETED"?"완료":"진행 중"}</span>
    <Link href={`/projects/${project.id}`} prefetch={false}>{project.name} →</Link>
    {project.summary&&<p>{project.summary}</p>}
  </aside>;
}
