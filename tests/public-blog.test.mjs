import test from "node:test";
import assert from "node:assert/strict";
import { GuestApiError } from "../src/lib/public-api.ts";
import { blogHref, getPublicBlogPosts } from "../src/features/post/api/public-blog.ts";

const post = (handle = "pebble-dev") => ({
  id: "721389012345678901", urlKey: "first-post", title: "첫 글", summary: null,
  author: { id: "721389012345678902", handle, blogName: "Pebble 기록", nickname: "pebble" },
  tags: [], publishedAt: "2026-10-01T03:00:00Z", createdAt: "2026-10-01T03:00:00Z",
});
const page = (content = [], requestedPage = 0, totalElements = content.length) => ({ data: {
  content, page: requestedPage, size: 20, totalElements, totalPages: Math.ceil(totalElements / 20),
  hasNext: requestedPage + 1 < Math.ceil(totalElements / 20), hasPrevious: requestedPage > 0,
} });

test("requests a guest blog page with the validated handle, page, and search parameters", async () => {
  let seen;
  const result = await getPublicBlogPosts("pebble-dev", 2, "https://api.example/api/v1", async (input, init) => {
    seen = { url: String(input), init };
    return Response.json(page([post()], 2, 60));
  }, "배포 기록");
  assert.equal(seen.url, "https://api.example/api/v1/blogs/pebble-dev/posts?page=2&size=20&q=%EB%B0%B0%ED%8F%AC+%EA%B8%B0%EB%A1%9D");
  assert.equal(seen.init.credentials, "omit");
  assert.equal(seen.init.cache, "no-store");
  assert.equal(result.page, 2);
});

test("builds validated personal blog pagination links", () => {
  assert.equal(blogHref("pebble-dev", 0), "/blogs/pebble-dev");
  assert.equal(blogHref("pebble-dev", 3), "/blogs/pebble-dev?page=3");
  assert.equal(blogHref("pebble-dev", 3, undefined, "검색 단어"), "/blogs/pebble-dev?q=%EA%B2%80%EC%83%89+%EB%8B%A8%EC%96%B4&page=3");
  assert.throws(() => blogHref("bad/handle", 0), GuestApiError);
  assert.throws(() => blogHref("pebble-dev", -1), GuestApiError);
});

test("rejects a blog search term longer than the API contract", async () => {
  await assert.rejects(getPublicBlogPosts("pebble-dev", 0, "https://api.example", async () => {
    throw new Error("must not request an invalid search");
  }, "x".repeat(201)), GuestApiError);
  assert.throws(() => blogHref("pebble-dev", 0, undefined, "x".repeat(201)), GuestApiError);
});

test("rejects invalid handles and mixed-author results", async () => {
  await assert.rejects(getPublicBlogPosts("UPPER", 0, "https://api.example", async () => {
    throw new Error("must not request invalid handle");
  }), GuestApiError);
  await assert.rejects(getPublicBlogPosts("pebble-dev", 0, "https://api.example", async () => Response.json(page([post("other-blog")]))),
    error => error instanceof GuestApiError && error.kind === "response");
});

test("accepts empty public lists without inventing author metadata", async () => {
  const result = await getPublicBlogPosts("pebble-dev", 0, "https://api.example", async () => Response.json(page()));
  assert.deepEqual(result.content, []);
});

test("preserves not-found and retriable API errors", async () => {
  await assert.rejects(getPublicBlogPosts("pebble-dev", 0, "https://api.example", async () => new Response(null, { status: 404 })),
    error => error instanceof GuestApiError && error.kind === "not-found");
  await assert.rejects(getPublicBlogPosts("pebble-dev", 0, "https://api.example", async () => new Response(null, { status: 503 })),
    error => error instanceof GuestApiError && error.kind === "response");
});
