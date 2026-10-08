import {safeMediaUrl} from "@/features/media/model";
import {LikePanel} from "@/features/like/components/like-panel";
import {CommentsPanel} from "@/features/comment/components/comments-panel";
import { cache, Suspense } from "react";
import {LinkedProject} from "@/features/post/components/linked-project";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { getPublicPost, PostListError, postHref } from "@/features/post/api/post-list";
import { PostBody } from "@/features/post/components/post-body";
import { OwnPostEdit } from "@/features/post/components/own-post-edit";
const readPost = cache(getPublicPost);
type Props = { params: Promise<{ handle: string; postKey: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle, postKey } = await params;
  try { const post = await readPost(handle, postKey); return { title: post.title, description: post.summary ?? undefined }; }
  catch { return { title: "게시글" }; }
}
export const dynamic = "force-dynamic";
export default async function PostPage({ params }: Props) {
  const { handle, postKey } = await params;
  let post;
  try { post = await readPost(handle, postKey); }
  catch (error) {
    if (error instanceof PostListError && error.kind === "not-found") notFound();
    return <><SiteHeader /><main className="page-shell detail-shell"><section className="list-state" role="alert">
      <h1>글을 불러오지 못했어요</h1><p>잠시 후 다시 시도해 주세요.</p>
      <a className="button" href={postHref(handle, postKey) ?? "/"}>다시 시도</a><Link className="button" href="/">글 목록으로</Link>
    </section></main></>;
  }
  const date = post.publishedAt ?? post.createdAt;
  return <><a className="skip-link" href="#main-content">본문으로 바로가기</a><SiteHeader />
    <main id="main-content" className="page-shell detail-shell">
      <Link className="detail-back" href={`/blogs/${post.author.handle}`}>← {post.author.blogName??"블로그"}</Link>
      {process.env.NODE_ENV === "development" && process.env.PEBBLE_PREVIEW_MODE === "mock" && <p className="preview-notice">목 데이터 미리보기 · 실제 게시글이 아닙니다</p>}
      <article className="post-detail"><header><div className="post-meta"><span>{post.author.nickname}</span><time dateTime={date}>{new Intl.DateTimeFormat("ko-KR",{dateStyle:"long",timeZone:"Asia/Seoul"}).format(new Date(date))}</time></div>
        <h1>{post.title}</h1>{post.summary && <p>{post.summary}</p>}
        <ul className="tag-list" aria-label="기술 태그">{post.tags.map(tag=><li key={tag.id}>{tag.name}</li>)}</ul><OwnPostEdit postId={post.id} authorId={post.author.id}/>
      {safeMediaUrl(post.thumbnailUrl??null)&&<img className="content-thumbnail" src={safeMediaUrl(post.thumbnailUrl??null)!} alt="글 대표 이미지"/>}</header><PostBody blocks={post.blocks} /></article>
    <LikePanel target="posts" contentId={post.id} initialCount={post.likeCount}/>
    {post.projectId&&<Suspense fallback={<section className="linked-project" role="status">연결 프로젝트를 불러오는 중…</section>}><LinkedProject id={post.projectId}/></Suspense>}
    <CommentsPanel target="posts" contentId={post.id}/></main><footer className="site-footer">Pebble · 함께 쌓아가는 개발 기록</footer></>;
}
