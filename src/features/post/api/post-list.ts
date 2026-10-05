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
export { parsePage } from "../../../lib/list-query.ts";
export type PostFilters = ListFilters & { categoryId?: string };
export type PostQuery = PostFilters & { page: number };
import { parsePage, parseListQuery, validTagId, type ListFilters } from "../../../lib/list-query.ts";
export function parsePostQuery(params: Record<string,string|string[]|undefined>): PostQuery | null {
  const {categoryId,...rest}=params;
  const query=parseListQuery(rest);
  if(!query || Array.isArray(categoryId) || (categoryId && !validTagId(categoryId)))return null;
  return {...query,...(categoryId ? {categoryId} : {})};
}
export function pageHref(page: number, filters: PostFilters = {}): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.tagId) params.set("tagId", filters.tagId);
  if (filters.categoryId) params.set("categoryId", filters.categoryId);
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
  const query = parsePostQuery({ page: String(page), q: filters.q, tagId: filters.tagId, categoryId: filters.categoryId });
  if (!query) throw new PostListError("response");
  const params = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE) });
  if (query.q) params.set("q", query.q);
  if (query.tagId) params.set("tagId", query.tagId);
  if (query.categoryId) params.set("categoryId", query.categoryId);
  return parsePostPage(await guestJson(query.q ? "posts/search" : "posts", params, baseUrl, request), page);
}
export { getPublicTags, type PublicTag } from "../../tag/api/public-tags.ts";

const validHandle = (value: string) => /^[a-z][a-z0-9-]{1,28}[a-z0-9]$/.test(value);
const validPostKey = (value: string) => validTagId(value) || (value.length <= 200
  && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value) && !/^\d+$/.test(value) && value !== "search");
export function postHref(handle: string, key: string): string | null {
  return validHandle(handle) && validPostKey(key) ? `/blogs/${encodeURIComponent(handle)}/posts/${encodeURIComponent(key)}` : null;
}
export type TableColumn = {
  name: string;
  dataType: string;
  nullable: boolean;
  primaryKey: boolean;
  foreignKey?: string | null;
  description?: string | null;
};
export type TableSpec = { schemaVersion: 1; tableName: string; description?: string | null; columns: TableColumn[] };
export type ArchitectureGroup = { id: string; type: "ORACLE_CLOUD" | "AWS" | "CLOUDFLARE" | "DOCKER" | "CUSTOM"; label: string; parentId?: string | null; bounds?: { x: number; y: number; width: number; height: number } | null };
export type ArchitectureNode = { id: string; type: "CLIENT" | "APP" | "DATABASE" | "CACHE" | "STORAGE" | "PROXY" | "CUSTOM"; label: string; groupId?: string | null; icon?: string | null; position?: { x: number; y: number } | null };
export type ArchitectureSide = "TOP" | "RIGHT" | "BOTTOM" | "LEFT";
export type ArchitectureEdge = { id: string; source: string; target: string; label?: string | null; sourceSide?: ArchitectureSide | null; targetSide?: ArchitectureSide | null; waypoint?: {x:number;y:number} | null };
export type ArchitectureSpec = { schemaVersion: 1; groups: ArchitectureGroup[]; nodes: ArchitectureNode[]; edges: ArchitectureEdge[] };
export type PostBlock = { type: "TEXT" | "CODE" | "TABLE" | "ARCHITECTURE"; content: string; language: string | null; title: string | null; displayOrder: number };
export type PostDetail = PostSummary & { blocks: PostBlock[] };
const languages = ["JAVA", "JAVASCRIPT", "TYPESCRIPT", "PYTHON", "HTML", "CSS", "SQL", "JSON", "YAML", "MARKDOWN", "BASH", "SHELL"];
const keysAre = (value: Record<string, unknown>, allowed: string[]) => Object.keys(value).every(key => allowed.includes(key));
function safeString(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code === 0) return false;
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index++;
    } else if (code >= 0xdc00 && code <= 0xdfff) return false;
  }
  return true;
}
const pointLength = (value: string) => Array.from(value).length;
const textField = (value: unknown, max: number, required = false): value is string =>
  typeof value === "string" && safeString(value) && pointLength(value) <= max && (!required || (pointLength(value) > 0 && value.trim().length > 0));
