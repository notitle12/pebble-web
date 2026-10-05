import Link from "next/link";
import { getPublicPosts } from "@/features/post/api/post-list";
import { PostCards } from "@/features/post/components/post-cards";
import { getPublicProjects,projectHref } from "@/features/project/api/project-list";
import { searchHref,type SearchQuery } from "../query";
function Pages({query,result}:{query:SearchQuery;result:{hasNext:boolean;hasPrevious:boolean;totalPages:number}}){
  if(!result.totalPages)return null;
  return <nav className="pagination" aria-label={`${query.type==="posts"?"게시글":"프로젝트"} 검색 페이지 이동`}>{result.hasPrevious?<Link className="page-link" href={searchHref(query,query.page-1)} prefetch={false}>← 이전</Link>:<span className="page-link disabled" aria-disabled="true">← 이전</span>}<span aria-current="page">{query.page+1} / {result.totalPages}</span>{result.hasNext?<Link className="page-link" href={searchHref(query,query.page+1)} prefetch={false}>다음 →</Link>:<span className="page-link disabled" aria-disabled="true">다음 →</span>}</nav>;
}
function Failure({query,label}:{query:SearchQuery;label:string}){return <div className="list-state" role="alert"><h3>{label}{label==="프로젝트"?"를":"을"} 불러오지 못했어요</h3><p>잠시 후 다시 시도해 주세요.</p><a className="button" href={searchHref(query)}>다시 시도</a></div>;}
export async function SearchResults({query}:{query:SearchQuery}) {
  if(!query.q)return <section className="list-state"><h2>궁금한 기록을 검색해 보세요</h2><p>검색어를 입력하면 게시글과 프로젝트를 함께 찾을 수 있어요.</p></section>;
  const [posts,projects]=await Promise.allSettled([
    query.type!=="projects"?getPublicPosts(query.page,undefined,undefined,{q:query.q}):Promise.resolve(null),
    query.type!=="posts"?getPublicProjects({page:query.page,q:query.q}):Promise.resolve(null),
  ]);
  return <div className="search-result-sections">
    {query.type!=="projects"&&<section className="discovery-section" aria-labelledby="post-result-title"><div className="discovery-heading"><h2 id="post-result-title">게시글 {posts.status==="fulfilled"&&posts.value&&<span>{posts.value.totalElements.toLocaleString("ko-KR")}</span>}</h2>{query.type==="all"&&<Link href={searchHref({...query,type:"posts"},0)}>게시글 전체 보기 ↗</Link>}</div>{posts.status==="rejected"?<Failure query={query} label="게시글"/>:posts.value&&!posts.value.content.length?<div className="quiet-empty"><p>이 조건에 맞는 게시글이 없어요.</p>{query.page>0&&<Link className="button" href={searchHref(query,0)}>첫 페이지로</Link>}</div>:posts.value&&<><PostCards posts={query.type==="all"?posts.value.content.slice(0,4):posts.value.content} showTags={false}/>{query.type==="posts"&&<Pages query={query} result={posts.value}/>}</>}</section>}
    {query.type!=="posts"&&<section className="discovery-section" aria-labelledby="project-result-title"><div className="discovery-heading"><h2 id="project-result-title">프로젝트 {projects.status==="fulfilled"&&projects.value&&<span>{projects.value.totalElements.toLocaleString("ko-KR")}</span>}</h2>{query.type==="all"&&<Link href={searchHref({...query,type:"projects"},0)}>프로젝트 전체 보기 ↗</Link>}</div>{projects.status==="rejected"?<Failure query={query} label="프로젝트"/>:projects.value&&!projects.value.content.length?<div className="quiet-empty"><p>이 조건에 맞는 프로젝트가 없어요.</p>{query.page>0&&<Link className="button" href={searchHref(query,0)}>첫 페이지로</Link>}</div>:projects.value&&<><ul className="search-project-list">{(query.type==="all"?projects.value.content.slice(0,4):projects.value.content).map(project=><li key={project.id}><article><p className="post-meta">{project.owner.nickname} · {project.lifecycleStatus==="COMPLETED"?"완료":"진행 중"}</p><h3><Link href={projectHref(project.id)!} prefetch={false}>{project.name}</Link></h3>{project.summary&&<p>{project.summary}</p>}</article></li>)}</ul>{query.type==="projects"&&<Pages query={query} result={projects.value}/>}</>}</section>}
  </div>;
}
