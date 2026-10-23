import { MemberApiError, responseData } from "../../lib/member-api.ts";
export const INSIGHT_DAYS = [7, 30, 90, 0] as const;
export type InsightDays = typeof INSIGHT_DAYS[number];
export type InsightItem = { id: string; title: string; urlKey: string | null; views: number; visibilityStatus: "PUBLIC" | "HIDDEN"; isBlocked: boolean; draft: boolean };
export type InsightDay = { date: string; postViews: number; projectViews: number };
export type ContentInsights = { days: InsightDays; fromDate: string | null; toDate: string; timeZone: "Asia/Seoul"; trackingStartedAt: string; chartDays: number; postViews: number; projectViews: number; daily: InsightDay[]; posts: InsightItem[]; projects: InsightItem[] };
const invalid = (): never => { throw new MemberApiError(0, "INVALID_RESPONSE", "조회 통계를 확인하지 못했어요. 다시 불러와 주세요."); };
const record = (value: unknown): Record<string, unknown> => { if (!value || typeof value !== "object" || Array.isArray(value)) invalid(); return value as Record<string, unknown>; };
const count = (value: unknown): number => { if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) invalid(); return value as number; };
function date(value: unknown): string { if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value + "T00:00:00Z")) || new Date(value + "T00:00:00Z").toISOString().slice(0, 10) !== value) invalid(); return value as string; }
export function parseInsightItems(value: unknown, allowZero = false): InsightItem[] {
  if (!Array.isArray(value) || value.length > 10) invalid();
  const seen = new Set<string>();
  return (value as unknown[]).map(value => {
    const d = record(value);
    if (typeof d.id !== "string" || !/^[1-9]\d*$/.test(d.id) || seen.has(d.id) || typeof d.title !== "string" || !(d.urlKey === null || typeof d.urlKey === "string") || !["PUBLIC", "HIDDEN"].includes(String(d.visibilityStatus)) || typeof d.isBlocked !== "boolean" || typeof d.draft !== "boolean") invalid();
    seen.add(d.id as string); const views = count(d.views); if (!allowZero && !views) invalid();
    return { id: d.id as string, title: d.title as string, urlKey: d.urlKey as string | null, views, visibilityStatus: d.visibilityStatus as "PUBLIC" | "HIDDEN", isBlocked: d.isBlocked as boolean, draft: d.draft as boolean };
  });
}
export function parseContentInsights(value: unknown, expectedDays: InsightDays): ContentInsights {
  const d = responseData(value), chartDays = expectedDays || 30;
  if (d.days !== expectedDays || d.chartDays !== chartDays || d.timeZone !== "Asia/Seoul" || typeof d.trackingStartedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(d.trackingStartedAt) || !Number.isFinite(Date.parse(d.trackingStartedAt)) || !Array.isArray(d.daily) || d.daily.length !== chartDays) invalid();
  const toDate = date(d.toDate), fromDate = d.fromDate === null ? null : date(d.fromDate);
  if (expectedDays === 0 ? fromDate !== null : fromDate !== new Date(Date.parse(toDate + "T00:00:00Z") - (expectedDays - 1) * 86400000).toISOString().slice(0, 10)) invalid();
  const daily = (d.daily as unknown[]).map((value, index) => {
    const row = record(value), day = date(row.date);
    if (day !== new Date(Date.parse(toDate + "T00:00:00Z") - (chartDays - index - 1) * 86400000).toISOString().slice(0, 10)) invalid();
    return { date: day, postViews: count(row.postViews), projectViews: count(row.projectViews) };
  });
  return { days: expectedDays, fromDate, toDate, timeZone: "Asia/Seoul", trackingStartedAt: d.trackingStartedAt as string, chartDays, postViews: count(d.postViews), projectViews: count(d.projectViews), daily, posts: parseInsightItems(d.posts), projects: parseInsightItems(d.projects) };
}
export async function getContentInsights(days: InsightDays, request: (path: string) => Promise<unknown>): Promise<ContentInsights> {
  if (!(INSIGHT_DAYS as readonly number[]).includes(days)) throw new MemberApiError(0, "INVALID_QUERY", "조회 기간을 확인해 주세요.");
  return parseContentInsights(await request(`/members/me/content-insights?days=${days}`), days);
}
export function insightHref(kind: "posts" | "projects", item: InsightItem, handle: string | null): string {
  const publicItem = item.visibilityStatus === "PUBLIC" && !item.isBlocked && !item.draft;
  if (kind === "projects") return `/projects/${item.id}${publicItem ? "" : "/view"}`;
  const key = item.urlKey ?? item.id;
  if (publicItem && handle && /^[a-z][a-z0-9_-]{1,28}[a-z0-9_]$/.test(handle) && (/^[1-9]\d*$/.test(key) || key.length <= 200 && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(key) && key !== "search")) return `/blogs/${encodeURIComponent(handle)}/posts/${encodeURIComponent(key)}`;
  return `/posts/${item.id}/view`;
}
export function insightPoints(daily: InsightDay[], kind: "postViews" | "projectViews"): string {
  const maximum = Math.max(1, ...daily.flatMap(day => [day.postViews, day.projectViews]));
  return daily.map((day, index) => `${(16 + index * 688 / Math.max(1, daily.length - 1)).toFixed(2)},${(140 - day[kind] * 116 / maximum).toFixed(2)}`).join(" ");
}

