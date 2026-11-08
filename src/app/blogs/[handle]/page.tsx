import {pageMetadata} from "@/features/seo/model";
import {getPublicBlogProfile} from "@/features/post/api/public-blog";
import {loadBlogPageData} from "@/features/blog-tools/api/blog-page";
import {BlogSidebarLoading,PublicBlogSidebar,PublicBlogHomeContent} from "@/features/blog-tools/components/public-blog-content";
import {flattenBoards} from "@/features/board/api/boards";
import {Suspense} from "react";
import {LoadingIndicator} from "@/components/loading-state";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { GuestApiError } from "@/lib/public-api";
import { parsePage,validId } from "@/lib/list-query";
import { blogHref } from "@/features/post/api/public-blog";
import {BlogProfileHeader} from "@/features/blog-tools/components/blog-profile-header";
import { BlogPosts } from "@/features/post/components/blog-posts";
import { BlogProjects } from "@/features/project/components/blog-projects";
import Link from "next/link";
import {getPublicPostSeriesDetail,getPublicPostSeriesPosts,publicPostSeriesHref,type PostSeries} from "@/features/post/api/post-series";
import type {PostPage} from "@/features/post/api/post-list";
import {PostCards} from "@/features/post/components/post-cards";
import styles from "@/features/post/components/public-series.module.css";

