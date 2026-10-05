import { parseListQuery } from "../../lib/list-query.ts";

export type SearchType = "all" | "posts" | "projects";
export type SearchQuery = { q?: string; page: number; type: SearchType };

export function parseSearchQuery(
  params: Record<string, string | string[] | undefined>,
): SearchQuery | null {
  if (Object.keys(params).some(key => !["q", "page", "type"].includes(key))) return null;
  if (Array.isArray(params.type)) return null;
  const type = params.type ?? "all";
  if (type !== "all" && type !== "posts" && type !== "projects") return null;
  const { type: _type, ...listParams } = params;
  const parsed = parseListQuery(listParams);
  if (!parsed) return null;
  if (type === "all" && parsed.page > 0) return null;
  return { q: parsed.q, page: parsed.page, type };
}

export function searchHref(
  query: Pick<SearchQuery, "q" | "type"> & Partial<Pick<SearchQuery, "page">>,
  page = query.page ?? 0,
): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.type && query.type !== "all") params.set("type", query.type);
  if (page > 0) params.set("page", String(page));
  return params.size ? `/search?${params}` : "/search";
}