export const CONTENT_KINDS = ["posts", "projects"] as const;
export type ContentKind = typeof CONTENT_KINDS[number];
export const CONTENT_SOURCES = ["UNKNOWN", "DIRECT", "INTERNAL", "GOOGLE", "NAVER", "BING", "DAUM", "GITHUB", "KAKAO", "OTHER"] as const;
export type ContentSource = typeof CONTENT_SOURCES[number];
export const INSIGHT_SORTS = ["LATEST", "VIEWS", "POPULAR"] as const;
export type InsightSort = typeof INSIGHT_SORTS[number];
export type InsightDirection = "ASC" | "DESC";
export type InsightItemsPage = { kind: ContentKind; page: number; size: 10; totalElements: number; totalPages: number; items: InsightItem[]; sort: InsightSort; direction: InsightDirection; likeCounts: Record<string, number> };
export type ContentInsightDetail = { kind: ContentKind; days: InsightDays; item: InsightItem; totalViews: number; fromDate: string | null; toDate: string; timeZone: "Asia/Seoul"; trackingStartedAt: string; sourceTrackingStartedAt: string; sourceDays: 7; sourceFromDate: string; monthlyCoverageFrom: string; chartDays: number; daily: { date: string; views: number }[]; monthly: { month: string; views: number }[]; sources: { source: ContentSource; views: number }[] };
const validKind = (value: unknown): value is ContentKind => value === "posts" || value === "projects";
const timestamp = (value: unknown): string => { if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) invalid(); return value as string; };
export function insightDetailHref(kind: ContentKind, id: string): string { return `/settings/blog/insights/${kind}/${id}`; }
export function parseInsightItemsPage(value: unknown, kind: ContentKind, page: number, sort: InsightSort = "LATEST", direction: InsightDirection = "DESC"): InsightItemsPage {
  const d = responseData(value), totalElements = count(d.totalElements), totalPages = count(d.totalPages);
  if (d.kind !== kind || d.page !== page || d.size !== 10 || totalPages !== Math.ceil(totalElements / 10)) invalid();
  const rows = parseInsightItems(d.items, true);
  if (rows.length !== Math.max(0, Math.min(10, totalElements - page * 10))) invalid();
  if (d.sort !== sort || d.direction !== direction) invalid();
  const rawCounts = record(d.likeCounts), likeCounts: Record<string, number> = {};
  const keys = Object.keys(rawCounts);
  if (sort === "POPULAR" ? keys.length !== rows.length || keys.some(id => !rows.some(row => row.id === id)) : keys.length !== 0) invalid();
  for (const id of keys) likeCounts[id] = count(rawCounts[id]);
  return { kind, page, size: 10, totalElements, totalPages, items: rows, sort, direction, likeCounts };
}
export async function getInsightItems(kind: ContentKind, page: number, query: string, request: (path: string) => Promise<unknown>, options: { sort?: InsightSort; direction?: InsightDirection } = {}): Promise<InsightItemsPage> {
  const sort = options.sort ?? "LATEST", direction = options.direction ?? "DESC";
  if (!validKind(kind) || !Number.isInteger(page) || page < 0 || page > 10000 || query.length > 100 || !(INSIGHT_SORTS as readonly string[]).includes(sort) || !["ASC", "DESC"].includes(direction)) throw new MemberApiError(0, "INVALID_QUERY", "콘텐츠 검색 조건을 확인해 주세요.");
  return parseInsightItemsPage(await request(`/members/me/content-insights/items?kind=${kind}&page=${page}&query=${encodeURIComponent(query)}&sort=${sort}&direction=${direction}`), kind, page, sort, direction);
}

