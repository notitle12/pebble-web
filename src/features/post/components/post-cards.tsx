import {ContentPlaceholder} from "@/components/content-placeholder";
import {IntentLink} from "@/components/intent-link";
import {LikeCount} from "@/features/like/components/like-count";
import {safeMediaUrl} from "@/features/media/model";
import type {ComponentProps} from "react";
import Link from "next/link";
import {type PostSummary} from "../api/post-list";
import {blogPostHref} from "../api/owner-blog-posts";
const dateFormat = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Seoul" });
function PostDestinationLink({post,...props}:ComponentProps<typeof Link>&{post:PostSummary}) {
  return post.visibilityStatus!=="HIDDEN"?<IntentLink {...props}/>:<Link {...props} prefetch={false}/>;
}
export function PostCards({posts,showAuthor=true,showTags=true,showEdit=false}:{posts:PostSummary[];showAuthor?:boolean;showTags?:boolean;showEdit?:boolean}) {return <>
    <ul className="post-list">{posts.map(post => {
      const date = post.publishedAt ?? post.createdAt;
      return <li key={post.id}><article className="post-card">
        <div className="post-meta">{showAuthor&&<><IntentLink className="post-author-link" href={`/blogs/${post.author.handle}`}>{post.author.blogName??`${post.author.nickname}의 블로그`}</IntentLink><span aria-hidden="true">·</span></>}<time dateTime={date}>{dateFormat.format(new Date(date))}</time><LikeCount count={post.likeCount}/>{post.visibilityStatus==="HIDDEN"&&<span className="post-private-badge">비공개</span>}{showEdit&&<Link className="blog-post-edit" href={`/posts/${post.id}/edit`} prefetch={false}>수정</Link>}</div>
        <PostDestinationLink post={post} className="content-thumbnail post-thumbnail-link" href={blogPostHref(post)} aria-label={`${post.title} 읽기`}>{safeMediaUrl(post.thumbnailUrl??null)?<img src={safeMediaUrl(post.thumbnailUrl??null)!} alt="" loading="lazy"/>:<ContentPlaceholder className="blog-post-placeholder"/>}</PostDestinationLink>
        <h3><PostDestinationLink post={post} href={blogPostHref(post)}>{post.title}</PostDestinationLink></h3>
        {post.summary && <p className="post-summary">{post.summary}</p>}
        {showTags && post.tags.length > 0 && <ul className="tag-list" aria-label="태그">{post.tags.map(tag => <li key={tag}>#{tag}</li>)}</ul>}
      </article></li>;
    })}</ul>
</>;}
