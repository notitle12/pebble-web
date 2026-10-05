import {getPublicBoards,getBoardPosts,flattenBoards,type Board} from "@/features/board/api/boards";
import {BlogOwnerActions} from "@/features/auth/components/blog-owner-actions";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { GuestApiError } from "@/lib/public-api";
import { parsePage,validTagId } from "@/lib/list-query";
import { blogHref, getPublicBlogPosts, getPublicBlogProfile } from "@/features/post/api/public-blog";
import { PostCards } from "@/features/post/components/post-cards";

export const dynamic = "force-dynamic";
const validHandle = (handle: string) => /^[a-z][a-z0-9-]{1,28}[a-z0-9]$/.test(handle);

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
  const selected=typeof query.boardId==="string"?query.boardId:undefined;
  if (page === null || Object.keys(query).some(key => !["page","boardId"].includes(key)) || query.boardId!==undefined&&(!selected||!validTagId(selected))) {
    return <><SiteHeader /><main className="page-shell"><InvalidPage /></main></>;
  }

  let result;let author;let boards:Board[]=[];let boardError=false;
  try {
    author = await getPublicBlogProfile(handle);
    try { boards = await getPublicBoards(author.id); }
    catch (error) { if (selected) throw error; boardError = true; }
    if (selected && !flattenBoards(boards).some(board => board.id === selected)) throw new GuestApiError("not-found");
    result = selected ? await getBoardPosts(author.id, selected, page) : await getPublicBlogPosts(handle, page);
  } catch (error) {
    if (error instanceof GuestApiError && error.kind === "not-found") notFound();
    const message = error instanceof GuestApiError && error.kind === "configuration"
      ? "블로그 목록 API를 설정하지 못했습니다."
      : "블로그 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
    return <><SiteHeader /><main className="page-shell"><section className="list-state" aria-labelledby="blog-error-title">
      <h1 id="blog-error-title">블로그 목록을 불러올 수 없어요</h1><p role="alert">{message}</p>
      <a className="button" href={blogHref(handle, page,selected)}>다시 시도</a>
    </section></main></>;
  }


  return <>
    <a className="skip-link" href="#main-content">본문으로 바로가기</a>
    <SiteHeader />
    <main id="main-content" className="page-shell personal-blog-layout">
      <aside className="personal-blog-profile" aria-label="블로그 정보">
        <h1>{author.blogName}</h1>
        <p>{author.nickname}</p>
        <p className="personal-blog-handle">@{author.handle}</p>
        <BlogOwnerActions handle={handle}/>
        <nav className="blog-board-nav" aria-label="글 폴더"><Link href={blogHref(handle,0)} aria-current={!selected?"page":undefined}>전체 글</Link>{flattenBoards(boards).map(board=><Link key={board.id} href={blogHref(handle,0,board.id)} aria-current={selected===board.id?"page":undefined} style={{paddingInlineStart:`${board.depth+1}rem`}}>{board.name}</Link>)}</nav>
        {boardError&&<p role="status">폴더를 불러오지 못했어요. 페이지를 새로고침해 주세요.</p>}
      </aside>
      <section className="personal-blog-content" aria-label="공개 게시글">
        <div className="personal-blog-heading"><div><p className="eyebrow">PERSONAL BLOG</p><h2>{selected?flattenBoards(boards).find(board=>board.id===selected)?.name:"기록"}</h2></div>
          <span>{`@${author.handle}`}</span></div>
        {!result.content.length ? <section className="list-state"><h2>{page === 0 ? "아직 공개된 글이 없어요" : "이 페이지에는 게시글이 없어요"}</h2>
          <p>{page === 0 ? (selected?"이 폴더에 공개 글이 올라오면 이곳에서 만나볼 수 있어요.":"새로운 글이 올라오면 이곳에서 만나볼 수 있어요.") : "글이 삭제되거나 목록이 변경되었을 수 있습니다."}</p>
          {page > 0 && <Link className="button" href={blogHref(handle, 0,selected)}>첫 페이지로</Link>}
        </section> : <PostCards posts={result.content} showAuthor={false} />}
        {result.totalPages > 0 && <nav className="pagination" aria-label="블로그 게시글 페이지">
          {result.hasPrevious ? <Link className="page-link" href={blogHref(handle, page - 1,selected)} prefetch={false}>← 이전</Link> : <span className="page-link disabled" aria-disabled="true">← 이전</span>}
          <span aria-current="page">{page + 1} / {result.totalPages} 페이지</span>
          {result.hasNext ? <Link className="page-link" href={blogHref(handle, page + 1,selected)} prefetch={false}>다음 →</Link> : <span className="page-link disabled" aria-disabled="true">다음 →</span>}
        </nav>}
      </section>
    </main>
  </>;
}

