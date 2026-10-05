import {Suspense} from "react";
import {redirect} from "next/navigation";
import {SiteHeader} from "@/components/site-header";
import {KeywordSearch} from "@/features/search/components/keyword-search";
import {parsePostQuery} from "@/features/post/api/post-list";
import {PostList,PostListLoading,InvalidPage} from "@/features/post/components/post-list";
import {searchHref} from "@/features/search/query";
export const dynamic="force-dynamic";
export const metadata={title:"게시글"};
export default async function PostsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const query=parsePostQuery(await searchParams);
  if(query?.q&&!query.tagId&&!query.categoryId)redirect(searchHref({...query,type:"posts"}));
  return <><a className="skip-link" href="#main-content">본문으로 바로가기</a><SiteHeader posts/><main className="page-shell home-shell discovery-shell" id="main-content"><KeywordSearch type="posts"/><section className="intro"><p className="page-eyebrow">PEBBLE JOURNAL</p><h1>개발자의 기록을 읽어보세요.</h1></section>{!query?<InvalidPage/>:<Suspense key={JSON.stringify(query)} fallback={<PostListLoading/>}><PostList query={query} listPath="/posts"/></Suspense>}</main></>;
}
