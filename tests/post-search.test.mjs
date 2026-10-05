import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import { createMockApi } from "../scripts/mock-post-api.mjs";
import { parsePostQuery, pageHref, getPublicPosts, getPublicTags } from "../src/features/post/api/post-list.ts";

test("검색 입력은 Unicode 길이·중복·NUL·BIGINT·알 수 없는 조건을 검증", () => {
  assert.equal(parsePostQuery({q:"😀".repeat(200)}).q.length,400);
  for (const params of [{q:"😀".repeat(201)},{q:"a\0b"},{q:"\ud800"},{q:["a","b"]},{tagId:["1","2"]},{tagId:"01"},{tagId:"9223372036854775808"},{sort:"oops"}]) assert.equal(parsePostQuery(params),null);
  assert.deepEqual(parsePostQuery({q:"  ",tagId:""}),{page:0,q:undefined,tagId:undefined});
  assert.equal(parsePostQuery({tagId:"9223372036854775807"}).tagId,"9223372036854775807");
  assert.equal(parsePostQuery({q:"  Spring  "}).q,"Spring");
});
test("페이지 URL은 검색·태그를 보존하고 특수문자를 인코딩",()=>{
  const url = new URL(pageHref(2,{q:"%_\\ 한글 &",tagId:"1"}),"https://example.com");
  assert.equal(url.searchParams.get("q"),"%_\\ 한글 &");
  assert.equal(url.searchParams.get("tagId"),"1");assert.equal(url.searchParams.get("page"),"2");
  assert.equal(new URL(pageHref(0,{q:"Java"}),"https://example.com").searchParams.has("page"),false);
});
test("실제 조회 함수로 목 검색·태그 AND 조건·결과 없음·공백 목록을 확인",async()=>{
  const server=createMockApi();server.listen(0,"127.0.0.1");await once(server,"listening");
  const base=`http://127.0.0.1:${server.address().port}/api/v1`;
  try {
    const tags=await getPublicTags(base);const spring=tags.find(t=>t.name==="Spring");
    const found=await getPublicPosts(0,base,undefined,{q:"spring",tagId:spring.id,page:0});
    assert.ok(found.totalElements>0);assert.ok(found.content.every(p=>p.tags.some(t=>t.id===spring.id)));
    assert.equal((await getPublicPosts(0,base,undefined,{q:"존재하지않는검색어"})).totalElements,0);
    assert.equal((await getPublicPosts(0,base,undefined,{q:"Java",tagId:tags.find(t=>t.name==="R2").id})).totalElements,0);
    assert.equal((await getPublicPosts(0,base,undefined,{q:" "})).totalElements,21);
  } finally { await new Promise(resolve=>server.close(resolve)); }
});
test("검색 endpoint는 Guest로 조건을 전달하고 태그 응답 오류를 거부",async()=>{
  await getPublicPosts(0,"https://api.example.com/api/v1",async(url,opts)=>{
    assert.equal(url.pathname,"/api/v1/posts/search");assert.equal(url.searchParams.get("q"),"%_");
    assert.equal(url.searchParams.get("tagId"),"1");assert.equal(opts.credentials,"omit");
    return Response.json({data:{content:[],page:0,size:20,totalElements:0,totalPages:0,hasNext:false,hasPrevious:false}});
  },{q:"%_",tagId:"1"});
  for(const data of [[{id:1,name:"x"}],[{id:"1",name:"x"},{id:"1",name:"y"}],{}]) {
    await assert.rejects(getPublicTags("https://api.example.com/api/v1",async()=>Response.json({data})));
  }
});
