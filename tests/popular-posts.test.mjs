import test from 'node:test';
import assert from 'node:assert/strict';
import {loadPopularPosts,comparePopularPosts} from '../src/features/post/api/popular-posts.ts';
import {getPublicBlogPosts} from '../src/features/post/api/public-blog.ts';
const post=(id,likes,date='2026-10-01T00:00:00Z')=>({id:String(id),urlKey:`entry-${id}`,title:`글 ${id}`,summary:null,author:{id:'100',handle:'owner-test',nickname:'작성자',blogName:null},tags:[],likeCount:likes,publishedAt:date,createdAt:date});
const page=(content,n=0,total=content.length)=>({content,page:n,size:20,totalElements:total,totalPages:Math.ceil(total/20),hasNext:n+1<Math.ceil(total/20),hasPrevious:n>0});
test('전체 페이지에서 공감 상위 세 글을 선택하고 최신순·ID 동점을 안정적으로 처리한다',async()=>{
 const rows=Array.from({length:41},(_,i)=>post(i+1,i));
 rows[40]=post(41,500);rows[39]=post(40,100,'2026-10-03T00:00:00Z');rows[38]=post(39,100,'2026-10-02T00:00:00Z');
 const seen=[];
 const result=await loadPopularPosts(n=>{seen.push(n);return Promise.resolve(page(rows.slice(n*20,n*20+20),n,rows.length));});
 assert.deepEqual(seen,[0,1,2]);assert.deepEqual(result.content.map(p=>p.id),['41','40','39']);
 assert.equal(rows[0].id,'1');
 assert.deepEqual([post('9007199254740994',1),post('9007199254740995',1)].sort(comparePopularPosts).map(p=>p.id),['9007199254740995','9007199254740994']);
});
test('공개 API 페이지 검증과 작성자 범위를 유지하면서 오래된 인기 글을 가져온다',async()=>{
 const rows=Array.from({length:21},(_,i)=>post(i+1,i===20?500:0));const seen=[];
 const request=async(input,init)=>{const url=new URL(input);const n=Number(url.searchParams.get('page'));seen.push(n);assert.equal(init.credentials,'omit');assert.equal(init.cache,'no-store');return Response.json({data:page(rows.slice(n*20,n*20+20),n,rows.length)});};
 const result=await loadPopularPosts(n=>getPublicBlogPosts('owner-test',n,'https://api.example/api/v1',request));
 assert.deepEqual(seen,[0,1]);assert.equal(result.content[0].id,'21');
});
test('빈 목록·공감 누락·중복 페이지를 처리하고 후속 페이지 실패를 빈 상태로 숨기지 않는다',async()=>{
 assert.deepEqual((await loadPopularPosts(async()=>page([]))).content,[]);
 assert.ok(comparePopularPosts({...post(1,0),likeCount:undefined},post(2,1))>0);
 const rows=[post(1,10),post(2,2)];
 assert.deepEqual((await loadPopularPosts(async n=>page(rows,n,21))).content.map(p=>p.id),['1','2']);
 await assert.rejects(loadPopularPosts(async n=>{if(n)throw new Error('offline');return page(rows,0,21);}),/offline/);
});
test('소유자 세션이 교체되면 후속 비공개 페이지 요청을 중단한다',async()=>{
 let calls=0;
 await assert.rejects(loadPopularPosts(async()=>{calls++;return page([post(1,5)],0,40);},()=>false),/취소/);
 assert.equal(calls,1);
});

test('인기 글은 후속 페이지를 최대 세 개씩 병렬 조회하고 전체 상위 결과를 유지한다',async()=>{
 const releases=new Map(),seen=[];let running=0,max=0;
 const pending=loadPopularPosts(async n=>{
  seen.push(n);
  if(n){running++;max=Math.max(max,running);await new Promise(resolve=>releases.set(n,resolve));running--;}
  return page([post(n+1,n)],n,121);
 });
 for(let tick=0;tick<8;tick++)await Promise.resolve();
 assert.deepEqual(seen,[0,1,2,3]);assert.equal(max,3);
 for(const n of [3,1,2])releases.get(n)();
 for(let tick=0;tick<12;tick++)await Promise.resolve();
 assert.deepEqual(seen,[0,1,2,3,4,5,6]);
 for(const n of [6,4,5])releases.get(n)();
 assert.deepEqual((await pending).content.map(row=>row.id),['7','6','5']);assert.equal(max,3);
});
