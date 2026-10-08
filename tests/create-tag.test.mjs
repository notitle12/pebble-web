import assert from "node:assert/strict";
import { test } from "node:test";
import { MemberApiError } from "../src/lib/member-api.ts";
import { createTag, normalizeTagName, parseCreatedTag, splitTagInput } from "../src/features/tag/api/create-tag.ts";

test("자유 태그 이름은 NFKC, trim, # 하나 제거, 소문자 순으로 정규화한다", () => {
  assert.equal(normalizeTagName("  ＃SpringBoot  ".replace("＃", "#")), "springboot");
  assert.equal(normalizeTagName("#한글+TypeScript_2.0"), "한글+typescript_2.0");
  for (const value of ["", "   ", "##double", "two words", "a/b", "<b>x</b>", "😀", "a".repeat(51)]) {
    assert.throws(() => normalizeTagName(value), error => error instanceof MemberApiError && error.code === "VALIDATION_ERROR");
  }
});

test("여러 #태그, 쉼표 구분 및 일반 한 태그 입력을 나눈다", () => {
  assert.deepEqual(splitTagInput("#springboot #아무개, #Typescript"), ["springboot", "아무개", "Typescript"]);
  assert.deepEqual(splitTagInput("#springboot,아무개"), ["springboot", "아무개"]);
  assert.deepEqual(splitTagInput("한글+태그"), ["한글+태그"]);
});

test("POST /tags는 정규화한 이름을 보내고 응답 계약을 확인한다", async () => {
  let call;
  const result = await createTag(" #SpringBoot ", async (path, options) => {
    call = { path, options };
    return { data: { id: "123", name: "springboot", slug: "springboot", displayOrder: 4, status: "ACTIVE" } };
  });
  assert.equal(call.path, "/tags");
  assert.deepEqual(call.options, { method: "POST", body: { name: "springboot" } });
  assert.deepEqual(result, { id: "123", name: "springboot", slug: "springboot", displayOrder: 4, status: "ACTIVE" });
  for (const data of [
    { id: "01", name: "x", slug: "x", displayOrder: 0, status: "ACTIVE" },
    { id: "1", name: "x", slug: "x", displayOrder: -1, status: "ACTIVE" },
    { id: "1", name: "x", slug: "x", displayOrder: 0, status: "INACTIVE" },
  ]) assert.throws(() => parseCreatedTag({ data }));
});
