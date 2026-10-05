import type { PostSummary } from "./api/post-list.ts";

function compareRecent(a: PostSummary, b: PostSummary): number {
  const aPublished = a.publishedAt ? Date.parse(a.publishedAt) : Date.parse(a.createdAt);
  const bPublished = b.publishedAt ? Date.parse(b.publishedAt) : Date.parse(b.createdAt);
  if (aPublished !== bPublished) return bPublished - aPublished;
  const created = Date.parse(b.createdAt) - Date.parse(a.createdAt);
  if (created !== 0) return created;
  return BigInt(b.id) > BigInt(a.id) ? 1 : BigInt(b.id) < BigInt(a.id) ? -1 : 0;
}

export function selectPopularRecent(
  posts: PostSummary[],
  limit = 3,
): PostSummary[] {
  const recent = posts
    .slice()
    .sort(compareRecent)
    .slice(0, 20)
    .filter(post => (post.likeCount ?? 0) > 0);
  return recent
    .sort((a, b) => (b.likeCount ?? 0) - (a.likeCount ?? 0) || compareRecent(a, b))
    .slice(0, Math.max(0, limit));
}
