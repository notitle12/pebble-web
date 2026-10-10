import { GuestApiError, guestJson } from "../../../lib/public-api.ts";
import { MemberApiError, responseData } from "../../../lib/member-api.ts";
import { validTagId } from "../../../lib/list-query.ts";

export const HOME_SECTION_KEYS = ["ACTIVITY", "TECH_STACKS", "PROJECTS", "RECENT_POSTS"] as const;
export type HomeSectionKey = typeof HOME_SECTION_KEYS[number];
export type HomeSection = { key: HomeSectionKey; visible: boolean };
export type BlogHomeSettings = { sections: HomeSection[]; techStacks: string[]; featuredProjectIds: string[] };
export type BlogActivity = { from: string; to: string; timeZone: "Asia/Seoul"; days: { date: string; count: number }[] };
export type PublicBlogHome = BlogHomeSettings & { activity: BlogActivity };

const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const validDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
export const defaultBlogHomeSettings = (): BlogHomeSettings => ({
  sections: HOME_SECTION_KEYS.map(key => ({ key, visible: true })), techStacks: [], featuredProjectIds: [],
});

export function visibleHomeDataLoads(settings: BlogHomeSettings) {
  return {
    recentPosts: settings.sections.some(section => section.key === "RECENT_POSTS" && section.visible),
    featuredProjects: settings.sections.some(section => section.key === "PROJECTS" && section.visible) && settings.featuredProjectIds.length > 0,
  };
}

export function parseBlogHomeSettings(value: unknown): BlogHomeSettings {
  const data = record(value) && "data" in value ? value.data : value;
  if (!record(data) || !Array.isArray(data.sections) || data.sections.length !== HOME_SECTION_KEYS.length
    || !Array.isArray(data.techStacks) || data.techStacks.length > 20 || !Array.isArray(data.featuredProjectIds) || data.featuredProjectIds.length > 6) throw new GuestApiError("response");
  const keys = new Set<string>();
  const sections = data.sections.map(item => {
    if (!record(item) || typeof item.key !== "string" || !HOME_SECTION_KEYS.includes(item.key as HomeSectionKey) || keys.has(item.key) || typeof item.visible !== "boolean") throw new GuestApiError("response");
    keys.add(item.key);
    return { key: item.key as HomeSectionKey, visible: item.visible };
  });
  if (keys.size !== HOME_SECTION_KEYS.length) throw new GuestApiError("response");
  const stacks = data.techStacks.map(item => {
    if (typeof item !== "string" || !item || item !== item.normalize("NFKC").trim() || Array.from(item).length > 50 || /[\p{Cc}\p{Cs}]/u.test(item)) throw new GuestApiError("response");
    return item;
  });
  if (new Set(stacks.map(item => item.normalize("NFKC").toLocaleLowerCase("und"))).size !== stacks.length) throw new GuestApiError("response");
  const ids = data.featuredProjectIds;
  if (!ids.every(id => typeof id === "string" && validTagId(id)) || new Set(ids).size !== ids.length) throw new GuestApiError("response");
  return { sections, techStacks: stacks, featuredProjectIds: ids as string[] };
}

export function normalizeTechStacks(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values) {
    const value = raw.normalize("NFKC").trim();
    if (!value || Array.from(value).length > 50 || /[\p{Cc}\p{Cs}]/u.test(value)) continue;
    const normalized = value.normalize("NFKC").toLocaleLowerCase("und");
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(value);
    if (result.length === 20) break;
  }
  return result;
}

export function parsePublicBlogHome(value: unknown): PublicBlogHome {
  if (!record(value) || !record(value.data)) throw new GuestApiError("response");
  const settings = parseBlogHomeSettings(value.data);
  const activity = value.data.activity;
  if (!record(activity) || !validDate(activity.from) || !validDate(activity.to) || activity.timeZone !== "Asia/Seoul" || !Array.isArray(activity.days) || activity.days.length > 366) throw new GuestApiError("response");
  const rangeDays = (Date.parse(`${activity.to}T00:00:00Z`) - Date.parse(`${activity.from}T00:00:00Z`)) / 86_400_000 + 1;
  if (rangeDays < 1 || rangeDays > 366) throw new GuestApiError("response");
  let previous = "";
  const days = activity.days.map(item => {
    if (!record(item) || !validDate(item.date) || item.date < activity.from! || item.date > activity.to! || item.date <= previous || !Number.isSafeInteger(item.count) || (item.count as number) < 0) throw new GuestApiError("response");
    previous = item.date;
    return { date: item.date, count: item.count as number };
  });
  if (activity.from > activity.to) throw new GuestApiError("response");
  return { ...settings, activity: { from: activity.from, to: activity.to, timeZone: "Asia/Seoul", days } };
}

export async function getPublicBlogHome(handle: string, baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL, request: typeof fetch = fetch): Promise<PublicBlogHome> {
  if (!/^[a-z][a-z0-9_-]{1,28}[a-z0-9_]$/.test(handle)) throw new GuestApiError("response");
  return parsePublicBlogHome(await guestJson(`blogs/${encodeURIComponent(handle)}/home`, new URLSearchParams(), baseUrl, request));
}

export async function getMyBlogHome(request: (path: string) => Promise<unknown>): Promise<BlogHomeSettings> {
  try { return parseBlogHomeSettings(await request("/members/me/blog-home")); }
  catch (error) { if (error instanceof GuestApiError) throw new MemberApiError(0, "INVALID_RESPONSE", "홈 구성 응답을 확인하지 못했습니다."); throw error; }
}

export async function saveMyBlogHome(settings: BlogHomeSettings, request: (path: string, options: { method: string; body: unknown }) => Promise<unknown>): Promise<BlogHomeSettings> {
  const payload = { sections: settings.sections, techStacks: normalizeTechStacks(settings.techStacks), featuredProjectIds: settings.featuredProjectIds };
  try { return parseBlogHomeSettings(await request("/members/me/blog-home", { method: "PUT", body: payload })); }
  catch (error) { if (error instanceof GuestApiError) throw new MemberApiError(0, "INVALID_RESPONSE", "저장 결과를 확인하지 못했습니다."); throw error; }
}
