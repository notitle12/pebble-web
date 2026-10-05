import test from "node:test";
import assert from "node:assert/strict";
import {contentPath,postPosition,confirmDeletion} from "../src/features/content/management-model.ts";
test("콘텐츠 관리 경로는 BIGINT와 정확한 종류만 허용한다",()=>{
 assert.equal(contentPath("posts","9007199254740993"),"/posts/9007199254740993");
 for(const [kind,id] of [["posts","0"],["projects","../1"],["members","1"],["projects","9223372036854775808"]])assert.throws(()=>contentPath(kind,id));
});
test("사용자 표시 순서는 1 기반이고 API 순서는 0 기반이다",()=>{
 assert.equal(postPosition("1",3),0);assert.equal(postPosition("3",3),2);
 for(const value of ["0","-1","1.5","4","01","1e1",""])assert.throws(()=>postPosition(value,3));
});
test("삭제는 본문 없는 성공을 확인하며 불확실 응답은 성공 처리하지 않는다",()=>{
 assert.doesNotThrow(()=>confirmDeletion(null));for(const value of [{},undefined,{data:{id:"1"}}])assert.throws(()=>confirmDeletion(value));
});
