import Link from "next/link";
import {getPublicTags} from "../api/public-tags";
import {pageHref} from "../../post/api/post-list";
export async function TagExplore(){
  let tags;
  try{tags=await getPublicTags();}catch{return <section className="list-state" role="alert"><h2>태그를 불러오지 못했어요</h2><a className="button" href="/tags">다시 시도</a></section>;}
  if(!tags.length)return <section className="list-state"><h2>아직 공개된 태그가 없어요</h2><p>태그가 준비되면 이곳에서 글을 찾아볼 수 있어요.</p></section>;
  return <ul className="explore-tags" aria-label="공개 기술 태그">{tags.map(tag=><li key={tag.id}><Link href={pageHref(0,{tagId:tag.id})} prefetch={false}>{tag.name}{tag.status==="INACTIVE" && <span className="classification-note">기존 태그</span>}</Link></li>)}</ul>;
}
