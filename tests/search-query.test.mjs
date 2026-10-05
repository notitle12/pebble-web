import assert from "node:assert/strict";
import { test } from "node:test";
import { parseSearchQuery, searchHref } from "../src/features/search/query.ts";

test("search query reuses list validation and rejects invalid URL parameters", () => {
  assert.deepEqual(parseSearchQuery({}), { q: undefined, page: 0, type: "all" });
  assert.deepEqual(parseSearchQuery({ q: "  한글  ", type: "projects", page: "2" }), {
    q: "한글", page: 2, type: "projects",
  });
  for (const params of [
    { type: ["posts", "projects"] }, { q: ["one", "two"] }, { unknown: "x" },
    { type: "other" }, { page: "-1" }, { page: "1", duplicate: "1" },
    { q: "가".repeat(201) }, { q: "a\0b" }, { type: "all", page: "1" }, {tagId:"1"}, {page:["0","1"]},
  ]) assert.equal(parseSearchQuery(params), null);
  assert.equal(parseSearchQuery({ q: "가".repeat(200) })?.q?.length, 200);
});

test("search href omits default values and encodes query text", () => {
  assert.equal(searchHref({ q: "한글 & +", type: "all" }), "/search?q=%ED%95%9C%EA%B8%80+%26+%2B");
  assert.equal(searchHref({ type: "all" }), "/search");
  assert.equal(searchHref({ q: "Pebble", type: "posts", page: 8 }, 0), "/search?q=Pebble&type=posts");
  assert.equal(searchHref({ q: "Pebble", type: "projects" }, 2), "/search?q=Pebble&type=projects&page=2");
});
