import assert from "node:assert/strict";
import {test} from "node:test";
import {once} from "node:events";
import {createMockApi} from "../scripts/mock-post-api.mjs";
import {getPublicProjects,parseProjectQuery,parseProjectPage,projectPageHref} from "../src/features/project/api/project-list.ts";
test("프로젝트 입력·상태·중복 query를 검증하고 페이지 링크에 조건 보존",()=>{
  for(const input of [{lifecycleStatus:"PLANNED"},{lifecycleStatus:["COMPLETED","IN_PROGRESS"]},{q:["a","b"]},{page:"-1"},{tagId:"01"},{q:"😀".repeat(201)},{unknown:"x"}]) assert.equal(parseProjectQuery(input),null);
  const query=parseProjectQuery({q:" Pebble ",tagId:"1",lifecycleStatus:"COMPLETED"});
  const url=new URL(projectPageHref(2,query),"https://example.com");
  assert.equal(url.pathname,"/projects");assert.equal(url.searchParams.get("q"),"Pebble");assert.equal(url.searchParams.get("page"),"2");assert.equal(url.searchParams.get("tagId"),"1");assert.equal(url.searchParams.get("lifecycleStatus"),"COMPLETED");
});
test("목 프로젝트 API의 목록·마지막 페이지·검색/필터 AND·빈/실패 검증",async()=>{
  for(const state of ["normal","empty","error"]){
    const server=createMockApi(state);server.listen(0,"127.0.0.1");await once(server,"listening");
    const base=`http://127.0.0.1:${server.address().port}/api/v1`;
    try{
      if(state==="error") await assert.rejects(getPublicProjects({page:0},base),error=>error.kind==="response");
      else {
        const first=await getPublicProjects({page:0},base);assert.equal(first.totalElements,state==="empty"?0:21);
        if(state==="normal"){
          assert.equal((await getPublicProjects({page:1},base)).content.length,1);
          assert.deepEqual((await getPublicProjects({page:8},base)).content,[]);
          const filtered=await getPublicProjects({page:0,q:"Pebble",tagId:"1",lifecycleStatus:"IN_PROGRESS"},base);
          assert.ok(filtered.content.length>0);assert.ok(filtered.content.every(p=>p.lifecycleStatus==="IN_PROGRESS" && p.tags.some(t=>t.id==="1")));
          assert.equal((await getPublicProjects({page:0,q:"아무것도없음"},base)).totalElements,0);
          for(const project of [{...first.content[0],id:1},{...first.content[0],lifecycleStatus:"PLANNED"},{...first.content[0],createdAt:"oops"}]) assert.throws(()=>parseProjectPage({data:{...first,content:[project]}},0));
        }
      }
    } finally {await new Promise(resolve=>server.close(resolve));}
  }
});
test("프로젝트 Guest 검색은 지원 조건만 전달",async()=>{
  await getPublicProjects({page:0,q:"%_",tagId:"1",lifecycleStatus:"COMPLETED"},"https://api.example.com/api/v1",async(url,opts)=>{
    assert.equal(url.pathname,"/api/v1/projects/search");assert.equal(url.searchParams.get("q"),"%_");assert.equal(url.searchParams.get("lifecycleStatus"),"COMPLETED");assert.equal(opts.credentials,"omit");assert.equal(opts.cache,"no-store");assert.deepEqual(opts.headers,{Accept:"application/json"});
    return Response.json({data:{content:[],page:0,size:20,totalElements:0,totalPages:0,hasNext:false,hasPrevious:false}});
  });
});
