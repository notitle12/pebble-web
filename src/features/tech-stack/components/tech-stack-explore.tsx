import Link from "next/link";
import {getPublicTechStacks} from "../api/public-tech-stacks";
import {projectPageHref} from "../../project/api/project-list";
export async function TechStackExplore(){
  let techStacks;
  try{techStacks=await getPublicTechStacks();}catch{return <section className="list-state" role="alert"><h2>기술 스택을 불러오지 못했어요</h2><a className="button" href="/tech-stacks">다시 시도</a></section>;}
  if(!techStacks.length)return <section className="list-state"><h2>아직 공개된 기술 스택이 없어요</h2><p>기술 스택이 준비되면 이곳에서 프로젝트를 찾아볼 수 있어요.</p></section>;
  return <ul className="explore-tags" aria-label="공개 기술 스택">{techStacks.map(techStack=><li key={techStack.id}><Link href={projectPageHref(0,{techStackId:techStack.id})} prefetch={false}>{techStack.name}{techStack.status==="INACTIVE" && <span className="classification-note">기존 기술 스택</span>}</Link></li>)}</ul>;
}
