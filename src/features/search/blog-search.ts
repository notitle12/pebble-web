import { guestJson, GuestApiError } from "../../lib/public-api.ts";
import { parsePage } from "../../lib/list-query.ts";

export type BlogSearchResult = {
  handle: string;
  nickname: string;
  blogName: string;
  profileImageUrl: string | null;
};

export type BlogSearchPage = {
  content: BlogSearchResult[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
};

const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const validHandle = (value: unknown): value is string => typeof value === "string" && /^[a-z][a-z0-9_-]{1,28}[a-z0-9_]$/.test(value);

export function parseBlogSearchPage(value: unknown, page: number, size = 20): BlogSearchPage {
  if (!record(value) || !record(value.data)) throw new GuestApiError("response");
  const data = value.data;
  if (!Array.isArray(data.content) || data.content.length > size || !count(data.totalElements) || !count(data.totalPages)
    || data.page !== page || data.size !== size || data.totalPages !== Math.ceil(data.totalElements / size)
    || data.hasNext !== (page + 1 < data.totalPages) || data.hasPrevious !== (page > 0)
    || !data.content.every(blog => record(blog) && validHandle(blog.handle)
      && typeof blog.nickname === "string" && blog.nickname.trim().length > 0
      && typeof blog.blogName === "string" && blog.blogName.trim().length > 0
      && (blog.profileImageUrl === null || typeof blog.profileImageUrl === "string"))) {
    throw new GuestApiError("response");
  }
  return { content: data.content as BlogSearchResult[], page, size, totalElements: data.totalElements, totalPages: data.totalPages,
    hasNext: data.hasNext, hasPrevious: data.hasPrevious };
}

export async function searchPublicBlogs(q: string, page: number, baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL,
  request: typeof fetch = fetch): Promise<BlogSearchPage> {
  if (!q.trim() || Array.from(q).length > 200 || !Number.isSafeInteger(page) || page < 0 || parsePage(String(page)) !== page) {
    throw new GuestApiError("response");
  }
  const params = new URLSearchParams({ q: q.trim(), page: String(page), size: "20" });
  return parseBlogSearchPage(await guestJson("blogs", params, baseUrl, request), page);
}
