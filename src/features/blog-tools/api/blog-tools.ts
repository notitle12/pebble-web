import { GuestApiError, guestJson } from "../../../lib/public-api.ts";
import { validTagId } from "../../../lib/list-query.ts";

export type BlogVisits = { totalVisitors: number; todayVisitors: number; date: string; timeZone: "Asia/Seoul" };
export type BlogSiteLink = { id: string; label: string; url: string; logoUrl: string | null };
export type BlogLinks = { githubUrl: string | null; sites: BlogSiteLink[] };
export type BlogLinkDraft = { id?: string; label: string; url: string };

const validHandle = (handle: string) => /^[a-z][a-z0-9_-]{1,28}[a-z0-9_]$/.test(handle);
function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new GuestApiError("response");
  return value as Record<string, unknown>;
}
function validExternalUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password && Boolean(url.hostname) && !url.port; }
  catch { return false; }
}
function validGithubUrl(value: unknown): value is string {
  if (!validExternalUrl(value)) return false;
  const url = new URL(value);
  return url.hostname === "github.com" && url.pathname.split("/").filter(Boolean).length > 0;
}
function validSiteLabel(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  const chars = Array.from(value);
  return chars.length <= 50 && chars.every(char => !/\p{Cc}/u.test(char) && !(char.codePointAt(0)! >= 0xd800 && char.codePointAt(0)! <= 0xdfff));
}

export function parseBlogVisits(value: unknown): BlogVisits {
  const data = record(record(value).data);
  const dateParts = typeof data.date === "string" && /^(\d{4})-(\d{2})-(\d{2})$/.exec(data.date);
  let validDate = false;
  if (dateParts) {
    const year = Number(dateParts[1]), month = Number(dateParts[2]), day = Number(dateParts[3]);
    const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    validDate = year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= (days[month - 1] ?? 0);
  }
  if (!Number.isSafeInteger(data.totalVisitors) || (data.totalVisitors as number) < 0
    || !Number.isSafeInteger(data.todayVisitors) || (data.todayVisitors as number) < 0
    || (data.todayVisitors as number) > (data.totalVisitors as number) || !validDate
    || data.timeZone !== "Asia/Seoul") throw new GuestApiError("response");
  return { totalVisitors: data.totalVisitors as number, todayVisitors: data.todayVisitors as number, date: data.date as string, timeZone: "Asia/Seoul" };
}

export function parseBlogLinks(value: unknown): BlogLinks {
  const data = record(record(value).data);
  if (!(data.githubUrl === null || validGithubUrl(data.githubUrl)) || !Array.isArray(data.sites) || data.sites.length > 5) throw new GuestApiError("response");
  const ids = new Set<string>();
  const sites = data.sites.map(item => {
    const site = record(item);
    if (typeof site.id !== "string" || !validTagId(site.id) || ids.has(site.id)
      || !validSiteLabel(site.label)
      || !validExternalUrl(site.url) || !(site.logoUrl === null || validExternalUrl(site.logoUrl))) throw new GuestApiError("response");
    ids.add(site.id);
    return { id: site.id, label: site.label, url: site.url as string, logoUrl: site.logoUrl as string | null };
  });
  return { githubUrl: data.githubUrl as string | null, sites };
}

export function validateBlogLinkDraft(githubUrl: string, sites: BlogLinkDraft[]): string | null {
  const github = githubUrl.trim();
  if (github && !validGithubUrl(github)) return "GitHub 주소는 https://github.com/계정 형식으로 입력해 주세요.";
  if (sites.length > 5) return "사이트 링크는 최대 5개까지 등록할 수 있어요.";
  for (const site of sites) {
    if (!validSiteLabel(site.label)) return "사이트 이름은 1~50자이며 제어 문자를 포함할 수 없어요.";
    if (!validExternalUrl(site.url.trim())) return "사이트 주소는 HTTPS 주소로 입력해 주세요.";
  }
  return null;
}

export async function getBlogVisits(handle: string, baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL, request: typeof fetch = fetch): Promise<BlogVisits> {
  if (!validHandle(handle)) throw new GuestApiError("response");
  return parseBlogVisits(await guestJson(`blogs/${encodeURIComponent(handle)}/visits`, new URLSearchParams(), baseUrl, request));
}

export async function recordBlogVisit(handle: string, baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL, request: typeof fetch = fetch): Promise<BlogVisits> {
  if (!validHandle(handle)) throw new GuestApiError("response");
  let url: URL;
  try {
    if (!baseUrl) throw new Error();
    url = new URL(baseUrl);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error();
    url.pathname = `${url.pathname.replace(/\/$/, "")}/blogs/${encodeURIComponent(handle)}/visits`;
  } catch { throw new GuestApiError("configuration"); }
  let response: Response;
  try { response = await request(url, { method: "POST", cache: "no-store", credentials: "include", headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) }); }
  catch { throw new GuestApiError("network"); }
  if (response.status === 404) throw new GuestApiError("not-found");
  if (!response.ok) throw new GuestApiError("response");
  try { return parseBlogVisits(await response.json()); } catch (error) { if (error instanceof GuestApiError) throw error; throw new GuestApiError("response"); }
}

export async function getPublicBlogLinks(handle: string, baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL, request: typeof fetch = fetch): Promise<BlogLinks> {
  if (!validHandle(handle)) throw new GuestApiError("response");
  return parseBlogLinks(await guestJson(`blogs/${encodeURIComponent(handle)}/links`, new URLSearchParams(), baseUrl, request));
}