export const dynamic = "force-dynamic";
export async function generateMetadata({params,searchParams}:{params:Promise<{handle:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){try{const {handle}=await params;const author=await getPublicBlogProfile(handle,process.env.NEXT_PUBLIC_API_BASE_URL,fetch);const q=await searchParams;return pageMetadata({path:`/blogs/${handle}`,title:author.blogName,description:`${author.nickname}의 개발 기록과 프로젝트를 ${author.blogName}에서 만나보세요.`,noIndex:Object.keys(q).length>0});}catch{return {title:"블로그",robots:{index:false,follow:false}};}}
const validHandle = (handle: string) => /^[a-z][a-z0-9_-]{1,28}[a-z0-9_]$/.test(handle);

function InvalidPage({ search = false }: { search?: boolean }) {
  return <section className="list-state"><h1>{search?"블로그 검색 주소를 확인해 주세요":"페이지 주소를 확인해 주세요"}</h1><p>{search?"검색과 게시판 필터는 함께 사용할 수 없으며 검색어는 200자까지 입력할 수 있어요.":"페이지 번호는 0 이상의 숫자여야 합니다."}</p></section>;
}

export default async function PublicBlogPage({ params, searchParams }: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { handle } = await params;
  if (!validHandle(handle)) notFound();
  const query = await searchParams;
  const page = parsePage(query.page);
  const projectView=query.view==="projects";
  const seriesView=query.view==="series";
  const seriesId=typeof query.seriesId==="string"?query.seriesId:undefined;
  const boardView=query.view==="boards"||query.view==="posts";
  const homeView=(query.view===undefined||query.view==="home")&&query.boardId===undefined&&query.q===undefined&&query.page===undefined&&query.seriesId===undefined;
  const selected=typeof query.boardId==="string"?query.boardId:undefined;
  const q=typeof query.q==="string"?query.q.trim():undefined;
  const searched=Boolean(q?.length);
  const invalidSearch=query.q!==undefined&&(q===undefined||Array.from(q).length>200)||searched&&(Boolean(selected)||projectView||seriesView||query.view==="boards");
  const seriesQueryInvalid=seriesView&&(query.boardId!==undefined||query.q!==undefined||!seriesId&&query.page!==undefined||query.seriesId!==undefined&&(!seriesId||!validId(seriesId)))||query.seriesId!==undefined&&!seriesView;
  if (page === null || Object.keys(query).some(key => !["page","boardId","view","q","seriesId"].includes(key)) || query.boardId!==undefined&&(!selected||!validId(selected)) || query.view!==undefined&&!projectView&&!boardView&&!seriesView&&query.view!=="home" || (projectView||query.view==="boards")&&query.boardId!==undefined || query.view==="home"&&(query.boardId!==undefined||searched||query.page!==undefined||query.seriesId!==undefined) || seriesQueryInvalid || invalidSearch) {
    return <><SiteHeader /><main className="page-shell"><InvalidPage search={Boolean(invalidSearch)} /></main></>;
  }

  let data;
  let publicSeries:PostSeries[]|null=null,activeSeries:PostSeries|null=null,seriesPosts:PostPage|null=null;
  try {
    const pageRequest=loadBlogPageData({handle,page,homeView,projectView,seriesView,selected,q});
    const seriesRequest=seriesView&&seriesId?Promise.all([getPublicPostSeriesDetail(handle,seriesId),getPublicPostSeriesPosts(handle,seriesId,page)]).then(([item,posts])=>({item,posts})):Promise.resolve(null);
    const [loaded,seriesData]=await Promise.all([pageRequest,seriesRequest]);data=loaded;
    if(seriesView&&!seriesId){const list=await loaded.series;if(list.status==='rejected')throw list.reason;publicSeries=list.value;}
    if(seriesData){activeSeries=seriesData.item;seriesPosts=seriesData.posts;}
  } catch (error) {
    if (error instanceof GuestApiError && error.kind === "not-found") notFound();
    const message = error instanceof GuestApiError && error.kind === "configuration"
      ? "블로그 API 연결 설정을 확인할 수 없습니다."
      : seriesView?"블로그 시리즈를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.":"블로그 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
    return <><SiteHeader /><main className="page-shell"><section className="list-state" aria-labelledby="blog-error-title">
      <h1 id="blog-error-title">블로그 목록을 불러올 수 없어요</h1><p role="alert">{message}</p>
      <a className="button" href={seriesView?publicPostSeriesHref(handle,seriesId,page):projectView?`/blogs/${handle}?view=projects`:blogHref(handle, page,selected,q)}>다시 시도</a>
    </section></main></>;
  }


  const {author,sidebar,home,boards,result,projectsResult,projectsError}=data;

  return <>
    <a className="skip-link" href="#main-content">본문으로 바로가기</a>
    <SiteHeader />
    <main id="main-content" className="page-shell personal-blog-layout">
      <Suspense fallback={<BlogSidebarLoading/>}><PublicBlogSidebar data={sidebar} handle={handle} homeView={homeView} selected={selected} projectView={projectView} boardView={boardView} seriesView={seriesView} seriesId={seriesId} searched={searched}/></Suspense>
      <section className="personal-blog-content" aria-label={homeView?"블로그 홈":projectView?"블로그 프로젝트":seriesView?"블로그 시리즈":"게시판"}>
        <BlogProfileHeader profile={author} query={q}/>
        {homeView ? <Suspense fallback={<LoadingIndicator label="블로그 홈을 불러오는 중"/>}><PublicBlogHomeContent data={home} handle={handle} authorId={author.id}/></Suspense> : seriesView?<><div className="personal-blog-heading"><h2>{activeSeries?.name??"시리즈"}</h2></div><div className="blog-content-body">{activeSeries&&seriesPosts?<>
          {activeSeries.description&&<p className={styles.description}>{activeSeries.description}</p>}
          {!seriesPosts.content.length?<section className="list-state"><h3>{page===0?"공개된 글이 없습니다.":"이 페이지에는 글이 없습니다."}</h3>{page>0&&<Link className="button" href={publicPostSeriesHref(handle,activeSeries.id,0)}>첫 페이지로</Link>}</section>:<PostCards posts={seriesPosts.content} showAuthor={false}/>}
          {seriesPosts.totalPages>0&&<nav className="pagination" aria-label="시리즈 글 페이지">{seriesPosts.hasPrevious?<Link className="page-link" href={publicPostSeriesHref(handle,activeSeries.id,page-1)} prefetch={false}>← 이전</Link>:<span className="page-link disabled" aria-disabled="true">← 이전</span>}<span aria-current="page">{page+1} / {seriesPosts.totalPages} 페이지</span>{seriesPosts.hasNext?<Link className="page-link" href={publicPostSeriesHref(handle,activeSeries.id,page+1)} prefetch={false}>다음 →</Link>:<span className="page-link disabled" aria-disabled="true">다음 →</span>}</nav>}
        </>:publicSeries?.length?<ul className={styles.list}>{publicSeries.map(item=><li key={item.id}><Link href={publicPostSeriesHref(handle,item.id)}><span><strong>{item.name}</strong>{item.description&&<small>{item.description}</small>}</span><span className={styles.count}>{item.postCount}개 글</span></Link></li>)}</ul>:<section className="list-state"><h3>{publicSeries?"공개된 시리즈가 없습니다.":"시리즈를 불러오지 못했습니다."}</h3></section>}</div></> : <><div className="personal-blog-heading"><h2>{projectView?"프로젝트":selected?flattenBoards(boards).find(board=>board.id===selected)?.name:searched?`검색 결과: ${q}`:"게시판"}</h2></div>
        <div className="blog-content-body">
        {projectView ? <BlogProjects handle={handle} initial={projectsResult??null} page={page} failed={projectsError}/> : result&&<BlogPosts handle={handle} authorId={author.id} initial={result} page={page} boardId={selected} q={q||undefined}/>}
        </div></>}
      </section>
    </main>
  </>;
}