const optionalTextField = (value: unknown, max: number) => value === undefined || value === null || textField(value, max);
export function parseTableSpec(value: unknown): TableSpec {
  if (!record(value) || !keysAre(value, ["schemaVersion", "tableName", "description", "columns"])
    || value.schemaVersion !== 1 || !textField(value.tableName, 100, true)
    || !optionalTextField(value.description, 500) || !Array.isArray(value.columns)
    || value.columns.length < 1 || value.columns.length > 50) throw new PostListError("response");
  const names = new Set<string>();
  for (const column of value.columns) {
    if (!record(column) || !keysAre(column, ["name", "dataType", "nullable", "primaryKey", "foreignKey", "description"])
      || !textField(column.name, 100, true) || !textField(column.dataType, 100, true)
      || typeof column.nullable !== "boolean" || typeof column.primaryKey !== "boolean"
      || (column.primaryKey && column.nullable)
      || !optionalTextField(column.foreignKey, 200) || !optionalTextField(column.description, 500)) throw new PostListError("response");
    const normalizedName = column.name.trim().toLowerCase();
    if (names.has(normalizedName)) throw new PostListError("response");
    names.add(normalizedName);
  }
  return value as TableSpec;
}
const architectureId = (value: unknown): value is string => typeof value === "string" && /^[a-z][a-z0-9-]{0,39}$/.test(value);
const javaBlank = (value: string) => Array.from(value).length === 0 || Array.from(value).every(char => {
  const code = char.codePointAt(0)!;
  return (code >= 0x0009 && code <= 0x000d) || (code >= 0x001c && code <= 0x0020) || code === 0x1680
    || (code >= 0x2000 && code <= 0x2006) || (code >= 0x2008 && code <= 0x200a) || code === 0x2028 || code === 0x2029 || code === 0x205f || code === 0x3000;
});
const architectureLabel = (value: unknown) => typeof value === "string" && safeString(value) && pointLength(value) >= 1 && pointLength(value) <= 100 && !javaBlank(value);
export function parseArchitectureSpec(value: unknown): ArchitectureSpec {
  const groupTypes = ["ORACLE_CLOUD", "AWS", "CLOUDFLARE", "DOCKER", "CUSTOM"];
  const nodeTypes = ["CLIENT", "APP", "DATABASE", "CACHE", "STORAGE", "PROXY", "CUSTOM"];
  const architectureIcons = ["AWS", "ORACLE_CLOUD", "CLOUDFLARE", "DOCKER", "SPRING", "POSTGRESQL", "REDIS", "R2", "WORKERS", "NGINX", "NODEJS", "REACT", "SERVER", "DATABASE", "CACHE", "STORAGE", "CLIENT", "CLOUD", "CONTAINER"];
  if (!record(value) || !keysAre(value, ["schemaVersion", "groups", "nodes", "edges"]) || value.schemaVersion !== 1
    || !Array.isArray(value.groups) || value.groups.length > 10 || !Array.isArray(value.nodes) || value.nodes.length < 1 || value.nodes.length > 30
    || !Array.isArray(value.edges) || value.edges.length > 60) throw new PostListError("response");
  const ids = new Set<string>();
  const addId = (id: unknown) => { if (!architectureId(id) || ids.has(id)) throw new PostListError("response"); ids.add(id); };
  const groups = new Map<string, ArchitectureGroup>();
  for (const item of value.groups) {
    if (!record(item) || !keysAre(item, ["id", "type", "label", "parentId", "bounds"]) || typeof item.type !== "string" || !groupTypes.includes(item.type) || !architectureLabel(item.label)
      || !(item.parentId === undefined || item.parentId === null || architectureId(item.parentId))) throw new PostListError("response");
    if (item.bounds != null) {
      const b = item.bounds;
      if (!record(b) || !keysAre(b, ["x", "y", "width", "height"]) || ![b.x,b.y,b.width,b.height].every(Number.isInteger)
        || (b.x as number) < 0 || (b.x as number) > 4000 || (b.y as number) < 0 || (b.y as number) > 4000
        || (b.width as number) < 200 || (b.height as number) < 120 || (b.x as number)+(b.width as number)>4200 || (b.y as number)+(b.height as number)>4200) throw new PostListError("response");
    }
    addId(item.id); groups.set(item.id as string, item as ArchitectureGroup);
  }
  for (const group of groups.values()) {
    if (group.parentId != null) {
      const parent = groups.get(group.parentId);
      if (group.type !== "DOCKER" || !parent || parent.type === "DOCKER" || parent.parentId != null) throw new PostListError("response");
    }
  }
  const nodes = new Set<string>();
  for (const item of value.nodes) {
    if (!record(item) || !keysAre(item, ["id", "type", "label", "groupId", "icon", "position"]) || typeof item.type !== "string" || !nodeTypes.includes(item.type) || !architectureLabel(item.label)
      || !(item.groupId === undefined || item.groupId === null || architectureId(item.groupId))
      || !(item.icon === undefined || item.icon === null || (typeof item.icon === "string" && architectureIcons.includes(item.icon)))
      || !(item.position === undefined || item.position === null || (record(item.position) && keysAre(item.position, ["x", "y"]) && Number.isInteger(item.position.x) && Number.isInteger(item.position.y) && (item.position.x as number) >= 0 && (item.position.x as number) <= 4000 && (item.position.y as number) >= 0 && (item.position.y as number) <= 4000))) throw new PostListError("response");
    addId(item.id); nodes.add(item.id as string);
    if (item.groupId != null && !groups.has(item.groupId as string)) throw new PostListError("response");
  }
  const pairs = new Set<string>();
  for (const item of value.edges) {
    if (!record(item) || !keysAre(item, ["id", "source", "target", "label", "sourceSide", "targetSide", "waypoint"]) || !architectureId(item.source) || !architectureId(item.target)
      || item.source === item.target || !(item.label === undefined || item.label === null || textField(item.label, 200))) throw new PostListError("response");
    for (const side of [item.sourceSide,item.targetSide]) if (side != null && (typeof side !== "string" || !["TOP","RIGHT","BOTTOM","LEFT"].includes(side))) throw new PostListError("response");
    if (item.waypoint != null) {
      const point = item.waypoint;
      if (!record(point) || !keysAre(point,["x","y"]) || !Number.isInteger(point.x) || !Number.isInteger(point.y) || (point.x as number)<0 || (point.y as number)<0 || (point.x as number)>4200 || (point.y as number)>4200) throw new PostListError("response");
    }
    addId(item.id);
    const pair = `${item.source}\u0000${item.target}`;
    if (!(nodes.has(item.source) || groups.has(item.source)) || !(nodes.has(item.target) || groups.has(item.target)) || pairs.has(pair)) throw new PostListError("response");
    pairs.add(pair);
  }
  return value as ArchitectureSpec;
}
export function parsePostDetail(value: unknown): PostDetail {
  if (!record(value) || !isPost(value.data) || !record(value.data)) throw new PostListError("response");
  const data = value.data;
  if (!Array.isArray(data.blocks) || !data.blocks.every(block => record(block)
    && ["TEXT", "CODE", "TABLE", "ARCHITECTURE"].includes(String(block.type)) && typeof block.content === "string"
    && nullableText(block.title) && count(block.displayOrder)
    && (block.type === "TEXT" ? block.language === null : block.type === "CODE" ? typeof block.language === "string" && languages.includes(block.language)
      : block.language === null && textField(block.title ?? "", 100) && pointLength(block.content) <= 50000 && (() => {
        try { const parsed = JSON.parse(block.content); block.type === "TABLE" ? parseTableSpec(parsed) : parseArchitectureSpec(parsed); return true; } catch { return false; }
      })()))) throw new PostListError("response");
  return { ...data, blocks: data.blocks } as PostDetail;
}
export async function getPublicPost(handle: string, key: string, baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL, request: typeof fetch = fetch): Promise<PostDetail> {
  const href = postHref(handle, key);
  if (!href) throw new PostListError("not-found");
  const post = parsePostDetail(await guestJson(href.slice(1), new URLSearchParams(), baseUrl, request));
  if (post.author.handle !== handle || post.urlKey !== key) throw new PostListError("response");
  return post;
}
