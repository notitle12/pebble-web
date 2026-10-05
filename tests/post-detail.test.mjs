import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import { createMockApi } from "../scripts/mock-post-api.mjs";
import { getPublicPost, parsePostDetail, postHref } from "../src/features/post/api/post-list.ts";
test("공개 주소는 handle+slug 또는 BIGINT 글 번호이며 경로 주입을 거부",()=>{
  assert.equal(postHref("writer-1","note-1"),"/blogs/writer-1/posts/note-1");
  assert.ok(postHref("writer-1","9223372036854775807"));
  for(const key of ["../oops","a/b","search","01","9223372036854775808"]) assert.equal(postHref("writer-1",key),null);
  assert.equal(postHref("x/other","note-1"),null);
});
test("목 상세 Guest 조회·본문 문자 보존·없는 글·깨진 블록 응답 검증",async()=>{
  const server=createMockApi();server.listen(0,"127.0.0.1");await once(server,"listening");
  const base=`http://127.0.0.1:${server.address().port}/api/v1`;
  try {
    const post=await getPublicPost("writer-1","note-1",base);
    assert.equal(post.blocks[1].type,"CODE");assert.match(post.blocks[0].content,/<script>/);
    await assert.rejects(getPublicPost("writer-1","missing",base),error=>error.kind==="not-found");
    for(const block of [{...post.blocks[0],type:"HTML"},{...post.blocks[1],language:"BAD"},{...post.blocks[0],content:null}]) assert.throws(()=>parsePostDetail({data:{...post,blocks:[block]}}));
    await assert.rejects(getPublicPost("writer-1","other",base,async()=>Response.json({data:post})),error=>error.kind==="response");
  } finally {await new Promise(resolve=>server.close(resolve));}
});
