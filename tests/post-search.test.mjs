import assert from "node:assert/strict";
import {test} from "node:test";
import {parsePostQuery,pageHref,getPublicPosts} from "../src/features/post/api/post-list.ts";
test("게시글 검색은 기술 스택 필터를 거부하고 제목·본문 검색 조건만 전달",async()=>{
 for(const params of [{tagId:"1"},{techStackId:"1"},{q:["a","b"]},{q:"a\0b"},{q:"😀".repeat(201)}])assert.equal(parsePostQuery(params),null);
 assert.equal(parsePostQuery({q:" Spring "}).q,"Spring");
 assert.equal(new URL(pageHref(2,{q:"%_ 한글",categoryId:"1"}),"https://example.com").searchParams.get("categoryId"),"1");
 await getPublicPosts(0,"https://api.example.com/api/v1",async(url,options)=>{
 assert.equal(url.pathname,"/api/v1/posts/search");assert.equal(url.searchParams.get("q"),"Spring");assert.equal(url.searchParams.has("tagId"),false);assert.equal(options.credentials,"omit");
 return Response.json({data:{content:[],page:0,size:20,totalElements:0,totalPages:0,hasNext:false,hasPrevious:false}});
 },{q:"Spring"});
});
