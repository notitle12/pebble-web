import {LikeCount} from "@/features/like/components/like-count";
import {safeMediaUrl} from "@/features/media/model";
import Link from "next/link";
import {postHref,type PostSummary} from "../api/post-list";
const dateFormat = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Seoul" });
export function PostCards({posts,showAuthor=true,showTags=true}:{posts:PostSummary[];showAuthor?:boolean;showTags?:boolean}) {return <>
    <ul className="post-list">{posts.map(post => {
      const date = post.publishedAt ?? post.createdAt;
      return <li key={post.id}><article className="post-card">
        <div className="post-meta">{showAuthor&&<><Link className="post-author-link" href={`/blogs/${post.author.handle}`} prefetch={false}>{post.author.blogName??`${post.author.nickname}의 블로그`}</Link><span aria-hidden="true">·</span></>}<time dateTime={date}>{dateFormat.format(new Date(date))}</time><LikeCount count={post.likeCount}/></div>
        {safeMediaUrl(post.thumbnailUrl??null)&&<img className="content-thumbnail" src={safeMediaUrl(post.thumbnailUrl??null)!} alt="" loading="lazy"/>}
        <h3><Link href={postHref(post.author.handle, post.urlKey)!} prefetch={false}>{post.title}</Link></h3>
        {post.summary && <p className="post-summary">{post.summary}</p>}
        {showTags && post.tags.length > 0 && <ul className="tag-list" aria-label="기술 태그">{post.tags.map(tag => <li key={tag.id}>{tag.name}</li>)}</ul>}
      </article></li>;
    })}</ul>
</>;}
