import assert from "node:assert/strict";
import { test } from "node:test";
import { parseBlogSearchPage, searchPublicBlogs } from "../src/features/search/blog-search.ts";
import { GuestApiError } from "../src/lib/public-api.ts";

const page = (content = [], pageNumber = 0, totalElements = content.length) => ({
  data: { content, page: pageNumber, size: 20, totalElements, totalPages: Math.ceil(totalElements / 20),
    hasNext: pageNumber + 1 < Math.ceil(totalElements / 20), hasPrevious: pageNumber > 0 },
});

test("blog search parses public blog rows and validates pagination", () => {
  const blog = { handle: "pebble_writer", nickname: "Pebble", blogName: "기록", profileImageUrl: null };
  assert.deepEqual(parseBlogSearchPage(page([blog]), 0).content, [blog]);
  assert.throws(() => parseBlogSearchPage(page([{ ...blog, handle: "Invalid" }]), 0), GuestApiError);
  assert.throws(() => parseBlogSearchPage(page([blog], 1), 0), GuestApiError);
  const inconsistentTotal = page([blog], 0, 21);
  inconsistentTotal.data.hasNext = false;
  assert.throws(() => parseBlogSearchPage(inconsistentTotal, 0), GuestApiError);
});

test("blog search requests the public blogs endpoint and keeps the query on later pages", async () => {
  let requestedUrl;
  const request = async (url, options) => {
    requestedUrl = new URL(url);
    assert.equal(options.credentials, "omit");
    return Response.json(page([], 1, 21));
  };
  const result = await searchPublicBlogs(" 기록 ", 1, "https://api.example/api/v1", request);
  assert.equal(requestedUrl.pathname, "/api/v1/blogs");
  assert.equal(requestedUrl.searchParams.get("q"), "기록");
  assert.equal(requestedUrl.searchParams.get("page"), "1");
  assert.equal(requestedUrl.searchParams.get("size"), "20");
  assert.equal(result.hasPrevious, true);
});
