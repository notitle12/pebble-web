import test from 'node:test';
import assert from 'node:assert/strict';
import {getProjectOrderPosts,moveProjectPost,projectPostMoveTarget,projectPostDropTarget} from '../src/features/project/api/project-post-order.ts';
const post=(id='2',changes={})=>({id,urlKey:id,title:'연결된 글',summary:null,author:{id:'1',handle:'pebble',nickname:'조약돌',blogName:null},tags:[],publishedAt:null,createdAt:'2026-10-22T00:00:00Z',visibilityStatus:'HIDDEN',isBlocked:true,...changes});
const result=(content=[post()],page=0,total=content.length)=>({data:{content,page,size:20,totalElements:total,totalPages:Math.ceil(total/20),hasPrevious:page>0,hasNext:page+1<Math.ceil(total/20)}});
test('owner list keeps API order and hidden or blocked posts without requiring global displayOrder',async()=>{
 const calls=[];const data=await getProjectOrderPosts('5',0,'1',async path=>{calls.push(path);return result([post('9'),post('2',{visibilityStatus:'PUBLIC',isBlocked:false})]);});
 assert.deepEqual(calls,['/members/me/projects/5/posts?page=0&size=20']);assert.deepEqual(data.content.map(row=>row.id),['9','2']);assert.equal(data.content[0].isBlocked,true);
});
test('rejects unrelated owners, duplicate posts and absent owner status',async()=>{
 for(const rows of [[post('2',{author:{id:'3',handle:'pebble',nickname:'다른 사람',blogName:null}})],[post(),post()],[post('2',{visibilityStatus:undefined})],[post('2',{isBlocked:undefined})]])await assert.rejects(getProjectOrderPosts('5',0,'1',async()=>result(rows)));
});
test('invalid IDs and pages never issue a request',async()=>{
 let calls=0;const request=async()=>{calls++;return result();};
 for(const args of [['bad',0,'1'],['5',-1,'1'],['5',1.5,'1'],['5',0,'bad']])await assert.rejects(getProjectOrderPosts(...args,request));
 for(const args of [['bad','2',0],['5','bad',0],['5','2',-1],['5','2',1.5],['5','2',2147483648]])await assert.rejects(moveProjectPost(...args,request));
 assert.equal(calls,0);
});
test('moves to an absolute index and requires204 response without automatic mutation retries',async()=>{
 const calls=[];await moveProjectPost('5','2',20,async(...args)=>{calls.push(args);return null;});
 assert.deepEqual(calls,[['/members/me/projects/5/posts/2/order',{method:'PATCH',body:{displayOrder:20}}]]);
 let attempts=0;await assert.rejects(moveProjectPost('5','2',0,async()=>{attempts++;throw new Error('connection lost');}));assert.equal(attempts,1);
 await assert.rejects(moveProjectPost('5','2',0,async()=>({data:{}})));
});
test('up/down boundaries span pages and count hidden posts in the absolute index',()=>{
 const first={...result(Array.from({length:20},(_,i)=>post(String(i+2))),0,21).data};
 assert.equal(projectPostMoveTarget(first,0,-1),null);assert.equal(projectPostMoveTarget(first,19,1),20);
 const second=result([post('99')],1,21).data;assert.equal(projectPostMoveTarget(second,0,-1),19);assert.equal(projectPostMoveTarget(second,0,1),null);assert.equal(projectPostMoveTarget(second,1,-1),null);
});

test('drag gaps account for removal, no-op drops and page boundaries',()=>{
 assert.equal(projectPostDropTarget(0,3,5),2);
 assert.equal(projectPostDropTarget(3,1,5),1);
 assert.equal(projectPostDropTarget(2,2,5),null);
 assert.equal(projectPostDropTarget(2,3,5),null);
 assert.equal(projectPostDropTarget(0,21,21),20);
 assert.equal(projectPostDropTarget(20,19,21),19);
 for(const args of [[-1,0,3],[3,0,3],[0,4,3],[0,-1,3],[0,0,0],[0,1.5,3]])assert.equal(projectPostDropTarget(...args),null);
});
