import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import { createMockApi } from "../scripts/mock-post-api.mjs";
import { getPublicPost, parsePostDetail, postHref } from "../src/features/post/api/post-list.ts";
test("공개 주소는 handle+slug 또는 BIGINT 글 번호이며 경로 주입을 거부",()=>{
  assert.equal(postHref("writer-1","note-1"),"/blogs/writer-1/posts/note-1");
  assert.ok(postHref("writer-1","9223372036854775807"));
  for(const key of ["../oops","a/b","search","01","9223372036854775808"]) assert.equal(postHref("writer-1",key),null);
  assert.equal(postHref("x/other","note-1"),null);
});
test("목 상세 Guest 조회·본문 문자 보존·없는 글·깨진 블록 응답 검증",async()=>{
  const server=createMockApi();server.listen(0,"127.0.0.1");await once(server,"listening");
  const base=`http://127.0.0.1:${server.address().port}/api/v1`;
  try {
    const post=await getPublicPost("writer-1","note-1",base);
    assert.equal(post.blocks[1].type,"CODE");assert.match(post.blocks[0].content,/<script>/);
    await assert.rejects(getPublicPost("writer-1","missing",base),error=>error.kind==="not-found");
    for(const block of [{...post.blocks[0],type:"HTML"},{...post.blocks[1],language:"BAD"},{...post.blocks[0],content:null}]) assert.throws(()=>parsePostDetail({data:{...post,blocks:[block]}}));
    await assert.rejects(getPublicPost("writer-1","other",base,async()=>Response.json({data:post})),error=>error.kind==="response");
  } finally {await new Promise(resolve=>server.close(resolve));}
});
test("TABLE 블록은 정확한 명세 스키마와 Unicode 문자열 제약을 지킨다",async()=>{
  const server=createMockApi();server.listen(0,"127.0.0.1");await once(server,"listening");
  const base=`http://127.0.0.1:${server.address().port}/api/v1`;
  try {
    const post=await getPublicPost("writer-1","note-1",base);
    const spec={schemaVersion:1,tableName:"member",description:"회원 프로필",columns:[
      {name:"id",dataType:"BIGINT",nullable:false,primaryKey:true},
      {name:"handle",dataType:"VARCHAR(30)",nullable:false,primaryKey:false,foreignKey:null,description:"공개 아이디"},
      {name:"created_at",dataType:"TIMESTAMPTZ",nullable:true,primaryKey:false},
    ]};
    const tableBlock={type:"TABLE",content:JSON.stringify(spec),language:null,title:null,displayOrder:2};
    const valid={data:{...post,blocks:[tableBlock]}};
    assert.equal(parsePostDetail(valid).blocks[0].type,"TABLE");
    const pointBoundary={schemaVersion:1,tableName:"😀".repeat(100),description:"",columns:[{name:"😀".repeat(100),dataType:"X".repeat(100),nullable:true,primaryKey:false,foreignKey:"",description:""}]};
    assert.equal(parsePostDetail({data:{...post,blocks:[{...tableBlock,content:JSON.stringify(pointBoundary),title:"😀".repeat(100)}]}}).blocks[0].type,"TABLE");
    const badSpecs=[
      {...spec,extra:true}, {...spec,schemaVersion:2}, {...spec,tableName:"  "},
      {...spec,columns:[...spec.columns,{...spec.columns[0],name:" ID "}]},
      {...spec,columns:[{...spec.columns[0],nullable:true}]},
      {...spec,columns:[{...spec.columns[0],extra:1}]},
      {...spec,tableName:"bad\u0000name"}, {...spec,tableName:"bad\ud800name"},
      {...spec,columns:[]}, {...spec,columns:Array.from({length:51},(_,i)=>({...spec.columns[1],name:`c${i}`}))},
      {...spec,columns:[{...spec.columns[1],name:"x".repeat(101)}]},
    ];
    for(const bad of badSpecs) assert.throws(()=>parsePostDetail({data:{...post,blocks:[{...tableBlock,content:JSON.stringify(bad)}]}}));
    for(const badBlock of [
      {...tableBlock,language:"SQL"}, {...tableBlock,title:"x".repeat(101)}, {...tableBlock,content:"x".repeat(50001)},
      {...tableBlock,content:"{"},
    ]) assert.throws(()=>parsePostDetail({data:{...post,blocks:[badBlock]}}));
  } finally {await new Promise(resolve=>server.close(resolve));}
});
