import test from 'node:test';
import assert from 'node:assert/strict';
import {getProjectOrderPosts,getProjectOrderSnapshot,saveProjectPostOrder,reorderProjectPosts,sameProjectOrder,projectPostDropTarget} from '../src/features/project/api/project-post-order.ts';
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
 assert.equal(calls,0);
});
test('local permutations perform no writes; Save sends the complete original and desired orders once',async()=>{
 const original=['2','3','4','5'];let draft=[...original],calls=[];
 draft=reorderProjectPosts(draft,0,3);draft=reorderProjectPosts(draft,1,0);draft=reorderProjectPosts(draft,2,1);
 assert.equal(calls.length,0);assert.deepEqual(original,['2','3','4','5']);assert.deepEqual([...draft].sort(),original);
 assert.equal(await saveProjectPostOrder('5',original,draft,async(...args)=>{calls.push(args);return null;}),true);
 assert.deepEqual(calls,[['/members/me/projects/5/posts/order',{method:'PUT',body:{expectedPostIds:original,postIds:draft}}]]);
 assert.equal(await saveProjectPostOrder('5',draft,draft,async()=>{throw new Error('unchanged save');}),false);
 assert.equal(sameProjectOrder(original,draft),false);
});
test('save rejects invalid permutations before requesting and never retries conflicts or uncertain responses',async()=>{
 let calls=0;const request=async()=>{calls++;return null;};
 for(const [a,b] of [[['2'],['3']],[['2','2'],['2','2']],[['2','3'],['2']],[['bad'],['bad']],[Array(10001).fill('2'),[]]])await assert.rejects(saveProjectPostOrder('5',a,b,request));
 assert.equal(calls,0);
 for(const error of [Object.assign(new Error('conflict'),{status:409,code:'POST_ORDER_CONFLICT'}),new Error('lost connection')]){
  await assert.rejects(saveProjectPostOrder('5',['2','3'],['3','2'],async()=>{calls++;throw error;}),e=>e===error);
 }
 assert.equal(calls,2);await assert.rejects(saveProjectPostOrder('5',['2','3'],['3','2'],async()=>({data:{}})));
});
test('loads a complete snapshot once across pages, preserving private rows',async()=>{
 const posts=Array.from({length:21},(_,i)=>post(String(i+2)));const calls=[];
 const rows=await getProjectOrderSnapshot('5','1',async path=>{calls.push(path);const page=Number(new URL(path,'https://test').searchParams.get('page'));return result(posts.slice(page*20,page*20+20),page,21);});
 assert.deepEqual(rows,posts);assert.equal(calls.length,2);
});
test('rejects excessive, inconsistent, incomplete or duplicate snapshots',async()=>{
 const first=Array.from({length:20},(_,i)=>post(String(i+2)));
 let calls=0;await assert.rejects(getProjectOrderSnapshot('5','1',async()=>{calls++;return result(first,0,10001);}));assert.equal(calls,1);
 for(const last of [result([post('99')],1,22),result([first[0]],1,21),result([],1,21)]){
  await assert.rejects(getProjectOrderSnapshot('5','1',async path=>path.includes('page=0')?result(first,0,21):last));
 }
 await assert.rejects(getProjectOrderSnapshot('5','1',async()=>result(first.slice(0,19),0,20)));
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
