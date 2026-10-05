import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import { MemberApiError } from "../src/lib/member-api.ts";
import { createMockApi } from "../scripts/mock-post-api.mjs";
import { likePath, parseLikeState, readLikes, writeLike } from "../src/features/like/api/likes.ts";
import { getPublicProject, parseProjectDetail, parseProjectPage } from "../src/features/project/api/project-list.ts";
import { getPublicPost, parsePostDetail, parsePostPage } from "../src/features/post/api/post-list.ts";

test("좋아요 경로는 숫자 BIGINT ID만 허용하고 경로·query 주입을 거부한다", () => {
  assert.equal(likePath("posts", "42"), "/posts/42");
  assert.equal(likePath("projects", "9223372036854775807", true), "/projects/9223372036854775807/like");
  for (const id of ["../42", "1/like", "1?x=1", "1#x", "01", "0", "9223372036854775808", "-1"]) assert.throws(() => likePath("posts", id));
  assert.throws(() => likePath("comments", "42"));
});

test("좋아요 상태는 대상 ID·안전한 0 이상 집계·boolean을 검증하고 Guest likedByMe를 거부한다", () => {
  assert.deepEqual(parseLikeState({ data: { id: "42", likeCount: 0, likedByMe: false } }, "42"), { likeCount: 0, likedByMe: false });
  assert.deepEqual(parseLikeState({ data: { id: "42", likeCount: 3, likedByMe: true } }, "42"), { likeCount: 3, likedByMe: true });
  for (const state of [
    { id: "43", likeCount: 0, likedByMe: false }, { id: "42", likeCount: -1, likedByMe: false },
    { id: "42", likeCount: 1.5, likedByMe: false }, { id: "42", likeCount: Number.MAX_SAFE_INTEGER + 1, likedByMe: false },
    { id: "42", likeCount: 0, likedByMe: 0 },
  ]) assert.throws(() => parseLikeState({ data: state }, "42"), MemberApiError);
  assert.throws(() => parseLikeState({ data: { id: "42", likeCount: 1, likedByMe: true } }, "42", true), MemberApiError);
});

test("회원 조회는 member request를 사용하고 Guest 조회는 no-store·credential omit·인증 헤더 없이 요청한다", async () => {
  const memberCalls = [];
  const memberState = await readLikes("posts", "42", async (...args) => {
    memberCalls.push(args);
    return { data: { id: "42", likeCount: 2, likedByMe: true } };
  });
  assert.deepEqual(memberState, { likeCount: 2, likedByMe: true });
  assert.deepEqual(memberCalls, [["/posts/42"]]);
  const guestCalls = [];
  const guestState = await readLikes("projects", "42", undefined, "https://api.example/api/v1", async (url, options) => {
    guestCalls.push({ url: String(url), options });
    return Response.json({ data: { id: "42", likeCount: 4, likedByMe: false } });
  });
  assert.deepEqual(guestState, { likeCount: 4, likedByMe: false });
  assert.equal(guestCalls.length, 1);
  assert.equal(guestCalls[0].url, "https://api.example/api/v1/projects/42");
  assert.equal(guestCalls[0].options.cache, "no-store");
  assert.equal(guestCalls[0].options.credentials, "omit");
  assert.equal(guestCalls[0].options.method, undefined);
  assert.deepEqual(guestCalls[0].options.headers, { Accept: "application/json" });
  assert.equal(new URL(guestCalls[0].url).search, "");
});

test("좋아요 쓰기는 본문·query 없이 PUT/DELETE하며 null 응답만 성공으로 처리한다", async () => {
  const calls = [];
  const request = async (...args) => { calls.push(args); return null; };
  await writeLike("posts", "42", true, request);
  await writeLike("projects", "43", false, request);
  assert.deepEqual(calls, [["/posts/42/like", { method: "PUT" }], ["/projects/43/like", { method: "DELETE" }]]);
  for (const unexpected of [{ data: {} }, undefined, false]) await assert.rejects(writeLike("posts", "42", true, async () => unexpected), MemberApiError);
});

test("실패한 좋아요 쓰기는 재시도하지 않고 원래 오류를 전파한다", async () => {
  const failure = new Error("request failed");
  let calls = 0;
  await assert.rejects(writeLike("posts", "42", true, async () => { calls += 1; throw failure; }), error => error === failure);
  assert.equal(calls, 1);
});

test("Post 상세의 선택적 좋아요 필드는 유효값을 보존하고 잘못된 값을 거부한다", async () => {
  const server = createMockApi();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  try {
    const post = await getPublicPost("writer-1", "note-1", base);
    assert.deepEqual(await readLikes("posts",post.id,undefined,base),{likeCount:0,likedByMe:false});
    const project=await getPublicProject("721389012345680000",base);
    assert.deepEqual(await readLikes("projects",project.id,undefined,base),{likeCount:0,likedByMe:false});
    for(const likeCount of [-1,1.5,"1",Number.MAX_SAFE_INTEGER+1])assert.throws(()=>parseProjectDetail({data:{...project,likeCount}}));
    for(const likedByMe of [1,"false",null])assert.throws(()=>parseProjectDetail({data:{...project,likedByMe}}));
    const valid = parsePostDetail({ data: { ...post, likeCount: 0, likedByMe: false } });
    assert.equal(valid.likeCount, 0);
    assert.equal(valid.likedByMe, false);
    for (const value of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, "1"]) assert.throws(() => parsePostDetail({ data: { ...post, likeCount: value } }));
    for (const value of ["true", 1, null]) assert.throws(() => parsePostDetail({ data: { ...post, likedByMe: value } }));
  } finally { await new Promise(resolve => server.close(resolve)); }
});


test("공개 글·프로젝트 목록은 집계를 보존하고 잘못된 값은 거부한다",()=>{
 const post={id:"10",urlKey:"note-1",title:"글",summary:null,author:{id:"20",handle:"writer-1",nickname:"작성자",blogName:null},tags:[],publishedAt:null,createdAt:"2026-10-04T00:00:00Z",likeCount:1234,likedByMe:false};
 const project={id:"30",name:"프로젝트",summary:null,owner:{id:"20",nickname:"작성자"},tags:[],lifecycleStatus:"IN_PROGRESS",publishedAt:null,createdAt:"2026-10-04T00:00:00Z",likeCount:0,likedByMe:false};
 const envelope=item=>({data:{content:[item],page:0,size:20,totalElements:1,totalPages:1,hasNext:false,hasPrevious:false}});
 for(const [parser,item] of [[parsePostPage,post],[parseProjectPage,project]]){
   assert.equal(parser(envelope(item),0).content[0].likeCount,item.likeCount);
   for(const likeCount of [-1,1.5,"1",null,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>parser(envelope({...item,likeCount}),0));
   for(const likedByMe of [1,"false",null])assert.throws(()=>parser(envelope({...item,likedByMe}),0));
   const legacy={...item};delete legacy.likeCount;delete legacy.likedByMe;
   assert.equal(parser(envelope(legacy),0).content[0].likeCount,undefined);
 }
});
