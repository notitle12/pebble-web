export const PAGE_SIZE = 20;
const MAX_PAGE = Math.floor(2147483647 / PAGE_SIZE);

export type PostSummary = {
  id: string;
  title: string;
  summary: string | null;
  author: { id: string; nickname: string; blogName: string | null };
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
  readonly kind: "configuration" | "network" | "response";
  constructor(kind: "configuration" | "network" | "response") {
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
export function pageHref(page: number): string {
  return page === 0 ? "/" : `/?page=${page}`;
}
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const id = (value: unknown): value is string => typeof value === "string" && /^[1-9]\d*$/.test(value);
const nullableText = (value: unknown): value is string | null => value === null || typeof value === "string";
const timestamp = (value: unknown): value is string =>
  typeof value === "string" && Number.isFinite(Date.parse(value));
const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
function isPost(value: unknown): value is PostSummary {
  if (!record(value) || !record(value.author)) return false;
  return id(value.id) && typeof value.title === "string" && nullableText(value.summary)
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
): Promise<PostPage> {
  if (parsePage(String(page)) === null) throw new PostListError("response");
  let url: URL;
  try {
    if (!baseUrl) throw new Error();
    url = new URL(baseUrl);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error();
    url.pathname = `${url.pathname.replace(/\/$/, "")}/posts`;
    url.searchParams.set("page", String(page));
    url.searchParams.set("size", String(PAGE_SIZE));
  } catch { throw new PostListError("configuration"); }
  let response: Response;
  try {
    response = await request(url, {
      cache: "no-store", credentials: "omit", headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
  } catch { throw new PostListError("network"); }
  if (!response.ok) throw new PostListError("response");
  try { return parsePostPage(await response.json(), page); }
  catch { throw new PostListError("response"); }
}
