import Link from "next/link";
import {getPublicCategories} from "../api/public-categories";
import {pageHref} from "../../post/api/post-list";
export async function CategoryExplore(){
  let categories;
  try{categories=await getPublicCategories();}catch{return <section className="list-state" role="alert"><h2>분류를 불러오지 못했어요</h2><a className="button" href="/categories">다시 시도</a></section>;}
  if(!categories.length)return <section className="list-state"><h2>아직 공개된 분류가 없어요</h2><p>분류가 준비되면 주제별 글을 찾아볼 수 있어요.</p></section>;
  return <ul className="category-groups" aria-label="공개 분류">{categories.map(category=><li key={category.id}><h2><Link href={pageHref(0,{categoryId:category.id})} prefetch={false}>{category.name}</Link></h2>{category.status==="INACTIVE" && <p className="classification-note">기존 분류 · 공개 글 탐색</p>}
    {category.children.length>0 && <ul>{category.children.map(child=><li key={child.id}><Link href={pageHref(0,{categoryId:child.id})} prefetch={false}>{child.name}{child.status==="INACTIVE" && <span className="classification-note">기존 분류</span>}</Link></li>)}</ul>}
  </li>)}</ul>;
}