export function parseContentInsightDetail(value: unknown, kind: ContentKind, id: string, days: InsightDays): ContentInsightDetail {
  const d = responseData(value), chartDays = days || 90, toDate = date(d.toDate), fromDate = d.fromDate === null ? null : date(d.fromDate);
  if (d.kind !== kind || d.days !== days || d.chartDays !== chartDays || d.timeZone !== "Asia/Seoul" || !Array.isArray(d.daily) || d.daily.length !== chartDays || !Array.isArray(d.monthly) || d.monthly.length !== 12 || !Array.isArray(d.sources) || d.sources.length > CONTENT_SOURCES.length) invalid();
  if (days === 0 ? fromDate !== null : fromDate !== new Date(Date.parse(toDate + "T00:00:00Z") - (days - 1) * 86400000).toISOString().slice(0, 10)) invalid();
  const sourceFromDate = date(d.sourceFromDate);
  if (d.sourceDays !== 7 || sourceFromDate !== new Date(Date.parse(toDate + "T00:00:00Z") - 6 * 86400000).toISOString().slice(0, 10)) invalid();
  const item = parseInsightItems([d.item], true)[0]; if (item.id !== id) invalid();
  const daily = (d.daily as unknown[]).map((value, index) => { const row = record(value), day = date(row.date); if (day !== new Date(Date.parse(toDate + "T00:00:00Z") - (chartDays - index - 1) * 86400000).toISOString().slice(0, 10)) invalid(); return { date: day, views: count(row.views) }; });
  const [year, month] = toDate.split("-").map(Number);
  const monthly = (d.monthly as unknown[]).map((value, index) => { const row = record(value), expected = new Date(Date.UTC(year, month - 12 + index, 1)).toISOString().slice(0, 7); if (row.month !== expected) invalid(); return { month: expected, views: count(row.views) }; });
  const seen = new Set<string>();
  const sources = (d.sources as unknown[]).map(value => { const row = record(value), source = row.source; if (typeof source !== "string" || !(CONTENT_SOURCES as readonly string[]).includes(source) || seen.has(source)) invalid(); seen.add(source as string); const views = count(row.views); if (views === 0) invalid(); return { source: source as ContentSource, views }; });
  return { kind, days, item, totalViews: count(d.totalViews), fromDate, toDate, timeZone: "Asia/Seoul", trackingStartedAt: timestamp(d.trackingStartedAt), sourceTrackingStartedAt: timestamp(d.sourceTrackingStartedAt), sourceDays: 7, sourceFromDate, monthlyCoverageFrom: date(d.monthlyCoverageFrom), chartDays, daily, monthly, sources };
}
export async function getContentInsightDetail(kind: ContentKind, id: string, days: InsightDays, request: (path: string) => Promise<unknown>): Promise<ContentInsightDetail> {
  if (!validKind(kind) || !/^[1-9]\d*$/.test(id) || !(INSIGHT_DAYS as readonly number[]).includes(days)) throw new MemberApiError(0, "INVALID_QUERY", "콘텐츠 조회 조건을 확인해 주세요.");
  return parseContentInsightDetail(await request(`/members/me/content-insights/${kind}/${id}?days=${days}`), kind, id, days);
}
export function singleInsightPoints(rows: { views: number }[]): string {
  const maximum = Math.max(1, ...rows.map(row => row.views));
  return rows.map((row, index) => `${(16 + index * 688 / Math.max(1, rows.length - 1)).toFixed(2)},${(140 - row.views * 116 / maximum).toFixed(2)}`).join(" ");
}
