import assert from "node:assert/strict";
import { test } from "node:test";
import { MemberApiError } from "../src/lib/member-api.ts";
import { buildProjectSaveBody, emptyProject, projectEditorValue, validateProject } from "../src/features/project/project-editor-model.ts";
import { parseOwnProject, parseOwnProjects } from "../src/features/project/api/member-projects.ts";

const editor=(overrides={})=>({...emptyProject(),name:"Pebble",...overrides});
const ownData=(overrides={})=>({
  id:"10",name:"Pebble",summary:"A project",owner:{id:"7",nickname:"Owner"},tags:[{id:"3",name:"TypeScript",status:"ACTIVE"},{id:"4",name:"Legacy",status:"INACTIVE"}],
  lifecycleStatus:"IN_PROGRESS",publishedAt:null,createdAt:"2026-01-01T00:00:00Z",description:"Description",architectureDescription:"Architecture",executionInstructions:"Run it",
  startedOn:"2026-01-02",completedOn:null,features:[{id:"20",title:"Search",description:"Find items",displayOrder:0}],
  links:[{id:"30",linkType:"GITHUB",label:"Source",url:"https://example.com/repo",displayOrder:0}],visibilityStatus:"HIDDEN",isBlocked:false,...overrides,
});
const ownResponse=(overrides={})=>({data:ownData(overrides)});
const expectInvalid=fn=>assert.throws(fn,error=>error instanceof Error);
const expectResponseError=fn=>assert.throws(fn,error=>error instanceof MemberApiError&&error.code==="INVALID_RESPONSE");

test("프로젝트 이름·요약·각 본문 필드는 Unicode 코드포인트 경계와 잘못된 문자열을 검증한다",()=>{
  validateProject(editor({name:"😀".repeat(120),summary:"😀".repeat(500),description:"😀".repeat(20000),architectureDescription:"😀".repeat(20000),executionInstructions:"😀".repeat(10000)}));
  for(const bad of [
    {name:"😀".repeat(121)}, {name:"\ud800"}, {name:"\udc00"}, {name:"a\0b"}, {name:"  "},
    {summary:"x".repeat(501)}, {summary:"\ud800"}, {description:"x".repeat(20001)},
    {architectureDescription:"x".repeat(20001)}, {executionInstructions:"x".repeat(10001)},
  ]) expectInvalid(()=>validateProject(editor(bad)));
  assert.deepEqual(buildProjectSaveBody(editor({summary:"",description:"",architectureDescription:"",executionInstructions:""})).summary,null);
});

test("프로젝트 날짜는 실제 달력 날짜와 빈 값을 허용하고 잘못된 날짜를 거부한다",()=>{
  validateProject(editor({startedOn:"2024-02-29",completedOn:""}));
  for(const dates of [{startedOn:"2025-02-29"},{startedOn:"2026-04-31"},{completedOn:"2026-13-01"},{completedOn:"2026-1-01"},{startedOn:"2026-02-30"}]) expectInvalid(()=>validateProject(editor(dates)));
});

test("진행 상태와 태그 ID 및 중복 태그를 검증한다",()=>{
  validateProject(editor({lifecycleStatus:"COMPLETED",tagIds:["1","9223372036854775807"]}));
  expectInvalid(()=>validateProject(editor({lifecycleStatus:"PAUSED"})));
  for(const tagIds of [["01"],["9223372036854775808"],["1","1"]]) expectInvalid(()=>validateProject(editor({tagIds})));
});

test("기능 제목은 필수이고 기능 필드 길이와 Unicode를 확인한다",()=>{
  validateProject(editor({features:[{title:"😀".repeat(100),description:"😀".repeat(2000)}]}));
  for(const feature of [{title:"",description:""},{title:"  ",description:""},{title:"x".repeat(101),description:""},{title:"ok",description:"x".repeat(2001)},{title:"\ud800",description:""}]) expectInvalid(()=>validateProject(editor({features:[feature]})));
});

test("링크는 사용자 정보 없는 절대 HTTP(S) URL만 허용한다",()=>{
  for(const url of ["https://example.com/x","http://localhost:3000/","https://xn--bcher-kva.example/ok"]) validateProject(editor({links:[{linkType:"OTHER",label:"",url,displayOrder:0}]}));
  for(const url of ["https://user:secret@example.com","javascript:alert(1)","/relative/path","../relative","//example.com/path","https:\\\\example.com","https://example.com/a b","https://exa mple.com"]) expectInvalid(()=>validateProject(editor({links:[{linkType:"OTHER",label:"",url,displayOrder:0}]})));
  expectInvalid(()=>validateProject(editor({links:[{linkType:"SCRIPT",label:"Link",url:"https://example.com",displayOrder:0}]})));
});

