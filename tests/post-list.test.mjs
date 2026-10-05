import assert from "node:assert/strict";
import { test } from "node:test";
import { getPublicPosts, parsePage, parsePostPage, pageHref, PostListError } from "../src/features/post/api/post-list.ts";
const post = { id: "721389012345678901", urlKey: "spring-note", title: "Spring 기록", summary: null, author: { id: "721389012345678902", handle: "pebble-dev", nickname: "작성자", blogName: null }, tags: [], publishedAt: "2026-10-03T00:00:00Z", createdAt: "2026-10-03T00:00:00Z" };
const body = (page = 0, content = [post], total = 21) => ({ data: { content, page, size: 20, totalElements: total, totalPages: Math.ceil(total / 20), hasPrevious: page > 0, hasNext: page + 1 < Math.ceil(total / 20) } });
test("페이지 기본값·중복·음수·소수·offset 한도", () => {
  assert.equal(parsePage(undefined), 0); assert.equal(parsePage("1"), 1);
  for (const value of ["-1", "1.2", "01", "", "1e2", "107374183", ["1", "2"]]) assert.equal(parsePage(value), null);
  assert.equal(pageHref(0), "/"); assert.equal(pageHref(2), "/?page=2");
});
test("Guest SSR 요청은 page·size·no-store만 사용하고 쿠키를 제외", async () => {
  const page = await getPublicPosts(1, "https://api.example.com/api/v1/", async (url, options) => {
    assert.equal(String(url), "https://api.example.com/api/v1/posts?page=1&size=20");
    assert.equal(options.cache, "no-store"); assert.equal(options.credentials, "omit");
    assert.deepEqual(options.headers, { Accept: "application/json" });
    return Response.json(body(1));
  });
  assert.equal(page.content[0].id, "721389012345678901"); assert.equal(page.hasNext, false);
});
test("빈 목록과 범위 밖 페이지를 성공 응답으로 유지", () => {
  assert.equal(parsePostPage(body(0, [], 0), 0).totalPages, 0);
  assert.deepEqual(parsePostPage(body(8, [], 21), 8).content, []);
});
test("깨진 응답·숫자 ID·잘못된 날짜·다른 페이지를 거부", () => {
  for (const value of [{}, body(1), body(0, [{ ...post, id: 1 }]), body(0, [{ ...post, createdAt: "oops" }]), { data: { ...body().data, hasNext: false } }]) {
    assert.throws(() => parsePostPage(value, 0), PostListError);
  }
});
test("API 오류·HTML 응답·연결 실패를 빈 목록으로 대체하지 않음", async () => {
  for (const response of [new Response("error", { status: 503 }), new Response("<html>bad</html>")]) {
    await assert.rejects(getPublicPosts(0, "https://api.example.com/api/v1", async () => response), e => e.kind === "response");
  }
  await assert.rejects(getPublicPosts(0, "https://api.example.com/api/v1", async () => { throw new Error("offline"); }), e => e.kind === "network");
});
test("누락·위험한 API 설정에서는 네트워크 호출을 하지 않음", async () => {
  for (const base of ["", "file:///tmp", "https://user:secret@example.com", "https://api.example.com?token=secret"]) {
    await assert.rejects(getPublicPosts(0, base, async () => { assert.fail("호출하면 안 됨"); }), e => e.kind === "configuration");
  }
});
