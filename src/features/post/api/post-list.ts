import { GuestApiError as PostListError, guestJson } from "../../../lib/public-api.ts";
export { GuestApiError as PostListError } from "../../../lib/public-api.ts";
export const PAGE_SIZE = 20;

export type PostSummary = {
  id: string;
  urlKey: string;
  title: string;
  summary: string | null;
  author: { id: string; handle: string; nickname: string; blogName: string | null };
  tags: { id: string; name: string }[];
  publishedAt: string | null;
  createdAt: string;
};
export type PostPage = {
  content: PostSummary[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
};
export { parsePage, parseListQuery as parsePostQuery } from "../../../lib/list-query.ts";
export type { ListFilters as PostFilters, ListQuery as PostQuery } from "../../../lib/list-query.ts";
import { parsePage, parseListQuery as parsePostQuery, validTagId, type ListFilters as PostFilters } from "../../../lib/list-query.ts";
export function pageHref(page: number, filters: PostFilters = {}): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.tagId) params.set("tagId", filters.tagId);
  if (page > 0) params.set("page", String(page));
  return params.size ? `/?${params}` : "/";
}
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const id = (value: unknown): value is string => typeof value === "string" && /^[1-9]\d*$/.test(value);
const nullableText = (value: unknown): value is string | null => value === null || typeof value === "string";
const timestamp = (value: unknown): value is string =>
  typeof value === "string" && Number.isFinite(Date.parse(value));
const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
function isPost(value: unknown): value is PostSummary & Record<string, unknown> {
  if (!record(value) || !record(value.author)) return false;
  return id(value.id) && typeof value.urlKey === "string" && validPostKey(value.urlKey)
    && typeof value.author.handle === "string" && validHandle(value.author.handle) && typeof value.title === "string" && nullableText(value.summary)
    && id(value.author.id) && typeof value.author.nickname === "string" && nullableText(value.author.blogName)
    && Array.isArray(value.tags) && value.tags.every(tag => record(tag) && id(tag.id) && typeof tag.name === "string")
    && (value.publishedAt === null || timestamp(value.publishedAt)) && timestamp(value.createdAt);
}
export function parsePostPage(value: unknown, requestedPage: number): PostPage {
  if (!record(value) || !record(value.data)) throw new PostListError("response");
  const data = value.data;
  if (!Array.isArray(data.content) || !data.content.every(isPost)
    || data.page !== requestedPage || data.size !== PAGE_SIZE
    || !count(data.totalElements) || !count(data.totalPages)
    || typeof data.hasNext !== "boolean" || typeof data.hasPrevious !== "boolean"
    || data.content.length > PAGE_SIZE
    || data.totalPages !== Math.ceil(data.totalElements / PAGE_SIZE)
    || data.hasNext !== (requestedPage + 1 < data.totalPages)
    || data.hasPrevious !== (requestedPage > 0)) throw new PostListError("response");
  return {
    content: data.content, page: requestedPage, size: PAGE_SIZE,
    totalElements: data.totalElements, totalPages: data.totalPages,
    hasNext: data.hasNext, hasPrevious: data.hasPrevious,
  };
}
export async function getPublicPosts(
  page: number,
  baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL,
  request: typeof fetch = fetch,
  filters: PostFilters = {},
): Promise<PostPage> {
  const query = parsePostQuery({ page: String(page), q: filters.q, tagId: filters.tagId });
  if (!query) throw new PostListError("response");
  const params = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE) });
  if (query.q) params.set("q", query.q);
  if (query.tagId) params.set("tagId", query.tagId);
  return parsePostPage(await guestJson(query.q ? "posts/search" : "posts", params, baseUrl, request), page);
}
export { getPublicTags, type PublicTag } from "../../tag/api/public-tags.ts";

const validHandle = (value: string) => /^[a-z][a-z0-9-]{1,28}[a-z0-9]$/.test(value);
const validPostKey = (value: string) => validTagId(value) || (value.length <= 200
  && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value) && !/^\d+$/.test(value) && value !== "search");
export function postHref(handle: string, key: string): string | null {
  return validHandle(handle) && validPostKey(key) ? `/blogs/${encodeURIComponent(handle)}/posts/${encodeURIComponent(key)}` : null;
}
export type PostBlock = { type: "TEXT" | "CODE"; content: string; language: string | null; title: string | null; displayOrder: number };
export type PostDetail = PostSummary & { blocks: PostBlock[] };
const languages = ["JAVA", "JAVASCRIPT", "TYPESCRIPT", "PYTHON", "HTML", "CSS", "SQL", "JSON", "YAML", "MARKDOWN", "BASH", "SHELL"];
export function parsePostDetail(value: unknown): PostDetail {
  if (!record(value) || !isPost(value.data) || !record(value.data)) throw new PostListError("response");
  const data = value.data;
  if (!Array.isArray(data.blocks) || !data.blocks.every(block => record(block)
    && ["TEXT", "CODE"].includes(String(block.type)) && typeof block.content === "string"
    && nullableText(block.title) && count(block.displayOrder)
    && (block.type === "TEXT" ? block.language === null : typeof block.language === "string" && languages.includes(block.language)))) throw new PostListError("response");
  return { ...data, blocks: data.blocks } as PostDetail;
}
export async function getPublicPost(handle: string, key: string, baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL, request: typeof fetch = fetch): Promise<PostDetail> {
  const href = postHref(handle, key);
  if (!href) throw new PostListError("not-found");
  const post = parsePostDetail(await guestJson(href.slice(1), new URLSearchParams(), baseUrl, request));
  if (post.author.handle !== handle || post.urlKey !== key) throw new PostListError("response");
  return post;
}
