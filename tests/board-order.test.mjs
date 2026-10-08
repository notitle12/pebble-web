import test from 'node:test';
import assert from 'node:assert/strict';
import {boardMove} from '../src/features/board/api/board-order.ts';
const row=(id,name,parentId=null,displayOrder=0,children=[])=>({id,name,parentId,displayOrder,children});
const tree=[row('1','개발',null,0,[row('2','Java','1',0,[row('3','기본','2')])]),row('4','일상',null,1),row('5','기록',null,2)];
test('같은 위치는 쓰지 않고 루트 순서 변경은 정확한 정수 순서를 저장한다',()=>{
 assert.deepEqual(boardMove(tree,'4',{id:'1',position:'after'}),[]);
 assert.deepEqual(boardMove(tree,'5',{id:'1',position:'before'}),[{id:'5',parentId:null,displayOrder:0},{id:'1',parentId:null,displayOrder:1},{id:'4',parentId:null,displayOrder:2}]);
});
test('하위 이동과 다시 루트로 이동할 때 부모와 대상 형제 순서를 함께 계산한다',()=>{
 assert.deepEqual(boardMove(tree,'4',{id:'1',position:'inside'}),[{id:'4',parentId:'1',displayOrder:1}]);
 assert.deepEqual(boardMove(tree,'3',{id:'4',position:'after'}),[{id:'3',parentId:null,displayOrder:2},{id:'5',parentId:null,displayOrder:3}]);
});
test('자기 자신·순환·서브트리 깊이 초과·같은 부모의 동일 이름을 차단한다',()=>{
 for(const [source,target] of [['1','1'],['1','3'],['4','3']])assert.throws(()=>boardMove(tree,source,{id:target,position:'inside'}));
 const conflict=[row('1','상위',null,0,[row('2','기록','1')]),row('4','기록',null,1)];
 assert.throws(()=>boardMove(conflict,'4',{id:'1',position:'inside'}));
 assert.throws(()=>boardMove(tree,'404',{id:'1',position:'before'}));
});
