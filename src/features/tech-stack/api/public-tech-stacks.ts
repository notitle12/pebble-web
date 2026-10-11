import { guestJson, GuestApiError as PostListError } from "../../../lib/public-api.ts";
import { validId } from "../../../lib/list-query.ts";
const record = (value: unknown): value is Record<string,unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
export type PublicTechStack = { id: string; name: string; status: "ACTIVE" | "INACTIVE" };
export async function getPublicTechStacks(baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL, request: typeof fetch = fetch): Promise<PublicTechStack[]> {
  const value = await guestJson("tech-stacks", new URLSearchParams(), baseUrl, request);
  if (!record(value) || !Array.isArray(value.data) || !value.data.every(tag => record(tag)
    && typeof tag.id === "string" && validId(tag.id) && typeof tag.name === "string" && ["ACTIVE","INACTIVE"].includes(String(tag.status)))) throw new PostListError("response");
  const tags: PublicTechStack[] = value.data.map(tag => ({ id: tag.id, name: tag.name, status: tag.status }));
  if (new Set(tags.map(tag => tag.id)).size !== tags.length) throw new PostListError("response");
  return tags;
}
