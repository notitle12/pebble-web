import { GuestApiError, guestJson } from "../../../lib/public-api.ts";
import { PAGE_SIZE, parsePostPage, type PostPage } from "./post-list.ts";
import { parsePage } from "../../../lib/list-query.ts";

const validHandle = (handle: string) => /^[a-z][a-z0-9-]{1,28}[a-z0-9]$/.test(handle);

export function blogHref(handle: string, page: number): string {
  if (!validHandle(handle) || !Number.isSafeInteger(page) || page < 0 || parsePage(String(page)) !== page) {
    throw new GuestApiError("response");
  }
  return page === 0 ? `/blogs/${encodeURIComponent(handle)}` : `/blogs/${encodeURIComponent(handle)}?page=${page}`;
}

export async function getPublicBlogPosts(
  handle: string,
  page: number,
  baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL,
  request: typeof fetch = fetch,
): Promise<PostPage> {
  if (!validHandle(handle) || !Number.isSafeInteger(page) || page < 0 || parsePage(String(page)) !== page) {
    throw new GuestApiError("response");
  }
  const params = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE) });
  const parsed = parsePostPage(await guestJson(`blogs/${encodeURIComponent(handle)}/posts`, params, baseUrl, request), page);
  if (parsed.content.some(post => post.author.handle !== handle)) throw new GuestApiError("response");
  return parsed;
}

