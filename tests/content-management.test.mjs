import test from "node:test";
import assert from "node:assert/strict";
import {contentPath,postPosition,confirmDeletion,movePostRow,removeManagedRow} from "../src/features/content/management-model.ts";
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

test("드래그 순서는 대상의 전역 위치로 이동하고 원본과 다른 페이지 위치는 보존한다",()=>{
 const rows=[{id:"1",displayOrder:20},{id:"2",displayOrder:21},{id:"3",displayOrder:22}];
 const down=movePostRow(rows,"1","3");assert.equal(down.displayOrder,22);assert.deepEqual(down.items.map(p=>p.id),["2","3","1"]);assert.deepEqual(down.items.map(p=>p.displayOrder),[20,21,22]);
 const up=movePostRow(rows,"3","1");assert.equal(up.displayOrder,20);assert.deepEqual(up.items.map(p=>p.id),["3","1","2"]);assert.equal(rows[0].id,"1");
 assert.equal(movePostRow(rows,"1","1"),null);assert.equal(movePostRow(rows,"missing","1"),null);
});
test("게시판 내부 이동은 전체 글 순서를 변경하지 않는다",()=>{
 const rows=[{id:"1",displayOrder:8,boardDisplayOrder:0},{id:"2",displayOrder:2,boardDisplayOrder:1},{id:"3",displayOrder:5,boardDisplayOrder:2}];
 const result=movePostRow(rows,"1","3",true);
 assert.equal(result.displayOrder,2);assert.deepEqual(result.items.map(p=>p.id),["2","3","1"]);
 assert.deepEqual(result.items.map(p=>p.boardDisplayOrder),[0,1,2]);
 for(const row of result.items)assert.equal(row.displayOrder,rows.find(p=>p.id===row.id).displayOrder);
 assert.throws(()=>movePostRow([{id:"1",displayOrder:0},{id:"2",displayOrder:1}],"1","2",true));
});

test("삭제 시 현재 페이지와 페이지 수·전역 및 같은 게시판 순서를 함께 갱신한다",()=>{
 const source={content:[{id:'a',displayOrder:20,boardId:'b',boardDisplayOrder:3},{id:'c',displayOrder:22,boardId:'other',boardDisplayOrder:7},{id:'d',displayOrder:23,boardId:'b',boardDisplayOrder:4}],page:1,size:20,totalElements:41,totalPages:3,hasNext:true,hasPrevious:true};
 const next=removeManagedRow(source,'a');
 assert.deepEqual(next.content.map(p=>[p.id,p.displayOrder,p.boardDisplayOrder]),[['c',21,7],['d',22,3]]);
 assert.equal(next.totalElements,40);assert.equal(next.totalPages,2);assert.equal(next.hasNext,false);assert.equal(next.hasPrevious,true);assert.equal(source.content.length,3);assert.equal(source.content[2].displayOrder,23);
});
test("공개 필터에서 빠진 행은 실제 순서를 바꾸지 않고 마지막 페이지 경계를 계산한다",()=>{
 const source={content:[{id:'a',displayOrder:3},{id:'b',displayOrder:8}],page:0,size:20,totalElements:2,totalPages:1,hasNext:false,hasPrevious:false};
 const next=removeManagedRow(source,'a',false);assert.equal(next.content[0].displayOrder,8);assert.equal(next.totalElements,1);
 const empty=removeManagedRow(next,'b');assert.equal(empty.totalPages,0);assert.equal(empty.totalElements,0);assert.deepEqual(empty.content,[]);
 assert.equal(removeManagedRow(source,'missing'),source);
 const last=removeManagedRow({...source,content:[{id:'a',displayOrder:20}],page:1,totalElements:21,totalPages:2,hasPrevious:true},'a');assert.equal(last.totalPages,1);assert.equal(Math.min(last.page,last.totalPages-1),0);
});
