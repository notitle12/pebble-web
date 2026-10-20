import test from "node:test";
import assert from "node:assert/strict";
import {deleteSelectedPosts} from "../src/features/post/bulk-delete.ts";
test("선택한 ID만 중복 없이 삭제하고 응답을 확인한다",async()=>{
 const calls=[];const result=await deleteSelectedPosts(["1","2","1"],async(path,options)=>{calls.push([path,options.method]);return null;},()=>true);
 assert.deepEqual(calls,[["/posts/1","DELETE"],["/posts/2","DELETE"]]);assert.deepEqual(result.deleted,["1","2"]);assert.equal(result.error,undefined);
});
test("일부 삭제 실패·응답 유실이면 추가 글 삭제를 중단하고 확인된 ID만 반환한다",async()=>{
 const calls=[];const error=new Error("response lost");const result=await deleteSelectedPosts(["1","2","3"],async path=>{calls.push(path);if(path==="/posts/2")throw error;return null;},()=>true);
 assert.deepEqual(result.deleted,["1"]);assert.equal(result.error,error);assert.equal(calls.length,2);
});
test("세션 변경 직후 남은 요청을 보내지 않는다",async()=>{
 let current=true;const calls=[];const result=await deleteSelectedPosts(["1","2"],async path=>{calls.push(path);current=false;return null;},()=>current);
 assert.equal(result.interrupted,true);assert.deepEqual(result.deleted,["1"]);assert.equal(calls.length,1);
});
test("전체 ID를 먼저 검증해 잘못된 요청은 일부라도 보내지 않는다",async()=>{
 let calls=0;const request=async()=>{calls++;return null;};
 for(const ids of [[],["1","../2"],Array.from({length:21},(_,i)=>String(i+1))])await assert.rejects(deleteSelectedPosts(ids,request,()=>true));
 assert.equal(calls,0);
});
test("성공처럼 보이는 잘못된 삭제 응답도 미확인으로 처리한다",async()=>{
 const result=await deleteSelectedPosts(["1","2"],async()=>({deleted:true}),()=>true);assert.deepEqual(result.deleted,[]);assert.ok(result.error);
});
