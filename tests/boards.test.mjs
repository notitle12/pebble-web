import test from "node:test";
import assert from "node:assert/strict";
import {parseBoards,parseBoardWrite,flattenBoards,boardInput,getBoardPosts} from "../src/features/board/api/boards.ts";
import {blogHref} from "../src/features/post/api/public-blog.ts";
import {buildPostSaveBody,createEditorBlock,editorValueFromPost} from "../src/features/post/post-editor-model.ts";
const leaf=(id,parentId=null,children=[])=>({id,parentId,name:"폴더",displayOrder:0,children});
test("폴더 트리는 3단계·중복 ID·부모 관계·BIGINT 및 순서를 검증한다",()=>{
 const tree=parseBoards({data:[leaf("10",null,[leaf("11","10",[leaf("12","11")])])]},true);assert.equal(flattenBoards(tree)[2].depth,2);
 for(const data of [[leaf("10"),leaf("10")],[leaf("01")],[leaf("10",null,[leaf("11",null)])],[leaf("10",null,[leaf("11","10",[leaf("12","11",[leaf("13","12")])])])]])assert.throws(()=>parseBoards({data},true));
 assert.deepEqual(parseBoards({data:[leaf("9007199254740993"),leaf("9007199254740992")]}).map(x=>x.id),["9007199254740992","9007199254740993"]);
});
test("폴더 입력과 공개 URL은 올바른 문자·순서·경로 조건을 따른다",()=>{
 assert.equal(boardInput("🌱".repeat(50),null,0).name.length,100);
 for(const name of [" ","x".repeat(51),"\u0000","\ud800"])assert.throws(()=>boardInput(name,null,0));
 for(const order of [-1,1.5,2147483648])assert.throws(()=>boardInput("폴더",null,order));
 assert.equal(blogHref("writer-1",2,"9007199254740993"),"/blogs/writer-1?view=posts&boardId=9007199254740993&page=2");
 assert.throws(()=>blogHref("writer-1",0,"../1"));
});
test("글 폴더 연결은 복원·미변경 생략·변경·null 해제 계약을 따른다",()=>{
 const value={title:"글",summary:"",blocks:[createEditorBlock()]},existing={visibilityStatus:"PUBLIC",isBlocked:false,boardId:"100"};
 assert.equal(buildPostSaveBody({...value,boardId:"100"}).boardId,"100");assert.equal("boardId" in buildPostSaveBody({...value,boardId:"100"},existing),false);
 assert.equal(buildPostSaveBody({...value,boardId:null},existing).boardId,null);assert.equal(buildPostSaveBody({...value,boardId:"200"},existing).boardId,"200");
 assert.throws(()=>buildPostSaveBody({...value,boardId:"0"}));
 assert.equal(editorValueFromPost({...value,boardId:"100",tags:[],blocks:[]}).boardId,"100");
});
test("폴더별 글 조회는 Guest 요청과 직접 소유자 응답을 검증한다",async()=>{
 let called=0;
 const data={content:[],page:0,size:20,totalElements:0,totalPages:0,hasNext:false,hasPrevious:false};
 const result=await getBoardPosts("10","20",0,"https://api.example/api/v1",async(url,options)=>{called++;assert.equal(String(url),"https://api.example/api/v1/members/10/boards/20/posts?page=0&size=20");assert.equal(options.credentials,"omit");return Response.json({data});});
 assert.equal(result.totalElements,0);assert.equal(called,1);
});

test("폴더 저장 응답은 ID와 부모 정보를 검증한다",()=>{
 const data={id:"10",name:"폴더",parentId:"20",displayOrder:0};assert.equal(parseBoardWrite({data},"10").parentId,"20");
 assert.throws(()=>parseBoardWrite({data},"11"));assert.throws(()=>parseBoardWrite({data:{...data,parentId:undefined}}));
});
