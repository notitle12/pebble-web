import Link from "next/link";
import { safeMediaUrl } from "@/features/media/model";
import type { BlogSearchPage } from "../blog-search";

export function BlogSearchResults({ page, limit }: { page: BlogSearchPage; limit?: number }) {
  const results = limit === undefined ? page.content : page.content.slice(0, limit);
  return <ul className="search-blog-list">{results.map(blog => {
    const avatar = safeMediaUrl(blog.profileImageUrl);
    return <li key={blog.handle}><Link href={`/blogs/${encodeURIComponent(blog.handle)}`}>
      {avatar ? <img src={avatar} alt="" width={42} height={42}/> : <span className="search-blog-avatar" aria-hidden="true">{Array.from(blog.nickname)[0]}</span>}
      <span className="search-blog-copy"><strong>{blog.blogName}</strong><span>{blog.nickname}</span></span>
      <span className="search-blog-arrow" aria-hidden="true">↗</span>
    </Link></li>;
  })}</ul>;
}
