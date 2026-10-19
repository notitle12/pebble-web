import {featuredProjectIdsForHome} from "@/features/blog-home/api/blog-home";
import {loadBlogPageData} from "@/features/blog-tools/api/blog-page";
import {BlogSidebar} from "@/features/blog-tools/components/blog-sidebar";
import {flattenBoards,type Board} from "@/features/board/api/boards";
import {BlogOwnerActions} from "@/features/auth/components/blog-owner-actions";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { GuestApiError } from "@/lib/public-api";
import { parsePage,validId } from "@/lib/list-query";
import { blogHref, getPublicBlogPosts, type PublicBlogProfile } from "@/features/post/api/public-blog";
import {BlogProfileHeader} from "@/features/blog-tools/components/blog-profile-header";
import {type ProjectPage} from "@/features/project/api/project-list";
import { loadPopularPosts } from "@/features/post/api/popular-posts";
import { BlogPosts } from "@/features/post/components/blog-posts";
import { BlogProjects } from "@/features/project/components/blog-projects";
import type { PostPage } from "@/features/post/api/post-list";
import { BlogVisitCount } from "@/features/blog-tools/components/blog-visit-count";
import { PublicBlogLinks } from "@/features/blog-tools/components/public-blog-links";
import { type BlogLinks } from "@/features/blog-tools/api/blog-tools";
import { visibleHomeDataLoads, type PublicBlogHome } from "@/features/blog-home/api/blog-home";
import { BlogHomeView } from "@/features/blog-home/components/blog-home-view";
import { getPublicProject, type ProjectDetail } from "@/features/project/api/project-list";

export const dynamic = "force-dynamic";
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
  const boardView=query.view==="boards"||query.view==="posts";
  const homeView=(query.view===undefined||query.view==="home")&&query.boardId===undefined&&query.q===undefined&&query.page===undefined;
  const selected=typeof query.boardId==="string"?query.boardId:undefined;
  const q=typeof query.q==="string"?query.q.trim():undefined;
  const searched=Boolean(q?.length);
  const invalidSearch=query.q!==undefined&&(q===undefined||Array.from(q).length>200)||searched&&(Boolean(selected)||projectView||query.view==="boards");
  if (page === null || Object.keys(query).some(key => !["page","boardId","view","q"].includes(key)) || query.boardId!==undefined&&(!selected||!validId(selected)) || query.view!==undefined&&!projectView&&!boardView&&query.view!=="home" || (projectView||query.view==="boards")&&query.boardId!==undefined || query.view==="home"&&(query.boardId!==undefined||searched||query.page!==undefined) || invalidSearch) {
    return <><SiteHeader /><main className="page-shell"><InvalidPage search={Boolean(invalidSearch)} /></main></>;
  }

  let result:PostPage|undefined;let sidebarProjects:ProjectPage|undefined;let projectError=false;let projectsResult:ProjectPage|undefined;let projectsError=false;let author:PublicBlogProfile|undefined;let home:PublicBlogHome|null=null;let homeError=false;let homeProjects:ProjectDetail[]=[];let homeProjectErrors=0;let homePosts:PostPage|null=null;let homePostsFailed=false;let boards:Board[]=[];let boardError=false;let links:BlogLinks|null=null;let linksError=false;
  try {
    ({author,links,linksError,boards,boardError,sidebarProjects,projectError,home,homeError,projectsResult,projectsError,result}=await loadBlogPageData({handle,page,homeView,projectView,selected,q}));
    if(homeView&&home){ const {recentPosts:showPosts,featuredProjects:showProjects}=visibleHomeDataLoads(home); const [postResults,projectResults]=await Promise.all([Promise.allSettled(showPosts?[loadPopularPosts(page=>getPublicBlogPosts(handle,page))]:[]),Promise.allSettled(showProjects?featuredProjectIdsForHome(home).map(id=>getPublicProject(id).then(project=>{if(project.owner.id!==author!.id)throw new GuestApiError("response");return project})):[])]); const postResult=postResults[0]; if(postResult?.status==="fulfilled")homePosts=postResult.value; else if(postResult)homePostsFailed=true; homeProjects=projectResults.flatMap(item=>item.status==="fulfilled"?[item.value]:[]); homeProjectErrors=projectResults.filter(item=>item.status==="rejected").length; }
  } catch (error) {
    if (error instanceof GuestApiError && error.kind === "not-found") notFound();
    const message = error instanceof GuestApiError && error.kind === "configuration"
      ? "블로그 목록 API를 설정하지 못했습니다."
      : "블로그 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
    return <><SiteHeader /><main className="page-shell"><section className="list-state" aria-labelledby="blog-error-title">
      <h1 id="blog-error-title">블로그 목록을 불러올 수 없어요</h1><p role="alert">{message}</p>
      <a className="button" href={projectView?`/blogs/${handle}?view=projects`:blogHref(handle, page,selected,q)}>다시 시도</a>
    </section></main></>;
  }


  if(!author) notFound();

  return <>
    <a className="skip-link" href="#main-content">본문으로 바로가기</a>
    <SiteHeader />
    <main id="main-content" className="page-shell personal-blog-layout">
      <BlogSidebar visitors={<BlogVisitCount handle={handle}/>} footer={<BlogOwnerActions handle={handle}/>} links={<PublicBlogLinks links={links} failed={linksError}/>} handle={handle} homeView={homeView} selected={selected} projectView={projectView} boardView={boardView} searched={searched} boards={boards} projects={sidebarProjects?.content.slice(0,5)??[]} boardError={boardError} projectError={projectError}/>
      <section className="personal-blog-content" aria-label={homeView?"블로그 홈":projectView?"블로그 프로젝트":"게시판"}>
        <BlogProfileHeader profile={author} query={q}/>
        {homeView ? home ? <BlogHomeView authorId={author.id} handle={handle} settings={home} activity={home.activity} projects={homeProjects} projectErrors={homeProjectErrors} hasFeaturedProjects={home.featuredProjectIds.length>0} posts={homePosts} postsFailed={homePostsFailed}/> : <div className="blog-home-failure"><h2>블로그 홈을 불러올 수 없어요</h2><p role="alert">{homeError?"활동과 홈 구성을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.":"블로그 홈 데이터를 불러오지 못했습니다."}</p><a href={`/blogs/${encodeURIComponent(handle)}`}>다시 시도</a></div> : <><div className="personal-blog-heading"><h2>{projectView?"프로젝트":selected?flattenBoards(boards).find(board=>board.id===selected)?.name:searched?`검색 결과: ${q}`:"게시판"}</h2></div>
        <div className="blog-content-body">
        {projectView ? <BlogProjects handle={handle} initial={projectsResult??null} page={page} failed={projectsError}/> : result&&<BlogPosts handle={handle} authorId={author.id} initial={result} page={page} boardId={selected} q={q||undefined}/>}
        </div></>}
      </section>
    </main>
  </>;
}
