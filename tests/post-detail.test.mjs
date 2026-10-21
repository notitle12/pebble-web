import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import { createMockApi } from "../scripts/mock-post-api.mjs";
import { getPublicPost, parseArchitectureSpec, parsePostDetail, postHref } from "../src/features/post/api/post-list.ts";
test("공개 주소는 handle+slug 또는 BIGINT 글 번호이며 경로 주입을 거부",()=>{
  assert.equal(postHref("writer-1","note-1"),"/blogs/writer-1/posts/note-1");
  assert.equal(postHref("writer_name_","note-1"),"/blogs/writer_name_/posts/note-1");
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
    for(const block of [{...post.blocks[0],type:"UNSUPPORTED"},{...post.blocks[1],language:"BAD"},{...post.blocks[0],content:null}]) assert.throws(()=>parsePostDetail({data:{...post,blocks:[block]}}));
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
test("ARCHITECTURE 블록은 요소·경계·연결 계약을 검증하고 상세 응답과 함께 파싱한다",async()=>{
  const server=createMockApi();server.listen(0,"127.0.0.1");await once(server,"listening");
  const base=`http://127.0.0.1:${server.address().port}/api/v1`;
  try {
    const post=await getPublicPost("writer-1","note-1",base);
    const spec={schemaVersion:1,groups:[{id:"oracle",type:"ORACLE_CLOUD",label:"Production"},{id:"docker",type:"DOCKER",label:"Containers",parentId:"oracle"}],nodes:[{id:"browser",type:"CLIENT",label:"Browser"},{id:"api",type:"APP",label:"Spring API",groupId:"docker"},{id:"db",type:"DATABASE",label:"PostgreSQL",groupId:"docker"}],edges:[{id:"req",source:"browser",target:"api",label:"HTTPS"},{id:"query",source:"api",target:"db"}]};
    assert.deepEqual(parseArchitectureSpec(spec),spec);
    const extended={schemaVersion:1,groups:[{id:"custom-boundary",type:"CUSTOM",label:"RabbitMQ fleet"}],nodes:[{id:"custom-node",type:"CUSTOM",label:"Message queue",icon:"SERVER",position:{x:4000,y:0},groupId:"custom-boundary"}],edges:[]};
    assert.deepEqual(parseArchitectureSpec(extended),extended,"custom groups/cards and bounded positions/icons are supported while schema v1 remains intact");
    for(const invalid of [
      {...extended,nodes:[{...extended.nodes[0],icon:"CUSTOM"}]},
      {...extended,nodes:[{...extended.nodes[0],position:{x:4001,y:0}}]},
      {...extended,nodes:[{...extended.nodes[0],position:{x:0,y:1.5}}]},
      {...extended,nodes:[{...extended.nodes[0],position:{x:0,y:1,z:2}}]},
    ]) assert.throws(()=>parseArchitectureSpec(invalid));
    const maximumNodes=Array.from({length:30},(_,i)=>({id:`node-${i}`,type:"APP",label:`Node ${i}`}));
    const maximumPairs=[]; for(let source=0;source<30 && maximumPairs.length<60;source++) for(let target=0;target<30 && maximumPairs.length<60;target++) if(source!==target) maximumPairs.push({id:`edge-${maximumPairs.length}`,source:`node-${source}`,target:`node-${target}`});
    assert.equal(parseArchitectureSpec({schemaVersion:1,groups:[],nodes:maximumNodes,edges:maximumPairs}).edges.length,60);
    assert.equal(parseArchitectureSpec({schemaVersion:1,groups:[],nodes:maximumNodes.slice(0,2),edges:[{id:"forward",source:"node-0",target:"node-1"},{id:"reverse",source:"node-1",target:"node-0"}]}).edges.length,2,"directed cycles and reverse edges are allowed");
    const block={type:"ARCHITECTURE",content:JSON.stringify(spec),language:null,title:"Deployment",displayOrder:2};
    assert.equal(parsePostDetail({data:{...post,blocks:[block]}}).blocks[0].type,"ARCHITECTURE");
    const bad=[
      {...spec,extra:1},{...spec,schemaVersion:2},{...spec,groups:[...spec.groups,{id:"docker",type:"AWS",label:"duplicate"}]},
      {...spec,groups:[{id:"nested",type:"DOCKER",label:"nested",parentId:"docker"},...spec.groups]},
      {...spec,groups:[{...spec.groups[0],type:["ORACLE_CLOUD"]},...spec.groups.slice(1)]},
      {...spec,groups:[{id:"missing-parent",type:"DOCKER",label:"nested",parentId:"unknown"}]},
      {...spec,nodes:[...spec.nodes,{id:"bad id",type:"APP",label:"No"}]},
      {...spec,nodes:[...spec.nodes,{id:"oracle",type:"APP",label:"Global duplicate"}]},
      {...spec,nodes:[{...spec.nodes[0],groupId:"unknown"},...spec.nodes.slice(1)]},
      {...spec,edges:[...spec.edges,{id:"loop",source:"api",target:"api"}]},
      {...spec,edges:[...spec.edges,{id:"duplicate-pair",source:"browser",target:"api"}]},
      {...spec,edges:[...spec.edges,{id:"missing",source:"browser",target:"missing"}]},
      {...spec,groups:Array.from({length:11},(_,i)=>({id:`g${i}`,type:"AWS",label:`G${i}`}))},
      {...spec,nodes:Array.from({length:31},(_,i)=>({id:`n${i}`,type:"APP",label:`N${i}`}))},
      {...spec,edges:Array.from({length:61},(_,i)=>({id:`e${i}`,source:"browser",target:"api"}))},
      {...spec,nodes:[{...spec.nodes[0],label:"😀".repeat(101)},...spec.nodes.slice(1)]},
      {...spec,nodes:[{...spec.nodes[0],label:"bad\u0000label"},...spec.nodes.slice(1)]},
      {...spec,nodes:[{...spec.nodes[0],label:"bad\ud800label"},...spec.nodes.slice(1)]},
      {...spec,nodes:[{...spec.nodes[0],label:"\u001c"},...spec.nodes.slice(1)]},
    ];
    for(const invalid of bad) assert.throws(()=>parseArchitectureSpec(invalid));
    for(const invalidBlock of [{...block,language:"JSON"},{...block,title:"x".repeat(101)},{...block,content:"x".repeat(50001)},{...block,content:"{"}]) assert.throws(()=>parsePostDetail({data:{...post,blocks:[invalidBlock]}}));
    await assert.rejects(getPublicPost("writer-1","other",base,async()=>Response.json({data:{...post,blocks:[{...block,content:JSON.stringify({...spec,edges:[{id:"oops",source:"bad",target:"api"}]})}]}})),error=>error.kind==="response");
  } finally {await new Promise(resolve=>server.close(resolve));}
});
