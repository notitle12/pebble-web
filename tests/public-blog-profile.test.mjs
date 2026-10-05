import test from "node:test";
import assert from "node:assert/strict";
import {parsePublicBlogProfile,getPublicBlogProfile} from "../src/features/post/api/public-blog.ts";
const data={id:"9007199254740993",handle:"empty-blog",nickname:"개발자",blogName:"빈 블로그",profileImageUrl:null};
test("공개 프로필은 글 없이도 BIGINT ID와 블로그 정보를 유지한다",()=>{
  assert.deepEqual(parsePublicBlogProfile({data},data.handle),data);
  for(const change of [{id:9007199254740993},{id:"0"},{handle:"other-blog"},{blogName:null},{nickname:" "},{profileImageUrl:undefined}]) {
    assert.throws(()=>parsePublicBlogProfile({data:{...data,...change}},data.handle));
  }
});
test("공개 프로필은 인증 정보 없이 정확한 Guest 경로를 호출한다",async()=>{
  const profile=await getPublicBlogProfile(data.handle,"https://api.example/api/v1",async(url,options)=>{
    assert.equal(String(url),"https://api.example/api/v1/blogs/empty-blog");
    assert.equal(options.credentials,"omit");assert.equal(options.cache,"no-store");
    return Response.json({data});
  });
  assert.equal(profile.id,data.id);
  await assert.rejects(()=>getPublicBlogProfile(data.handle,"https://api.example/api/v1",async()=>new Response(null,{status:404})),error=>error.kind==="not-found");
});
test("공개 프로필 경로는 영구 handle의 밑줄 문자를 허용한다",async()=>{
  const handle="pebble_log_";
  const profile={...data,handle};
  const result=await getPublicBlogProfile(handle,"https://api.example/api/v1",async(url)=>{
    assert.equal(String(url),"https://api.example/api/v1/blogs/pebble_log_");
    return Response.json({data:profile});
  });
  assert.equal(result.handle,handle);
});
