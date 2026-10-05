import Link from "next/link";
import {postHref,type PostSummary} from "../api/post-list";
const dateFormat = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Seoul" });
export function PostCards({posts}:{posts:PostSummary[]}) {return <>
    <ul className="post-list">{posts.map(post => {
      const date = post.publishedAt ?? post.createdAt;
      return <li key={post.id}><article className="post-card">
        <div className="post-meta"><span>{post.author.nickname}</span><span aria-hidden="true">·</span><time dateTime={date}>{dateFormat.format(new Date(date))}</time></div>
        <h3><Link href={postHref(post.author.handle, post.urlKey)!} prefetch={false}>{post.title}</Link></h3>
        {post.summary && <p className="post-summary">{post.summary}</p>}
        {post.tags.length > 0 && <ul className="tag-list" aria-label="기술 태그">{post.tags.map(tag => <li key={tag.id}>{tag.name}</li>)}</ul>}
      </article></li>;
    })}</ul>
</>;}
