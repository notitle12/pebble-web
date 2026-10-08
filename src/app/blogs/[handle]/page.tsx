import {getPublicBoards,getBoardPosts,flattenBoards,type Board} from "@/features/board/api/boards";
import {BlogOwnerActions} from "@/features/auth/components/blog-owner-actions";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { GuestApiError } from "@/lib/public-api";
import { parsePage,validTagId } from "@/lib/list-query";
import { blogHref, getPublicBlogPosts, getPublicBlogProfile } from "@/features/post/api/public-blog";
import {safeMediaUrl} from "@/features/media/model";
import {getPublicMemberProjects,type ProjectPage} from "@/features/project/api/project-list";
import { PostCards } from "@/features/post/components/post-cards";

export const dynamic = "force-dynamic";
const validHandle = (handle: string) => /^[a-z][a-z0-9_-]{1,28}[a-z0-9_]$/.test(handle);

function InvalidPage() {
  return <section className="list-state"><h1>페이지 주소를 확인해 주세요</h1><p>페이지 번호는 0 이상의 숫자여야 합니다.</p></section>;
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
  const selected=typeof query.boardId==="string"?query.boardId:undefined;
  if (page === null || Object.keys(query).some(key => !["page","boardId","view"].includes(key)) || query.boardId!==undefined&&(!selected||!validTagId(selected)) || query.view!==undefined&&!projectView || projectView&&query.boardId!==undefined) {
    return <><SiteHeader /><main className="page-shell"><InvalidPage /></main></>;
  }

  let result;let projects:ProjectPage|undefined;let sidebarProjects:ProjectPage|undefined;let projectError=false;let author;let boards:Board[]=[];let boardError=false;
  try {
    author = await getPublicBlogProfile(handle);
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
    result = projectView ? undefined : selected ? await getBoardPosts(author.id, selected, page) : await getPublicBlogPosts(handle, page);
  } catch (error) {
    if (error instanceof GuestApiError && error.kind === "not-found") notFound();
    const message = error instanceof GuestApiError && error.kind === "configuration"
      ? "블로그 목록 API를 설정하지 못했습니다."
      : "블로그 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
    return <><SiteHeader /><main className="page-shell"><section className="list-state" aria-labelledby="blog-error-title">
      <h1 id="blog-error-title">블로그 목록을 불러올 수 없어요</h1><p role="alert">{message}</p>
      <a className="button" href={projectView?`/blogs/${handle}?view=projects&page=${page}`:blogHref(handle, page,selected)}>다시 시도</a>
    </section></main></>;
  }


  const projectPageHref=(targetPage:number)=>`/blogs/${handle}?view=projects${targetPage>0?`&page=${targetPage}`:""}`;
  const photo=safeMediaUrl(author.profileImageUrl);
  return <>
    <a className="skip-link" href="#main-content">본문으로 바로가기</a>
    <SiteHeader />
    <main id="main-content" className="page-shell personal-blog-layout">
      <aside className="personal-blog-profile" aria-label="블로그 정보">
        <div className="blog-profile-identity">
        {photo?<img className="blog-profile-avatar" src={photo} alt={`${author.nickname} 프로필 사진`}/>:<span className="blog-profile-avatar blog-avatar-fallback" aria-hidden="true">{Array.from(author.nickname)[0]}</span>}
        <h1>{author.blogName}</h1>
        <p>{author.nickname}</p>
        <p className="personal-blog-handle">@{author.handle}</p>
        </div>
        <nav className="blog-board-nav" aria-label="게시판"><h2>게시판</h2><Link href={blogHref(handle,0)} aria-current={!selected&&!projectView?"page":undefined}>전체 게시글</Link>{flattenBoards(boards).map(board=><Link key={board.id} href={blogHref(handle,0,board.id)} aria-current={selected===board.id?"page":undefined} style={{paddingInlineStart:`${board.depth+1}rem`}}>{board.name}</Link>)}</nav>
        {boardError&&<p role="status">폴더를 불러오지 못했어요. 페이지를 새로고침해 주세요.</p>}
        <nav className="blog-project-nav" aria-label="블로그 프로젝트"><h2>프로젝트</h2><Link href={projectPageHref(0)} aria-current={projectView?"page":undefined}>전체 프로젝트</Link>
          {sidebarProjects?.content.slice(0,5).map(project=><Link key={project.id} href={`/projects/${project.id}`} prefetch={false}>{project.name}</Link>)}
          {projectError&&<p role="status">프로젝트를 불러오지 못했어요.</p>}
        </nav>
        <BlogOwnerActions handle={handle}/>
      </aside>
      <section className="personal-blog-content" aria-label={projectView?"블로그 프로젝트":"공개 게시글"}>
        <div className="personal-blog-heading"><h2>{projectView?"프로젝트":selected?flattenBoards(boards).find(board=>board.id===selected)?.name:"전체 게시글"}</h2><p>{author.nickname}</p></div>
        <div className="blog-content-body">
        {projectView&&projects&&<>
          {!projects.content.length?<section className="list-state"><h3>공개된 프로젝트가 없어요</h3><p>프로젝트가 공개되면 이곳에서 만나볼 수 있어요.</p>{page>0&&<Link href={projectPageHref(0)}>첫 페이지로</Link>}</section>:<ul className="blog-project-list">{projects.content.map(project=><li key={project.id}><article><div className="post-meta"><span>{project.lifecycleStatus==="COMPLETED"?"완료":"진행 중"}</span><time dateTime={project.createdAt}>{new Intl.DateTimeFormat("ko-KR",{dateStyle:"medium",timeZone:"Asia/Seoul"}).format(new Date(project.createdAt))}</time></div><h3><Link href={`/projects/${project.id}`} prefetch={false}>{project.name}</Link></h3>{project.summary&&<p className="post-summary">{project.summary}</p>}<ul className="tag-list">{project.tags.map(tag=><li key={tag.id}>{tag.name}</li>)}</ul></article></li>)}</ul>}
          {projects.totalPages>0&&<nav className="pagination" aria-label="블로그 프로젝트 페이지">{projects.hasPrevious?<Link href={projectPageHref(page-1)}>← 이전</Link>:<span className="disabled">← 이전</span>}<span>{page+1} / {projects.totalPages} 페이지</span>{projects.hasNext?<Link href={projectPageHref(page+1)}>다음 →</Link>:<span className="disabled">다음 →</span>}</nav>}
        </>}
        {result&&<>
        {!result.content.length ? <section className="list-state"><h2>{page === 0 ? "아직 공개된 글이 없어요" : "이 페이지에는 게시글이 없어요"}</h2>
          <p>{page === 0 ? (selected?"이 폴더에 공개 글이 올라오면 이곳에서 만나볼 수 있어요.":"새로운 글이 올라오면 이곳에서 만나볼 수 있어요.") : "글이 삭제되거나 목록이 변경되었을 수 있습니다."}</p>
          {page > 0 && <Link className="button" href={blogHref(handle, 0,selected)}>첫 페이지로</Link>}
        </section> : <PostCards posts={result.content} showAuthor={false} />}
        {result.totalPages > 0 && <nav className="pagination" aria-label="블로그 게시글 페이지">
          {result.hasPrevious ? <Link className="page-link" href={blogHref(handle, page - 1,selected)} prefetch={false}>← 이전</Link> : <span className="page-link disabled" aria-disabled="true">← 이전</span>}
          <span aria-current="page">{page + 1} / {result.totalPages} 페이지</span>
          {result.hasNext ? <Link className="page-link" href={blogHref(handle, page + 1,selected)} prefetch={false}>다음 →</Link> : <span className="page-link disabled" aria-disabled="true">다음 →</span>}
        </nav>}
        </>}
        </div>
      </section>
    </main>
  </>;
}
