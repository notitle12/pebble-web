import Link from "next/link";
import { getPublicPosts } from "@/features/post/api/post-list";
import { PostCards } from "@/features/post/components/post-cards";
import { getPublicProjects } from "@/features/project/api/project-list";
import { ProjectCards } from "@/features/project/components/project-cards";
import { searchHref, type SearchQuery } from "../query";
import { searchPublicBlogs, type BlogSearchPage } from "../blog-search";
import { BlogSearchResults } from "./blog-search-results";

type SearchPageResult = Pick<BlogSearchPage, "hasNext" | "hasPrevious" | "totalPages">;

function Pages({ query, result }: { query: SearchQuery; result: SearchPageResult }) {
  if (!result.totalPages) return null;
  const label = query.type === "posts" ? "게시글" : query.type === "projects" ? "프로젝트" : "블로그";
  return <nav className="pagination" aria-label={`${label} 검색 페이지 이동`}>
    {result.hasPrevious ? <Link className="page-link" href={searchHref(query, query.page - 1)} prefetch={false}>← 이전</Link> : <span className="page-link disabled" aria-disabled="true">← 이전</span>}
    <span aria-current="page">{query.page + 1} / {result.totalPages}</span>
    {result.hasNext ? <Link className="page-link" href={searchHref(query, query.page + 1)} prefetch={false}>다음 →</Link> : <span className="page-link disabled" aria-disabled="true">다음 →</span>}
  </nav>;
}

function Failure({ query, label }: { query: SearchQuery; label: string }) {
  const particle = label === "게시글" ? "을" : "를";
  return <div className="list-state" role="alert"><h3>{label}{particle} 불러오지 못했어요</h3><p>잠시 후 다시 시도해 주세요.</p><a className="button" href={searchHref(query)}>다시 시도</a></div>;
}

function BlogResults({ query, result, preview }: { query: SearchQuery; result: PromiseSettledResult<BlogSearchPage | null>; preview: boolean }) {
  if (result.status === "fulfilled" && !result.value) return null;
  return <section className="discovery-section" aria-labelledby="blog-result-title">
    <div className="discovery-heading"><h2 id="blog-result-title">블로그 {result.status === "fulfilled" && result.value && <span>{result.value.totalElements.toLocaleString("ko-KR")}</span>}</h2>
      {preview && <Link href={searchHref({ ...query, type: "blogs" }, 0)}>블로그 전체 보기 ↗</Link>}
    </div>
    {result.status === "rejected" ? <Failure query={query} label="블로그" />
      : result.value && (!result.value.content.length ? <div className="quiet-empty"><p>이 조건에 맞는 블로그가 없어요.</p>{query.page > 0 && <Link className="button" href={searchHref(query, 0)}>첫 페이지로</Link>}</div>
        : <><BlogSearchResults page={result.value} limit={preview ? 4 : undefined}/>{query.type === "blogs" && <Pages query={query} result={result.value}/>}</>)}
  </section>;
}

export async function SearchResults({ query }: { query: SearchQuery }) {
  if (!query.q) return <section className="list-state"><h2>궁금한 기록을 검색해 보세요</h2><p>검색어를 입력하면 게시글과 프로젝트, 블로그를 함께 찾을 수 있어요.</p></section>;

  const preview = query.type === "all";
  const showPosts = preview || query.type === "posts";
  const showProjects = preview || query.type === "projects";
  const showBlogs = preview || query.type === "blogs";
  const [posts, projects, blogs] = await Promise.allSettled([
    showPosts ? getPublicPosts(query.page, undefined, undefined, { q: query.q }) : null,
    showProjects ? getPublicProjects({ page: query.page, q: query.q }) : null,
    showBlogs ? searchPublicBlogs(query.q, query.page) : null,
  ]);

  return <div className="search-result-sections">
    {showPosts && <section className="discovery-section" aria-labelledby="post-result-title">
      <div className="discovery-heading"><h2 id="post-result-title">게시글 {posts.status === "fulfilled" && posts.value && <span>{posts.value.totalElements.toLocaleString("ko-KR")}</span>}</h2>{preview && <Link href={searchHref({ ...query, type: "posts" }, 0)}>게시글 전체 보기 ↗</Link>}</div>
      {posts.status === "rejected" ? <Failure query={query} label="게시글" /> : posts.value && (!posts.value.content.length ? <div className="quiet-empty"><p>이 조건에 맞는 게시글이 없어요.</p>{query.page > 0 && <Link className="button" href={searchHref(query, 0)}>첫 페이지로</Link>}</div>
        : <><PostCards posts={preview ? posts.value.content.slice(0, 4) : posts.value.content} showTags={false}/>{query.type === "posts" && <Pages query={query} result={posts.value}/>}</>)}</section>}
    {showProjects && <section className="discovery-section" aria-labelledby="project-result-title">
      <div className="discovery-heading"><h2 id="project-result-title">프로젝트 {projects.status === "fulfilled" && projects.value && <span>{projects.value.totalElements.toLocaleString("ko-KR")}</span>}</h2>{preview && <Link href={searchHref({ ...query, type: "projects" }, 0)}>프로젝트 전체 보기 ↗</Link>}</div>
      {projects.status === "rejected" ? <Failure query={query} label="프로젝트" /> : projects.value && (!projects.value.content.length ? <div className="quiet-empty"><p>이 조건에 맞는 프로젝트가 없어요.</p>{query.page > 0 && <Link className="button" href={searchHref(query, 0)}>첫 페이지로</Link>}</div>
        : <><ProjectCards projects={preview ? projects.value.content.slice(0, 4) : projects.value.content} variant="horizontal"/>{query.type === "projects" && <Pages query={query} result={projects.value}/>}</>)}</section>}
    {showBlogs && <BlogResults query={query} result={blogs} preview={preview}/>}
  </div>;
}
