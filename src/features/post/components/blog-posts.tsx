'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useUserSession} from '../../auth/components/member-gate';
import {userSession} from '../../auth/user-session';
import {blogHref} from '../api/public-blog';
import type {PostPage} from '../api/post-list';
import {blogPostHref,matchesOwnerBlogSnapshot,ownBlogPostsPath,parseOwnerBlogPosts,type OwnerBlogSnapshot} from '../api/owner-blog-posts';
import {safeMediaUrl} from '../../media/model';
import {PostCards} from './post-cards';
import {loadPopularPosts,comparePopularPosts} from '../api/popular-posts';

type Props={handle:string;authorId:string;initial:PostPage|null;page?:number;boardId?:string;q?:string;placement?:'boards'|'projects';variant?:'list'|'recent'|'popular';failed?:boolean};
export function BlogPosts({handle,authorId,initial,page=0,boardId,q,placement,variant='list',failed=false}:Props){
 const session=useUserSession(),owner=session.phase==='ready'&&session.member?.id===authorId&&session.member.handle===handle;
 const popular=variant==='popular'||variant==='recent';
 const path=ownBlogPostsPath({page,boardId,q,placement})+(popular?'#popular':'');
 const [snapshot,setSnapshot]=useState<OwnerBlogSnapshot|null>(null),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
  if(!owner)return;
  let live=true;
  const loadPage=async(next:number)=>parseOwnerBlogPosts(await userSession.request(ownBlogPostsPath({page:next,boardId,q,placement})),{page:next,boardId,q,placement},authorId,handle);
  void (popular?loadPopularPosts(loadPage,()=>live&&userSession.snapshot()===session):loadPage(page)).then(data=>{
   if(live)setSnapshot({session,path,data,error:''});
  }).catch(()=>{if(live)setSnapshot({session,path,data:null,error:'내 블로그 글을 불러오지 못했어요.'});});
  return()=>{live=false;};
 },[owner,session,path,authorId,handle,page,boardId,q,placement,attempt,popular]);
 const current=matchesOwnerBlogSnapshot(snapshot,session,path,authorId,handle);
 const data=owner?(current?snapshot!.data:initial):initial;
 if(owner&&!current&&!initial)return <p role="status">내 블로그 글을 불러오고 있어요.</p>;
 if(owner&&snapshot?.error)return <div className="list-state"><p role="alert">{snapshot.error}</p><button className="button" onClick={()=>{setSnapshot(null);setAttempt(n=>n+1);}}>다시 불러오기</button></div>;
 const href=(next:number)=>blogHref(handle,next,boardId,q,placement);
 if(variant==='recent'||variant==='popular'){
  if(!data?.content.length)return <p className="blog-home-empty" role={failed?'alert':undefined}>{failed?'인기 글을 불러오지 못했어요.':owner?'아직 발행한 글이 없어요.':'아직 공개된 글이 없어요.'}</p>;
  const sorted=[...data.content].sort(comparePopularPosts);
  return <ul className="blog-home-posts">{sorted.slice(0,3).map((post)=><li key={post.id}>
   <Link href={blogPostHref(post)} prefetch={false}>
    <span className="blog-home-post-copy">
      <strong>
        <span>{post.title}</span>
        {post.visibilityStatus==='HIDDEN'&&<span className="post-private-badge">비공개</span>}
      </strong>
      {post.summary&&<span className="blog-home-post-summary">{post.summary}</span>}
      <span className="blog-home-post-meta">
        <time dateTime={post.publishedAt??post.createdAt}>{new Intl.DateTimeFormat('ko-KR',{year:'numeric',month:'long',day:'numeric',timeZone:'Asia/Seoul'}).format(new Date(post.publishedAt??post.createdAt))}</time>
        <span className="blog-home-post-likes">· 공감 {(post.likeCount??0).toLocaleString("ko-KR")}</span>
      {post.tags&&post.tags.length>0&&<span className="blog-home-tags" aria-label="태그">{post.tags.slice(0,5).map(tag=><span key={tag}>#{tag}</span>)}</span>}
      </span>
    </span>
    {safeMediaUrl(post.thumbnailUrl??null)?<img src={safeMediaUrl(post.thumbnailUrl??null)!} alt="" width={250} height={165}/>:<span className="blog-post-placeholder" aria-hidden="true"/>}
   </Link>
  </li>)}</ul>;
 }
 if(!data)return <p role="alert">블로그 글을 불러오지 못했어요.</p>;
 return <>
  {!data.content.length?<section className="list-state"><h2>{q?'검색 결과가 없어요':page===0?(owner?'아직 발행한 글이 없어요':'아직 공개된 글이 없어요'):'이 페이지에는 게시글이 없어요'}</h2><p>{q?'다른 검색어로 다시 찾아보세요.':page===0?'새로운 글이 올라오면 이곳에서 만나볼 수 있어요.':'글이 삭제되거나 목록이 변경되었을 수 있습니다.'}</p>{page>0&&<Link className="button" href={href(0)}>첫 페이지로</Link>}</section>:<PostCards posts={data.content} showAuthor={false} showEdit={false}/>}
  {data.totalPages>0&&<nav className="pagination" aria-label="블로그 게시글 페이지">
   {data.hasPrevious?<Link className="page-link" href={href(page-1)} prefetch={false}>← 이전</Link>:<span className="page-link disabled" aria-disabled="true">← 이전</span>}
   <span aria-current="page">{page+1} / {data.totalPages} 페이지</span>
   {data.hasNext?<Link className="page-link" href={href(page+1)} prefetch={false}>다음 →</Link>:<span className="page-link disabled" aria-disabled="true">다음 →</span>}
  </nav>}
 </>;
}
