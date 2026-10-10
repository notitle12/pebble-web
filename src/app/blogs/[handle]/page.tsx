import {BlogSidebar} from "@/features/blog-tools/components/blog-sidebar";
import {getPublicBoards,getBoardPosts,flattenBoards,type Board} from "@/features/board/api/boards";
import {BlogOwnerActions} from "@/features/auth/components/blog-owner-actions";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { GuestApiError } from "@/lib/public-api";
import { parsePage,validTagId } from "@/lib/list-query";
import { blogHref, getPublicBlogPosts, getPublicBlogProfile, type PublicBlogProfile } from "@/features/post/api/public-blog";
import {safeMediaUrl} from "@/features/media/model";
import {getPublicMemberProjects,type ProjectPage} from "@/features/project/api/project-list";
import { PostCards } from "@/features/post/components/post-cards";
import type { PostPage } from "@/features/post/api/post-list";
import { BlogVisitCount } from "@/features/blog-tools/components/blog-visit-count";
import { PublicBlogLinks } from "@/features/blog-tools/components/public-blog-links";
import { getPublicBlogLinks, type BlogLinks } from "@/features/blog-tools/api/blog-tools";
import { getPublicBlogHome, visibleHomeDataLoads, type PublicBlogHome } from "@/features/blog-home/api/blog-home";
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
  const homeView=(query.view===undefined||query.view==="home")&&query.boardId===undefined&&query.q===undefined&&query.page===undefined;
  const selected=typeof query.boardId==="string"?query.boardId:undefined;
  const q=typeof query.q==="string"?query.q.trim():undefined;
  const searched=Boolean(q?.length);
  const invalidSearch=query.q!==undefined&&(q===undefined||Array.from(q).length>200)||searched&&(Boolean(selected)||projectView);
  if (page === null || Object.keys(query).some(key => !["page","boardId","view","q"].includes(key)) || query.boardId!==undefined&&(!selected||!validTagId(selected)) || query.view!==undefined&&!projectView&&query.view!=="posts"&&query.view!=="home" || projectView&&query.boardId!==undefined || query.view==="home"&&(query.boardId!==undefined||searched||query.page!==undefined) || invalidSearch) {
    return <><SiteHeader /><main className="page-shell"><InvalidPage search={Boolean(invalidSearch)} /></main></>;
  }

  let result:PostPage|undefined;let projects:ProjectPage|undefined;let sidebarProjects:ProjectPage|undefined;let projectError=false;let author:PublicBlogProfile|undefined;let home:PublicBlogHome|null=null;let homeError=false;let homeProjects:ProjectDetail[]=[];let homeProjectErrors=0;let homePosts:PostPage|null=null;let homePostsFailed=false;let boards:Board[]=[];let boardError=false;let links:BlogLinks|null=null;let linksError=false;
  try {
    author = await getPublicBlogProfile(handle);
    try { links=await getPublicBlogLinks(handle); } catch { linksError=true; }
    if(homeView){try { home=await getPublicBlogHome(handle); } catch { homeError=true; }}
    try { boards = await getPublicBoards(author.id); }
    catch (error) { if (selected) throw error; boardError = true; }
    if (selected && !flattenBoards(boards).some(board => board.id === selected)) throw new GuestApiError("not-found");
    try {
      projects=await getPublicMemberProjects(author.id,projectView?page:0);
      sidebarProjects=projects;
      if(projectView&&page>0){
        try {sidebarProjects=await getPublicMemberProjects(author.id,0);}catch{sidebarProjects=undefined;projectError=true;}
      }
    } catch(error) {if(projectView)throw error;projectError=true;}
    result = homeView||projectView ? undefined : selected ? await getBoardPosts(author.id, selected, page) : await getPublicBlogPosts(handle, page, undefined, fetch, q);
    if(homeView&&home){ const {recentPosts:showPosts,featuredProjects:showProjects}=visibleHomeDataLoads(home); const [postResults,projectResults]=await Promise.all([Promise.allSettled(showPosts?[getPublicBlogPosts(handle,0)]:[]),Promise.allSettled(showProjects?home.featuredProjectIds.map(id=>getPublicProject(id).then(project=>{if(project.owner.id!==author!.id)throw new GuestApiError("response");return project})):[])]); const postResult=postResults[0]; if(postResult?.status==="fulfilled")homePosts=postResult.value; else if(postResult)homePostsFailed=true; homeProjects=projectResults.flatMap(item=>item.status==="fulfilled"?[item.value]:[]); homeProjectErrors=projectResults.filter(item=>item.status==="rejected").length; }
  } catch (error) {
    if (error instanceof GuestApiError && error.kind === "not-found") notFound();
    const message = error instanceof GuestApiError && error.kind === "configuration"
      ? "블로그 목록 API를 설정하지 못했습니다."
      : "블로그 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
    return <><SiteHeader /><main className="page-shell"><section className="list-state" aria-labelledby="blog-error-title">
      <h1 id="blog-error-title">블로그 목록을 불러올 수 없어요</h1><p role="alert">{message}</p>
      <a className="button" href={projectView?`/blogs/${handle}?view=projects&page=${page}`:blogHref(handle, page,selected,q)}>다시 시도</a>
    </section></main></>;
  }


  if(!author) notFound();

  const projectPageHref=(targetPage:number)=>`/blogs/${handle}?view=projects${targetPage>0?`&page=${targetPage}`:""}`;
  const photo=safeMediaUrl(author.profileImageUrl);
  return <>
    <a className="skip-link" href="#main-content">본문으로 바로가기</a>
    <SiteHeader />
    <main id="main-content" className="page-shell personal-blog-layout">
      <BlogSidebar footer={<BlogOwnerActions handle={handle}/>} links={<PublicBlogLinks links={links} failed={linksError}/>} handle={handle} query={q} homeView={homeView} selected={selected} projectView={projectView} searched={searched} boards={flattenBoards(boards)} projects={sidebarProjects?.content.slice(0,5)??[]} boardError={boardError} projectError={projectError}>
        <div className="blog-profile-identity">
        {photo?<img className="blog-profile-avatar" src={photo} alt={`${author.nickname} 프로필 사진`}/>:<span className="blog-profile-avatar blog-avatar-fallback" aria-hidden="true">{Array.from(author.nickname)[0]}</span>}
        <h1>{author.blogName}</h1>
        <p>{author.nickname}</p>
        <p className="personal-blog-handle">@{author.handle}</p>
        </div>
        <BlogVisitCount handle={handle}/>
      </BlogSidebar>
      <section className="personal-blog-content" aria-label={homeView?"블로그 홈":projectView?"블로그 프로젝트":"공개 게시글"}>
        {homeView ? home ? <BlogHomeView handle={handle} settings={home} activity={home.activity} projects={homeProjects} projectErrors={homeProjectErrors} hasFeaturedProjects={home.featuredProjectIds.length>0} posts={homePosts} postsFailed={homePostsFailed}/> : <div className="blog-home-failure"><h2>블로그 홈을 불러올 수 없어요</h2><p role="alert">{homeError?"활동과 홈 구성을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.":"블로그 홈 데이터를 불러오지 못했습니다."}</p><a href={`/blogs/${encodeURIComponent(handle)}`}>다시 시도</a></div> : <><div className="personal-blog-heading"><h2>{projectView?"프로젝트":searched?`검색 결과: ${q}`:selected?flattenBoards(boards).find(board=>board.id===selected)?.name:"전체 게시글"}</h2><p>{author.nickname}</p></div>
        <div className="blog-content-body">
        {projectView&&projects&&<>
          {!projects.content.length?<section className="list-state"><h3>공개된 프로젝트가 없어요</h3><p>프로젝트가 공개되면 이곳에서 만나볼 수 있어요.</p>{page>0&&<Link href={projectPageHref(0)}>첫 페이지로</Link>}</section>:<ul className="blog-project-list">{projects.content.map(project=><li key={project.id}><article><div className="post-meta"><span>{project.lifecycleStatus==="COMPLETED"?"완료":"진행 중"}</span><time dateTime={project.createdAt}>{new Intl.DateTimeFormat("ko-KR",{dateStyle:"medium",timeZone:"Asia/Seoul"}).format(new Date(project.createdAt))}</time></div><h3><Link href={`/projects/${project.id}`} prefetch={false}>{project.name}</Link></h3>{project.summary&&<p className="post-summary">{project.summary}</p>}<ul className="tag-list">{project.tags.map(tag=><li key={tag.id}>{tag.name}</li>)}</ul></article></li>)}</ul>}
          {projects.totalPages>0&&<nav className="pagination" aria-label="블로그 프로젝트 페이지">{projects.hasPrevious?<Link href={projectPageHref(page-1)}>← 이전</Link>:<span className="disabled">← 이전</span>}<span>{page+1} / {projects.totalPages} 페이지</span>{projects.hasNext?<Link href={projectPageHref(page+1)}>다음 →</Link>:<span className="disabled">다음 →</span>}</nav>}
        </>}
        {result&&<>
        {!result.content.length ? <section className="list-state"><h2>{searched?"검색 결과가 없어요":page === 0 ? "아직 공개된 글이 없어요" : "이 페이지에는 게시글이 없어요"}</h2>
          <p>{searched?"다른 검색어로 다시 찾아보세요.":page === 0 ? (selected?"이 폴더에 공개 글이 올라오면 이곳에서 만나볼 수 있어요.":"새로운 글이 올라오면 이곳에서 만나볼 수 있어요.") : "글이 삭제되거나 목록이 변경되었을 수 있습니다."}</p>
          {page > 0 && <Link className="button" href={blogHref(handle, 0,selected,q)}>첫 페이지로</Link>}
        </section> : <PostCards posts={result.content} showAuthor={false} />}
        {result.totalPages > 0 && <nav className="pagination" aria-label="블로그 게시글 페이지">
          {result.hasPrevious ? <Link className="page-link" href={blogHref(handle, page - 1,selected,q)} prefetch={false}>← 이전</Link> : <span className="page-link disabled" aria-disabled="true">← 이전</span>}
          <span aria-current="page">{page + 1} / {result.totalPages} 페이지</span>
          {result.hasNext ? <Link className="page-link" href={blogHref(handle, page + 1,selected,q)} prefetch={false}>다음 →</Link> : <span className="page-link disabled" aria-disabled="true">다음 →</span>}
        </nav>}
        </>}
        </div></>}
      </section>
    </main>
  </>;
}
