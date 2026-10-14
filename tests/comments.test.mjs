import assert from "node:assert/strict";
import { test } from "node:test";
import { MemberApiError } from "../src/lib/member-api.ts";
import { commentFailure, commentInput, commentPath, parseComment, parseCommentPage, readComments } from "../src/features/comment/api/comments.ts";

const item=(overrides={})=>({id:"1",author:{id:"2",nickname:"N",handle:"writer",blogName:"Blog"},body:"댓글",visibility:"PUBLIC",createdAt:"2026-01-01T00:00:00Z",updatedAt:"2026-01-01T00:00:00Z",...overrides});
const page=(content=[],overrides={})=>({content,page:0,size:20,totalElements:content.length,totalPages:Math.ceil(content.length/20),hasNext:false,hasPrevious:false,...overrides});
const expectCode=(fn,code)=>assert.throws(fn,error=>error instanceof MemberApiError&&error.code===code);

test("댓글 경로는 target과 BIGINT 문자열만 허용한다",()=>{
  assert.equal(commentPath("posts","9223372036854775807","1"),"/posts/9223372036854775807/comments/1");
  assert.equal(commentPath("projects","1"),"/projects/1/comments");
  for(const [target,id,cid] of [["users","1"],["posts","1/../admin"],["posts","01"],["posts","0"],["posts","9223372036854775808"],["posts","1","a/b"],["posts","1","9223372036854775808"]]) expectCode(()=>commentPath(target,id,cid),"INVALID_REQUEST");
});

test("댓글 입력은 Unicode 코드포인트 2,000자 경계와 빈 값·NUL·깨진 서로게이트를 검증한다",()=>{
  assert.equal(commentInput("😀".repeat(2000),"PUBLIC").body.length,4000);
  for(const body of ["😀".repeat(2001),"   ","a\0b","\ud800","\udc00","a\ud800b","a\udc00b"]) expectCode(()=>commentInput(body,"PUBLIC"),"VALIDATION_ERROR");
  assert.deepEqual(commentInput(" 공개 ","PUBLIC"),{body:" 공개 ",visibility:"PUBLIC"});
  assert.deepEqual(commentInput("비공개","SECRET"),{body:"비공개",visibility:"SECRET"});
  expectCode(()=>commentInput("text","PRIVATE"),"VALIDATION_ERROR");
});

test("댓글 응답은 공개 범위, nullable author handle, Guest 비밀글 차단을 검증한다",()=>{
  assert.equal(parseComment({data:item({visibility:"SECRET",author:{...item().author,handle:null}})}).author.handle,null);
  assert.equal(parseComment({data:item({visibility:"PUBLIC"})}).visibility,"PUBLIC");
  assert.equal(parseComment({data:item({visibility:"SECRET"})}).visibility,"SECRET");
  assert.throws(()=>parseComment({data:item({visibility:"PRIVATE"})}));
  expectCode(()=>parseCommentPage({data:page([item({visibility:"SECRET"})])},0,true),"INVALID_RESPONSE");
  assert.equal(parseCommentPage({data:page([item()])},0,true).content.length,1);
});

test("댓글 페이지는 page/size/집계/중복 ID와 각 항목 응답을 검증한다",()=>{
  const valid=page([item(),item({id:"3"})],{totalElements:2,totalPages:1});
  assert.equal(parseCommentPage({data:valid},0).content.length,2);
  for(const bad of [
    {...valid,page:1},{...valid,size:10},{...valid,totalElements:"2"},{...valid,totalElements:1},{...valid,totalPages:2},
    {...valid,hasPrevious:true},{...valid,hasNext:true},{...valid,content:[item(),item()]},
    {...valid,content:[item({author:{...item().author,handle:42}})]},
    {...valid,content:[item({body:""})]},
  ]) assert.throws(()=>parseCommentPage({data:bad},0));
  assert.throws(()=>parseCommentPage({data:page([], {totalElements:41,totalPages:3,hasNext:false})},0));
  assert.throws(()=>parseCommentPage({data:page([], {totalElements:20,totalPages:1,hasNext:true})},0));
});

test("readComments는 페이지 쿼리와 Guest/member 주입 요청을 그대로 전달한다",async()=>{
  for(const guest of [true,false]) {
    let called=false;
    const request=async path=>{called=path;return {data:page([item()],{page:1,totalElements:21,totalPages:2,hasPrevious:true})};};
    const result=await readComments("projects","123",1,request,guest);
    assert.equal(result.page,1);
    assert.equal(called,"/projects/123/comments?page=1&size=20&sort=createdAt,asc");
  }
});

test("readComments는 페이지 숫자와 guest 응답 공개 범위를 검증한다",async()=>{
  for(const value of [-1,1.2,NaN,Infinity,107374183]) await assert.rejects(readComments("posts","1",value,async()=>({data:page([])})),e=>e.code==="INVALID_REQUEST");
  await assert.rejects(readComments("posts","1",0,async()=>({data:page([item({visibility:"SECRET"})])}),true),e=>e.code==="INVALID_RESPONSE");
  await assert.rejects(readComments("posts","1",1,async()=>({data:page([])})),e=>e.code==="INVALID_RESPONSE");
});

test("댓글 실패별 안내 문구를 반환한다",()=>{
  assert.match(commentFailure(new MemberApiError(0,"NETWORK","x")),/다시 불러와 처리 여부/);
  assert.match(commentFailure(new MemberApiError(401,"NO_AUTH","x")),/로그인이 필요/);
  assert.match(commentFailure(new MemberApiError(403,"FORBIDDEN","x")),/현재 계정/);
  assert.match(commentFailure(new MemberApiError(404,"NOT_FOUND","x")),/댓글 또는 콘텐츠/);
  assert.equal(commentFailure(new Error("custom")),"custom");
  assert.equal(commentFailure("oops"),"댓글을 처리하지 못했습니다.");
});