test("변경되지 않은 배열은 PATCH에서 생략해 기존 항목 ID와 비활성 태그를 보존한다",()=>{
  const existing=parseOwnProject(ownResponse(),"7","10"),value=projectEditorValue(existing);
  const patch=buildProjectSaveBody(value,existing);
  assert.deepEqual(patch,{});
  assert.deepEqual(existing.features.map(f=>f.id),["20"]);
  assert.deepEqual(existing.links.map(l=>l.id),["30"]);
  assert.deepEqual(existing.tags.map(t=>t.status),["ACTIVE","INACTIVE"]);
});

test("문자열 필드 비우기는 null PATCH이고 일부 수정은 바뀐 필드만 보낸다",()=>{
  const existing=parseOwnProject(ownResponse(),"7","10"),value=projectEditorValue(existing);
  value.summary="";value.description="New description";
  assert.deepEqual(buildProjectSaveBody(value,existing),{summary:null,description:"New description"});
  assert.deepEqual(buildProjectSaveBody(projectEditorValue(existing),existing,"PUBLIC"),{visibilityStatus:"PUBLIC"});
});

test("배열이 바뀌면 해당 배열 전체를 교체하며 visibility와 차단 상태를 확인한다",()=>{
  const existing=parseOwnProject(ownResponse(),"7","10"),value=projectEditorValue(existing);
  value.tagIds=["3"];
  assert.deepEqual(buildProjectSaveBody(value,existing),{tagIds:["3"]});
  value.features=[{title:"New",description:""}];
  value.links=[{linkType:"DEPLOYMENT",label:"",url:"https://example.com/app",displayOrder:0}];
  const patch=buildProjectSaveBody(value,existing);
  assert.deepEqual(patch.tagIds,["3"]);
  assert.deepEqual(patch.features,[{title:"New",description:""}]);
  assert.deepEqual(patch.links,[{linkType:"DEPLOYMENT",label:null,url:"https://example.com/app",displayOrder:0}]);
  assert.equal("id" in patch.features[0],false);
  assert.throws(()=>buildProjectSaveBody(projectEditorValue(existing),{...existing,isBlocked:true,visibilityStatus:"HIDDEN"},"PUBLIC"),/차단된 프로젝트/);
});

test("본인 프로젝트 상세는 owner·visibility·isBlocked·expected ID와 태그 상태를 검증한다",()=>{
  const parsed=parseOwnProject(ownResponse(),"7","10");
  assert.equal(parsed.owner.id,"7");assert.equal(parsed.tags[1].status,"INACTIVE");assert.equal(parsed.isBlocked,false);
  expectResponseError(()=>parseOwnProject(ownResponse(),"8","10"));
  expectResponseError(()=>parseOwnProject(ownResponse({id:"11"}),"7","10"));
  expectResponseError(()=>parseOwnProject(ownResponse({isBlocked:"false"}),"7","10"));
  expectResponseError(()=>parseOwnProject(ownResponse({visibilityStatus:"PRIVATE"}),"7","10"));
  expectResponseError(()=>parseOwnProject(ownResponse({tags:[{id:"3",name:"A",status:"DELETED"}]}),"7","10"));
  expectResponseError(()=>parseOwnProject(ownResponse({tags:[{id:"3",name:"A",status:"ACTIVE"},{id:"3",name:"A duplicate",status:"INACTIVE"}]}),"7","10"));
});

test("본인 프로젝트 목록은 각 항목 owner와 isBlocked 및 중복 ID를 검증한다",()=>{
  const summary={id:"10",name:"Pebble",summary:"A project",owner:{id:"7",nickname:"Owner"},tags:[{id:"3",name:"TypeScript"}],lifecycleStatus:"IN_PROGRESS",publishedAt:null,createdAt:"2026-01-01T00:00:00Z",visibilityStatus:"HIDDEN",isBlocked:false};
  const response=data=>({data:{content:data,page:0,size:20,totalElements:data.length,totalPages:data.length?1:0,hasNext:false,hasPrevious:false}});
  assert.equal(parseOwnProjects(response([summary]),0,"7").content.length,1);
  expectResponseError(()=>parseOwnProjects(response([{...summary,owner:{...summary.owner,id:"8"}}]),0,"7"));
  expectResponseError(()=>parseOwnProjects(response([{...summary,isBlocked:0}]),0,"7"));
  expectResponseError(()=>parseOwnProjects(response([summary,{...summary}]),0,"7"));
});

test("링크의 Unicode 경로를 허용하고 잘못된 URI 퍼센트와 문자를 거부한다",()=>{
 validateProject(editor({links:[{linkType:"OTHER",label:"",url:"https://example.com/문서",displayOrder:0}]}));
 for(const url of ["https://example.com/%ZZ","https://example.com/<script>","https://한글.example/path"])expectInvalid(()=>validateProject(editor({links:[{linkType:"OTHER",label:"",url,displayOrder:0}]})));
});
