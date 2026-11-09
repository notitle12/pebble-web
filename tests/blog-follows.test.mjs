import test from "node:test";
import assert from "node:assert/strict";
import {followsPath,followPath,parseFollowPage,parseFollowState} from "../src/features/blog-tools/api/blog-follows.ts";

test("블로그 구독 경로와 상태 응답을 검증한다",()=>{
 assert.equal(followPath("pebble_log_"),"/members/me/blogs/pebble_log_/follow");
 assert.equal(followsPath("followers",2),"/members/me/blog-follows?direction=followers&page=2&size=20");
 assert.deepEqual(parseFollowState({data:{following:true,followerCount:8}}),{following:true,followerCount:8});
 for(const value of [{data:{following:1,followerCount:8}},{data:{following:false,followerCount:-1}}])assert.throws(()=>parseFollowState(value));
});

test("구독 목록은 요청 페이지와 공개 identity만 허용한다",()=>{
 const row={handle:"reader_",nickname:"Reader",profileImageUrl:null};
 const data={content:[row],page:0,size:20,totalElements:1,totalPages:1,first:true,last:true};
 assert.deepEqual(parseFollowPage({data},0),data);
 assert.throws(()=>parseFollowPage({data:{...data,page:1}},0));
 assert.throws(()=>parseFollowPage({data:{...data,content:[{...row,handle:"bad handle"}]}},0));
});
