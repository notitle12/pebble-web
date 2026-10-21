import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import { createMockApi } from "../scripts/mock-post-api.mjs";
import { getPublicPosts } from "../src/features/post/api/post-list.ts";

test("목 API를 실제 조회 함수로 읽어 목록·마지막 페이지·빈 목록·오류를 확인", async () => {
  for (const state of ["normal", "empty", "error"]) {
    const server = createMockApi(state);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const base = `http://127.0.0.1:${server.address().port}/api/v1`;
    try {
      if (state === "error") {
        await assert.rejects(getPublicPosts(0, base), error => error.kind === "response");
      } else {
        const first = await getPublicPosts(0, base);
        assert.equal(first.totalElements, state === "empty" ? 0 : 21);
        if (state === "normal") {
          assert.equal(first.content.length, 20);
          const last = await getPublicPosts(1, base);
          assert.equal(last.content.length, 1);
          assert.equal(last.hasNext, false);
          assert.deepEqual((await getPublicPosts(8, base)).content, []);
        }
      }
    } finally {
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  }
});
