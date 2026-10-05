export const PAGE_SIZE = 20;
const MAX_PAGE = Math.floor(2147483647 / PAGE_SIZE);

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
export class PostListError extends Error {
  readonly kind: "configuration" | "network" | "response" | "not-found";
  constructor(kind: "configuration" | "network" | "response" | "not-found") {
    super(kind);
    this.kind = kind;
    this.name = "PostListError";
  }
}

// URL에서도 API와 같은 0부터 시작하는 페이지 번호를 사용한다.
export function parsePage(value: string | string[] | undefined): number | null {
  if (value === undefined) return 0;
  if (typeof value !== "string" || !/^(0|[1-9]\d*)$/.test(value)) return null;
  const page = Number(value);
  return Number.isSafeInteger(page) && page <= MAX_PAGE ? page : null;
}
export type PostFilters = { q?: string; tagId?: string };
export type PostQuery = PostFilters & { page: number };
const validTagId = (value: string) => /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n;
const validQuery = (value: string) => Array.from(value).length <= 200 && !Array.from(value).some(c => {
  const code = c.codePointAt(0)!;
  return code === 0 || (code >= 0xd800 && code <= 0xdfff);
});
export function parsePostQuery(params: Record<string, string | string[] | undefined>): PostQuery | null {
  if (Object.keys(params).some(key => !["page", "q", "tagId"].includes(key))) return null;
  const page = parsePage(params.page);
  if (page === null || Array.isArray(params.q) || Array.isArray(params.tagId)) return null;
  const q = params.q?.trim() || undefined;
  const tagId = params.tagId || undefined;
  if ((q && !validQuery(q)) || (tagId && !validTagId(tagId))) return null;
  return { page, q, tagId };
}
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
async function guestJson(path: string, params: URLSearchParams, baseUrl: string | undefined, request: typeof fetch): Promise<unknown> {
  let url: URL;
  try {
    if (!baseUrl) throw new Error();
    url = new URL(baseUrl);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error();
    url.pathname = `${url.pathname.replace(/\/$/, "")}/${path}`;
    url.search = params.toString();
  } catch { throw new PostListError("configuration"); }
  let response: Response;
  try {
    response = await request(url, {
      cache: "no-store", credentials: "omit", headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
  } catch { throw new PostListError("network"); }
  if (response.status === 404) throw new PostListError("not-found");
  if (!response.ok) throw new PostListError("response");
  try { return await response.json(); } catch { throw new PostListError("response"); }
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
export type PublicTag = { id: string; name: string };
export async function getPublicTags(baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL, request: typeof fetch = fetch): Promise<PublicTag[]> {
  const value = await guestJson("tags", new URLSearchParams(), baseUrl, request);
  if (!record(value) || !Array.isArray(value.data) || !value.data.every(tag => record(tag)
    && typeof tag.id === "string" && validTagId(tag.id) && typeof tag.name === "string")) throw new PostListError("response");
  const tags: PublicTag[] = value.data.map(tag => ({ id: tag.id, name: tag.name }));
  if (new Set(tags.map(tag => tag.id)).size !== tags.length) throw new PostListError("response");
  return tags;
}

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
