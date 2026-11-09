import {cache} from "react";
import { GuestApiError, guestJson } from "../../../lib/public-api.ts";
import { PAGE_SIZE, parsePublicPostPage, type PostPage } from "./post-list.ts";
import { parsePage, validId } from "../../../lib/list-query.ts";

const validHandle = (handle: string) => /^[a-z][a-z0-9_-]{1,28}[a-z0-9_]$/.test(handle);

export function blogHref(handle: string, page: number, boardId?:string, q?:string, placement?: "boards" | "projects"): string {
  if (!validHandle(handle) || !Number.isSafeInteger(page) || page < 0 || parsePage(String(page)) !== page) {
    throw new GuestApiError("response");
  }
  if(boardId!==undefined&&!validId(boardId))throw new GuestApiError("response");
  if(q!==undefined&&q.length>200)throw new GuestApiError("response");
  const params=new URLSearchParams();params.set("view",placement??"posts");if(boardId)params.set("boardId",boardId);if(q)params.set("q",q);if(page>0)params.set("page",String(page));
  return `/blogs/${encodeURIComponent(handle)}${params.size?`?${params}`:""}`;
}

export async function getPublicBlogPosts(
  handle: string,
  page: number,
  baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL,
  request: typeof fetch = fetch,
  q?: string,
  placement?: "boards" | "projects",
): Promise<PostPage> {
  if (!validHandle(handle) || !Number.isSafeInteger(page) || page < 0 || parsePage(String(page)) !== page || q !== undefined && q.length > 200) {
    throw new GuestApiError("response");
  }
  const params = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE) });
  if (q) params.set("q", q);
  if (placement) params.set("placement", placement);
  const parsed = parsePublicPostPage(await guestJson(`blogs/${encodeURIComponent(handle)}/posts`, params, baseUrl, request), page);
  if (parsed.content.some(post => post.author.handle !== handle)) throw new GuestApiError("response");
  return parsed;
}

export async function getPopularPublicBlogPosts(
  handle: string,
  baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL,
  request: typeof fetch = fetch,
): Promise<PostPage> {
  if (!validHandle(handle)) throw new GuestApiError("response");
  const size = 10;
  const page = parsePublicPostPage(await guestJson(`blogs/${encodeURIComponent(handle)}/popular-posts`,
    new URLSearchParams({ page: "0", size: String(size) }), baseUrl, request), 0, size);
  if (page.content.some(post => post.author.handle !== handle || post.visibilityStatus === "HIDDEN")) throw new GuestApiError("response");
  return page;
}


export type PublicBlogProfile = {
  id: string;
  handle: string;
  nickname: string;
  blogName: string;
  profileImageUrl: string | null;
  followerCount: number;
  followingCount: number;
};

export function parsePublicBlogProfile(value: unknown, handle: string): PublicBlogProfile {
  if (!validHandle(handle) || typeof value !== "object" || value === null || Array.isArray(value)) throw new GuestApiError("response");
  const data = (value as Record<string, unknown>).data;
  if (typeof data !== "object" || data === null || Array.isArray(data)) throw new GuestApiError("response");
  const profile = data as Record<string, unknown>;
  if (typeof profile.id !== "string" || !validId(profile.id) || profile.handle !== handle
    || typeof profile.nickname !== "string" || !profile.nickname.trim()
    || typeof profile.blogName !== "string" || !profile.blogName.trim()
    || !(profile.profileImageUrl === null || typeof profile.profileImageUrl === "string")
    || profile.followerCount !== undefined && (!Number.isSafeInteger(profile.followerCount) || (profile.followerCount as number) < 0)
    || profile.followingCount !== undefined && (!Number.isSafeInteger(profile.followingCount) || (profile.followingCount as number) < 0)) throw new GuestApiError("response");
  return { id: profile.id, handle, nickname: profile.nickname, blogName: profile.blogName, profileImageUrl: profile.profileImageUrl,
    followerCount: typeof profile.followerCount === "number" ? profile.followerCount : 0,
    followingCount: typeof profile.followingCount === "number" ? profile.followingCount : 0 };
}

export const getPublicBlogProfile=cache(async function readPublicBlogProfile(
  handle: string,
  baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL,
  request: typeof fetch = fetch,
): Promise<PublicBlogProfile> {
  if (!validHandle(handle)) throw new GuestApiError("response");
  return parsePublicBlogProfile(await guestJson(`blogs/${encodeURIComponent(handle)}`, new URLSearchParams(), baseUrl, request), handle);
});
