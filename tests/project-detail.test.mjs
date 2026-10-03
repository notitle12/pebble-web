import assert from "node:assert/strict";
import {test} from "node:test";
import {once} from "node:events";
import {createMockApi} from "../scripts/mock-post-api.mjs";
import {getPublicProject,parseProjectDetail,projectHref,safeExternalUrl} from "../src/features/project/api/project-list.ts";
import {getProjectPosts} from "../src/features/project/api/project-posts.ts";
test("프로젝트 주소·외부 링크는 경로 주입과 실행 스킴/자격정보를 거부",()=>{
  assert.equal(projectHref("721389012345680000",1),"/projects/721389012345680000?page=1");
  for(const id of ["01","../1","9223372036854775808"])assert.equal(projectHref(id),null);
  for(const url of ["javascript:alert(1)","data:text/html,x","//example.com","https://user:secret@example.com","bad"])assert.equal(safeExternalUrl(url),null);
  assert.equal(safeExternalUrl("https://example.com/docs"),"https://example.com/docs");
});
test("목 프로젝트 상세·관련 글 페이징·404·응답 무결성 확인",async()=>{
  const server=createMockApi();server.listen(0,"127.0.0.1");await once(server,"listening");
  const base=`http://127.0.0.1:${server.address().port}/api/v1`;const id="721389012345680000";
  try{
    const detail=await getPublicProject(id,base);assert.equal(detail.features.length,2);assert.match(detail.description,/<script>/);
    assert.equal((await getProjectPosts(id,0,base)).content.length,20);assert.equal((await getProjectPosts(id,1,base)).content.length,1);
    assert.deepEqual((await getProjectPosts(id,8,base)).content,[]);
    assert.equal((await getProjectPosts("721389012345680001",0,base)).totalElements,0);
    await assert.rejects(getPublicProject("1",base),error=>error.kind==="not-found");await assert.rejects(getProjectPosts("1",0,base),error=>error.kind==="not-found");
    for(const data of [{...detail,startedOn:"2026-02-30"},{...detail,features:[{...detail.features[0],id:1}]},{...detail,links:[{...detail.links[0],linkType:"SCRIPT"}]}])assert.throws(()=>parseProjectDetail({data}));
    await assert.rejects(getPublicProject("1",base,async()=>Response.json({data:detail})),error=>error.kind==="response");
    await assert.rejects(getPublicProject(id,base,async()=>new Response("bad",{status:503})),error=>error.kind==="response");
  }finally{await new Promise(resolve=>server.close(resolve));}
});
