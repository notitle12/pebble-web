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
function items(value: unknown): InsightItem[] {
  if (!Array.isArray(value) || value.length > 10) invalid();
  const seen = new Set<string>();
  return (value as unknown[]).map(value => {
    const d = record(value);
    if (typeof d.id !== "string" || !/^[1-9]\d*$/.test(d.id) || seen.has(d.id) || typeof d.title !== "string" || !(d.urlKey === null || typeof d.urlKey === "string") || !["PUBLIC", "HIDDEN"].includes(String(d.visibilityStatus)) || typeof d.isBlocked !== "boolean" || typeof d.draft !== "boolean") invalid();
    seen.add(d.id as string); const views = count(d.views); if (!views) invalid();
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
  return { days: expectedDays, fromDate, toDate, timeZone: "Asia/Seoul", trackingStartedAt: d.trackingStartedAt as string, chartDays, postViews: count(d.postViews), projectViews: count(d.projectViews), daily, posts: items(d.posts), projects: items(d.projects) };
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
