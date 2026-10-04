import assert from "node:assert/strict";
import {test} from "node:test";
import {readLinkedProject} from "../src/features/post/api/linked-project.ts";
import {parsePostDetail} from "../src/features/post/api/post-list.ts";
import {createMockApi} from "../scripts/mock-post-api.mjs";
import {once} from "node:events";

const projectId="721389012345680000";
const project={
  id:projectId,name:"Pebble",summary:"A project",owner:{id:"721389012345680001",nickname:"Owner"},tags:[],
  lifecycleStatus:"IN_PROGRESS",publishedAt:null,createdAt:"2026-01-01T00:00:00Z",
  description:null,architectureDescription:null,executionInstructions:null,startedOn:null,completedOn:null,features:[],links:[],
};

test("연결 프로젝트 ID가 없거나 BIGINT 형식이 아니면 요청하지 않는다",async()=>{
  for(const id of [null,undefined]) {
    let calls=0;
    assert.deepEqual(await readLinkedProject(id,"https://api.example/api/v1",async()=>{calls++;throw new Error("unexpected request");}),{status:"absent"});
    assert.equal(calls,0);
  }
  for(const id of ["","01","9223372036854775808","../1",1]) {
    let calls=0;
    assert.deepEqual(await readLinkedProject(id,"https://api.example/api/v1",async()=>{calls++;throw new Error("unexpected request");}),{status:"error"});
    assert.equal(calls,0);
  }
});

test("연결 프로젝트 공개 조회는 Guest 옵션을 사용하고 응답 무결성을 확인한다",async()=>{
  let calls=0;
  const result=await readLinkedProject(projectId,"https://api.example/api/v1",async(url,init)=>{
    calls++;
    assert.equal(String(url),`https://api.example/api/v1/projects/${projectId}`);
    assert.equal(init.cache,"no-store");
    assert.equal(init.credentials,"omit");
    assert.deepEqual(init.headers,{Accept:"application/json"});
    assert.equal("authorization" in init.headers,false);
    assert.equal("cookie" in init.headers,false);
    return Response.json({data:project});
  });
  assert.equal(calls,1);
  assert.deepEqual(result,{status:"visible",project:{...project,description:null,architectureDescription:null,executionInstructions:null}});

  assert.deepEqual(await readLinkedProject(projectId,"https://api.example/api/v1",async()=>new Response(null,{status:404})),{status:"absent"});
  for(const request of [
    async()=>new Response("failure",{status:500}),
    async()=>{throw new TypeError("network failure");},
    async()=>new Response("not json",{status:200}),
    async()=>Response.json({data:{...project,id:"721389012345680002"}}),
  ]) assert.deepEqual(await readLinkedProject(projectId,"https://api.example/api/v1",request),{status:"error"});
});

test("게시글 상세는 프로젝트 ID를 생략·null로 두거나 유효한 문자열로 연결할 수 있다",async()=>{
  const server=createMockApi();server.listen(0,"127.0.0.1");await once(server,"listening");
  const base=`http://127.0.0.1:${server.address().port}/api/v1`;
  try {
    const response=await (await fetch(`${base}/blogs/writer-1/posts/note-1`)).json();
    const data=response.data;
    assert.equal(parsePostDetail({data:{...data,projectId:undefined}}).projectId,undefined);
    assert.equal(parsePostDetail({data:{...data,projectId:null}}).projectId,null);
    assert.equal(parsePostDetail({data:{...data,projectId}}).projectId,projectId);
    for(const invalid of [1,"","01","9223372036854775808","../1",{},[]]) {
      assert.throws(()=>parsePostDetail({data:{...data,projectId:invalid}}));
    }
  } finally {await new Promise(resolve=>server.close(resolve));}
});
