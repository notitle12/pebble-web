import {pageMetadata} from "@/features/seo/model";
import {Suspense} from "react";
import {redirect} from "next/navigation";
import {SiteHeader} from "@/components/site-header";
import {KeywordSearch} from "@/features/search/components/keyword-search";
import {parsePostQuery} from "@/features/post/api/post-list";
import {PostList,PostListLoading,InvalidPage} from "@/features/post/components/post-list";
import {PopularPosts} from "@/features/post/components/popular-posts";
import {searchHref} from "@/features/search/query";
export const dynamic="force-dynamic";
export async function generateMetadata({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){const raw=await searchParams,q=parsePostQuery(raw);return pageMetadata({path:q&&q.page>0?`/posts?page=${q.page}`:"/posts",title:"게시글",description:"개발자의 경험과 기술 기록을 읽고 나누세요.",noIndex:!q||!!q.q||!!q.categoryId});}
export default async function PostsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const query=parsePostQuery(await searchParams);
  if(query?.q&&!query.categoryId)redirect(searchHref({...query,type:"posts"}));
  return <><a className="skip-link" href="#main-content">본문으로 바로가기</a><SiteHeader posts/><main className="page-shell home-shell discovery-shell" id="main-content"><section className="intro posts-intro"><div><p className="page-eyebrow">PEBBLE JOURNAL</p><h1>개발자의 기록을 읽어보세요.</h1></div><KeywordSearch type="posts"/></section>{!query?<InvalidPage/>:<>{query.page===0&&!query.q&&!query.categoryId&&<Suspense fallback={<PostListLoading/>}><PopularPosts retryHref="/posts"/></Suspense>}<Suspense key={JSON.stringify(query)} fallback={<PostListLoading/>}><PostList query={query} listPath="/posts"/></Suspense></>}</main></>;
}
