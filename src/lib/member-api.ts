import {isIsoInstant} from "./date-time.ts";

export class MemberApiError extends Error {
  readonly status: number; readonly code: string;
  readonly withdrawalScheduledAt?: string;
  constructor(status: number, code: string, message: string, withdrawalScheduledAt?: string) { super(message); this.status=status;this.code=code;this.withdrawalScheduledAt=withdrawalScheduledAt;this.name = "MemberApiError"; }
}
function withdrawalScheduledAt(details: unknown, code: string): string | undefined {
  if (code !== "WITHDRAWAL_PENDING" || !Array.isArray(details) || details.length !== 1) return undefined;
  const detail = details[0];
  if (typeof detail !== "object" || detail === null || !("field" in detail) || !("reason" in detail)) return undefined;
  return detail.field === "withdrawalScheduledAt" && isIsoInstant(detail.reason) ? detail.reason : undefined;
}
export function apiUrl(path: string, base = process.env.NEXT_PUBLIC_API_BASE_URL): URL {
  try {
    if (!base || !path.startsWith("/")) throw new Error();
    const url = new URL(base);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error();
    const parsed = new URL(path, "https://member.invalid");
    if (parsed.origin !== "https://member.invalid") throw new Error();
    url.pathname = url.pathname.replace(/\/$/, "") + parsed.pathname;
    url.search = parsed.search;
    return url;
  } catch { throw new MemberApiError(0, "CONFIGURATION", "API 연결 설정을 확인해 주세요."); }
}
export async function memberJson(path: string, options: { method?: string; body?: unknown; token?: string; cookies?: boolean } = {}, request: typeof fetch = fetch, base?: string): Promise<unknown> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  const multipart = typeof FormData !== "undefined" && options.body instanceof FormData;
  if (options.body !== undefined && !multipart) headers["Content-Type"] = "application/json";
  let response: Response;
  const url = apiUrl(path, base);
  try { response = await request(url, { method: options.method ?? "GET", headers, body: multipart ? options.body as FormData : options.body === undefined ? undefined : JSON.stringify(options.body), credentials: options.cookies ? "include" : "omit", cache: "no-store", signal: AbortSignal.timeout(15000) }); }
  catch { throw new MemberApiError(0, "NETWORK", "서버 응답을 확인하지 못했습니다. 저장 요청이었다면 내 글에서 저장 여부를 확인해 주세요."); }
  if (response.status === 204) return null;
  let value: unknown;
  try { value = await response.json(); } catch { throw new MemberApiError(response.status, "INVALID_RESPONSE", "서버 응답을 읽지 못했습니다."); }
  if (!response.ok) {
    const error = typeof value === "object" && value !== null && "error" in value ? (value as {error?: {code?:unknown;message?:unknown;details?:unknown}}).error : undefined;
    const code = typeof error?.code === "string" ? error.code : "RESPONSE";
    throw new MemberApiError(response.status, code, typeof error?.message === "string" ? error.message : "요청을 처리하지 못했습니다.", withdrawalScheduledAt(error?.details, code));
  }
  return value;
}
export function responseData(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || !("data" in value) || typeof value.data !== "object" || value.data === null || Array.isArray(value.data)) throw new MemberApiError(0, "INVALID_RESPONSE", "서버 응답 형식을 확인해 주세요.");
  return value.data as Record<string, unknown>;
}
