import assert from "node:assert/strict";
import {test} from "node:test";
import {once} from "node:events";
import {createMockApi,mockCategories} from "../scripts/mock-post-api.mjs";
import {getPublicCategories,parseCategories,categoryOptions} from "../src/features/category/api/public-categories.ts";
import {getPublicTags} from "../src/features/tag/api/public-tags.ts";
import {getPublicPosts,parsePostQuery,pageHref} from "../src/features/post/api/post-list.ts";
import {parseProjectQuery} from "../src/features/project/api/project-list.ts";
test("분류는 2단계·부모 관계·중복·상태를 검증하고 기존 그룹을 보존",()=>{
  assert.equal(parseCategories({data:mockCategories})[2].status,"INACTIVE");
  assert.match(categoryOptions(mockCategories)[3].name,/Frontend/);
  for(const data of [[{...mockCategories[0],parentId:"1"}],[mockCategories[0],mockCategories[0]],[{...mockCategories[0],status:"BAD"}],[{...mockCategories[0],children:[{...mockCategories[0].children[0],children:[mockCategories[1]]}]}]])assert.throws(()=>parseCategories({data}));
});
test("글 분류 입력·페이지 보존과 프로젝트의 미지원 필터 거부",()=>{
  assert.equal(parsePostQuery({categoryId:"101"}).categoryId,"101");
  for(const categoryId of ["01","9223372036854775808",["1","2"]])assert.equal(parsePostQuery({categoryId}),null);
  assert.equal(parseProjectQuery({categoryId:"101"}),null);
  const url=new URL(pageHref(1,{q:"Spring",tagId:"1",categoryId:"101"}),"https://example.com");
  assert.equal(url.searchParams.get("categoryId"),"101");assert.equal(url.searchParams.get("page"),"1");
});
test("목 분류·태그 조회와 상위/하위·검색+태그+분류 AND·빈/오류",async()=>{
  for(const state of ["normal","empty","error"]){
    const server=createMockApi(state);server.listen(0,"127.0.0.1");await once(server,"listening");const base=`http://127.0.0.1:${server.address().port}/api/v1`;
    try{
      if(state==="error"){await assert.rejects(getPublicCategories(base));await assert.rejects(getPublicTags(base));}
      else if(state==="empty"){assert.deepEqual(await getPublicCategories(base),[]);assert.deepEqual(await getPublicTags(base),[]);}
      else{
        assert.equal((await getPublicCategories(base)).length,3);assert.ok((await getPublicTags(base)).length);
        const parent=await getPublicPosts(0,base,undefined,{categoryId:"101"});const child=await getPublicPosts(0,base,undefined,{categoryId:"102"});assert.equal(parent.totalElements,child.totalElements);assert.ok(parent.totalElements);
        assert.equal((await getPublicPosts(0,base,undefined,{q:"Backend",categoryId:"101"})).totalElements,parent.totalElements);
        const result=await getPublicPosts(0,base,undefined,{q:"Spring",tagId:"1",categoryId:"101"});assert.ok(result.totalElements>0);
        assert.equal((await getPublicPosts(0,base,undefined,{q:"Spring",categoryId:"201"})).totalElements,0);
      }
    }finally{await new Promise(resolve=>server.close(resolve));}
  }
});
