import test from "node:test";
import assert from "node:assert/strict";
import {parseUpdateQuery,updatesHref,parseUpdatePage,parseUpdateDetail,getPublicUpdates,getPublicUpdate,updateDate} from "../src/features/update/public-updates.ts";
const item={id:"900000000000000001",title:"새로운 기능",summary:"성능을 개선했어요.",type:"PERFORMANCE",version:"v1.2.0",publishedAt:"2026-10-23T00:00:00Z",updatedAt:"2026-10-23T01:00:00Z"};
const page=(items=[item])=>({data:{items,page:0,size:10,totalElements:items.length,totalPages:items.length?1:0}});
test("업데이트 조회 조건과 링크는 분류·페이지를 보존하고 잘못된 조건을 거부",()=>{
 assert.deepEqual(parseUpdateQuery({}),{page:0});assert.deepEqual(parseUpdateQuery({type:"FIX",page:"2"}),{page:2,type:"FIX"});
 assert.deepEqual(parseUpdateQuery({page:"100000"}),{page:100000});
 assert.equal(updatesHref({page:2,type:"FIX"}),"/updates?type=FIX&page=2");assert.equal(updatesHref(),"/updates");
 for(const params of [{page:"100001"},{page:"-1"},{page:"01"},{page:["1"]},{type:["FIX"]},{type:"DRAFT"},{size:"100"},{page:"9999999999999999999999"}])assert.equal(parseUpdateQuery(params),null);
});
test("공개 업데이트 파서는 문자열 BIGINT와 페이징 계약을 확인하며 관리자 정보를 노출하지 않는다",()=>{
 const result=parseUpdatePage(page([{...item,status:"PUBLISHED",revision:3,adminId:"1"}]),0);
 assert.deepEqual(result.items[0],item);assert.deepEqual(parseUpdatePage(page([]),0).items,[]);
 assert.equal(parseUpdatePage(page([{...item,version:null,summary:""}]),0).items[0].version,null);
 assert.equal(parseUpdatePage(page([{...item,version:"😀".repeat(40)}]),0).items[0].version,"😀".repeat(40));
 for(const changed of [{version:"a".repeat(41)},{version:"😀".repeat(41)},{id:900000000000000001},{id:"9223372036854775808"},{id:"0"},{id:"../admin"},{type:"DRAFT"},{title:" "},{title:"a".repeat(161)},{summary:"a".repeat(301)},{publishedAt:"invalid"},{updatedAt:null},{version:2}])assert.throws(()=>parseUpdatePage(page([{...item,...changed}]),0));
 for(const changed of [{size:20},{page:1},{totalPages:2},{totalElements:-1},{totalElements:0}])assert.throws(()=>parseUpdatePage({data:{...page().data,...changed}},0));
 assert.throws(()=>parseUpdatePage(page([item,item]),0));
});
test("업데이트 상세는 본문을 일반 텍스트 그대로 보존하고 누락·길이 위반을 거부",()=>{
 const body='<script>alert(1)</script>\n**일반 텍스트**';
 assert.equal(parseUpdateDetail({data:{...item,body}}).body,body);
 for(const body of [null," ","a".repeat(20001)])assert.throws(()=>parseUpdateDetail({data:{...item,body}}));
});
test("공개 업데이트는 쿠키 없이 no-store로 분류와 페이지 크기를 전송",async()=>{
 const result=await getPublicUpdates({page:0,type:"PERFORMANCE"},"https://api.example.com/api/v1",async(url,opts)=>{
  assert.equal(url.pathname,"/api/v1/updates");assert.equal(url.searchParams.get("page"),"0");assert.equal(url.searchParams.get("size"),"10");assert.equal(url.searchParams.get("type"),"PERFORMANCE");assert.equal(opts.credentials,"omit");assert.equal(opts.cache,"no-store");assert.deepEqual(opts.headers,{Accept:"application/json"});return Response.json(page());
 });assert.equal(result.items[0].id,item.id);
 await assert.rejects(getPublicUpdates({page:0,type:"FIX"},"https://api.example.com/api/v1",async()=>Response.json(page())),e=>e.kind==="response");
});
test("업데이트 상세는 요청 ID 일치와 404·네트워크 오류를 구분",async()=>{
 const base="https://api.example.com/api/v1";
 await getPublicUpdate(item.id,base,async(url,opts)=>{assert.equal(url.pathname,`/api/v1/updates/${item.id}`);assert.equal(opts.credentials,"omit");return Response.json({data:{...item,body:"내용"}});});
 await assert.rejects(getPublicUpdate("../admin",base),e=>e.kind==="not-found");
 await assert.rejects(getPublicUpdate("2",base,async()=>Response.json({data:{...item,body:"내용"}})),e=>e.kind==="response");
 await assert.rejects(getPublicUpdate(item.id,base,async()=>new Response(null,{status:404})),e=>e.kind==="not-found");
 await assert.rejects(getPublicUpdate(item.id,base,async()=>{throw new Error("offline");}),e=>e.kind==="network");
 assert.equal(updateDate("2026-10-22T16:00:00Z"),"2026년 10월 23일");
});
