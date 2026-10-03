const PAGE_SIZE = 20;
const MAX_PAGE = Math.floor(2147483647 / PAGE_SIZE);
// URL에서도 API와 같은 0부터 시작하는 페이지 번호를 사용한다.
export function parsePage(value: string | string[] | undefined): number | null {
  if (value === undefined) return 0;
  if (typeof value !== "string" || !/^(0|[1-9]\d*)$/.test(value)) return null;
  const page = Number(value);
  return Number.isSafeInteger(page) && page <= MAX_PAGE ? page : null;
}
export type ListFilters = { q?: string; tagId?: string };
export type ListQuery = ListFilters & { page: number };
export const validTagId = (value: string) => /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n;
const validQuery = (value: string) => Array.from(value).length <= 200 && !Array.from(value).some(c => {
  const code = c.codePointAt(0)!;
  return code === 0 || (code >= 0xd800 && code <= 0xdfff);
});
export function parseListQuery(params: Record<string, string | string[] | undefined>): ListQuery | null {
  if (Object.keys(params).some(key => !["page", "q", "tagId"].includes(key))) return null;
  const page = parsePage(params.page);
  if (page === null || Array.isArray(params.q) || Array.isArray(params.tagId)) return null;
  const q = params.q?.trim() || undefined;
  const tagId = params.tagId || undefined;
  if ((q && !validQuery(q)) || (tagId && !validTagId(tagId))) return null;
  return { page, q, tagId };
}
