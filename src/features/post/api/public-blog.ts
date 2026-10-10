import { GuestApiError, guestJson } from "../../../lib/public-api.ts";
import { PAGE_SIZE, parsePostPage, type PostPage } from "./post-list.ts";
import { parsePage, validTagId } from "../../../lib/list-query.ts";

const validHandle = (handle: string) => /^[a-z][a-z0-9_-]{1,28}[a-z0-9_]$/.test(handle);

export function blogHref(handle: string, page: number, boardId?:string, q?:string): string {
  if (!validHandle(handle) || !Number.isSafeInteger(page) || page < 0 || parsePage(String(page)) !== page) {
    throw new GuestApiError("response");
  }
  if(boardId!==undefined&&!validTagId(boardId))throw new GuestApiError("response");
  if(q!==undefined&&q.length>200)throw new GuestApiError("response");
  const params=new URLSearchParams();params.set("view","posts");if(boardId)params.set("boardId",boardId);if(q)params.set("q",q);if(page>0)params.set("page",String(page));
  return `/blogs/${encodeURIComponent(handle)}${params.size?`?${params}`:""}`;
}

export async function getPublicBlogPosts(
  handle: string,
  page: number,
  baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL,
  request: typeof fetch = fetch,
  q?: string,
): Promise<PostPage> {
  if (!validHandle(handle) || !Number.isSafeInteger(page) || page < 0 || parsePage(String(page)) !== page || q !== undefined && q.length > 200) {
    throw new GuestApiError("response");
  }
  const params = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE) });
  if (q) params.set("q", q);
  const parsed = parsePostPage(await guestJson(`blogs/${encodeURIComponent(handle)}/posts`, params, baseUrl, request), page);
  if (parsed.content.some(post => post.author.handle !== handle)) throw new GuestApiError("response");
  return parsed;
}


export type PublicBlogProfile = {
  id: string;
  handle: string;
  nickname: string;
  blogName: string;
  profileImageUrl: string | null;
};

export function parsePublicBlogProfile(value: unknown, handle: string): PublicBlogProfile {
  if (!validHandle(handle) || typeof value !== "object" || value === null || Array.isArray(value)) throw new GuestApiError("response");
  const data = (value as Record<string, unknown>).data;
  if (typeof data !== "object" || data === null || Array.isArray(data)) throw new GuestApiError("response");
  const profile = data as Record<string, unknown>;
  if (typeof profile.id !== "string" || !validTagId(profile.id) || profile.handle !== handle
    || typeof profile.nickname !== "string" || !profile.nickname.trim()
    || typeof profile.blogName !== "string" || !profile.blogName.trim()
    || !(profile.profileImageUrl === null || typeof profile.profileImageUrl === "string")) throw new GuestApiError("response");
  return { id: profile.id, handle, nickname: profile.nickname, blogName: profile.blogName, profileImageUrl: profile.profileImageUrl };
}

export async function getPublicBlogProfile(
  handle: string,
  baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL,
  request: typeof fetch = fetch,
): Promise<PublicBlogProfile> {
  if (!validHandle(handle)) throw new GuestApiError("response");
  return parsePublicBlogProfile(await guestJson(`blogs/${encodeURIComponent(handle)}`, new URLSearchParams(), baseUrl, request), handle);
}
