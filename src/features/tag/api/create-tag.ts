import { MemberApiError, responseData } from "../../../lib/member-api.ts";
import { validTagId } from "../../../lib/list-query.ts";

export type CreatedTag = { id: string; name: string; slug: string; displayOrder: number; status: "ACTIVE" };

export function normalizeTagName(input: string): string {
  if (typeof input !== "string") throw new MemberApiError(0, "VALIDATION_ERROR", "태그 이름을 입력해 주세요.");
  const name = input.normalize("NFKC").trim().replace(/^#/, "").toLowerCase();
  const points = Array.from(name);
  if (!name || points.length > 50 || !/^[\p{L}\p{N}\p{M}_+.\-]+$/u.test(name)) {
    throw new MemberApiError(0, "VALIDATION_ERROR", "태그는 공백 없이 문자·숫자·_-.+만 사용해 50자 이내로 입력해 주세요.");
  }
  return name;
}

export function parseCreatedTag(value: unknown): CreatedTag {
  const data = responseData(value);
  if (typeof data.id !== "string" || !validTagId(data.id) || typeof data.name !== "string" ||
      typeof data.slug !== "string" || !Number.isSafeInteger(data.displayOrder) || typeof data.displayOrder !== "number" || data.displayOrder < 0 || data.status !== "ACTIVE") {
    throw new MemberApiError(0, "INVALID_RESPONSE", "태그 생성 응답을 확인하지 못했습니다.");
  }
  return { id: data.id, name: data.name, slug: data.slug, displayOrder: data.displayOrder, status: "ACTIVE" };
}

export async function createTag(input: string, request: (path: string, options?: {method?: string; body?: unknown}) => Promise<unknown>): Promise<CreatedTag> {
  const name = normalizeTagName(input);
  return parseCreatedTag(await request("/tags", { method: "POST", body: { name } }));
}

export function splitTagInput(input: string): string[] {
  const parts = input.split(",").flatMap(part => {
    const matches = [...part.matchAll(/(?:^|\s)#([^\s,]+)/g)];
    return matches.length > 1 || (matches.length === 1 && part.trim().startsWith("#"))
      ? matches.map(match => match[1]!)
      : [part.trim()];
  }).map(part => part.trim()).filter(Boolean);
  return parts;
}
