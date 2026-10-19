import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {getPopularPosts} from '../src/features/post/api/post-list.ts';
import {getPopularProjects} from '../src/features/project/api/project-list.ts';
import {createMockApi,mockPosts,mockProjects} from '../scripts/mock-post-api.mjs';

const envelope=(content,total=content.length)=>({data:{content,page:0,size:20,totalElements:total,totalPages:Math.ceil(total/20),hasNext:total>20,hasPrevious:false}});
const loaders=[['posts',getPopularPosts,mockPosts],['projects',getPopularProjects,mockProjects]];

for (const [kind,load,fixtures] of loaders) {
 test(`${kind} popular feed requests exactly one ranked page, preserves ordering and thumbnails`,async()=>{
  let calls=0;
  const content=Array.from({length:20},(_,i)=>({...fixtures[i],likeCount:100-i,thumbnailUrl:'https://images.example/cover.webp'}));
  const result=await load('https://api.example/api/v1',async(url,init)=>{
   calls++;
   assert.equal(url.pathname,`/api/v1/${kind}/popular`);
   assert.deepEqual([...url.searchParams],[['page','0'],['size','20']]);
   assert.equal(init.credentials,'omit');assert.equal(init.cache,'no-store');
   assert.deepEqual(init.headers,{Accept:'application/json'});
   return Response.json(envelope(content,1041));
  });
  assert.equal(calls,1);assert.equal(result.hasNext,true);assert.equal(result.content.length,20);
  assert.deepEqual(result.content.map(row=>row.id),content.map(row=>row.id));
  assert.equal(result.content[0].thumbnailUrl,'https://images.example/cover.webp');
 });
 test(`${kind} popular feed distinguishes empty pages, malformed envelopes and unavailable APIs`,async()=>{
  assert.deepEqual((await load('https://api.example/api/v1',async()=>Response.json(envelope([])))).content,[]);
  for (const data of [{...envelope([]).data,page:1},{...envelope([]).data,size:3},{...envelope([]).data,totalPages:2},{...envelope([]).data,content:[{id:'bad'}]}]) {
   await assert.rejects(load('https://api.example/api/v1',async()=>Response.json({data})),error=>error.kind==='response');
  }
  await assert.rejects(load('https://api.example/api/v1',async()=>new Response('',{status:503})),error=>error.kind==='response');
 });
}

test('mock popularity endpoints rank the entire public dataset, exclude zero likes and preserve cover URLs',async()=>{
 const server=createMockApi();server.listen(0,'127.0.0.1');await once(server,'listening');
 try {
  const base=`http://127.0.0.1:${server.address().port}/api/v1`;
  const [posts,projects]=await Promise.all([getPopularPosts(base),getPopularProjects(base)]);
  for(const result of [posts,projects]) {
   assert.ok(result.content.length>3);
   assert.ok(result.content.every(row=>row.likeCount>0));
   for(let i=1;i<result.content.length;i++)assert.ok(result.content[i-1].likeCount>=result.content[i].likeCount);
  }
  assert.ok(posts.content.some(row=>row.id===mockPosts[20].id));
  assert.equal(projects.content.find(row=>row.id===mockProjects[1].id).thumbnailUrl,mockProjects[1].thumbnailUrl);
  assert.equal((await fetch(`${base}/projects/popular?lifecycleStatus=COMPLETED`)).status,400);
 } finally {await new Promise(resolve=>server.close(resolve));}
});

test('failure of one popular API does not prevent the other feed from completing',async()=>{
 const request=async url=>url.pathname.endsWith('/posts/popular')?new Response('',{status:503}):Response.json(envelope([{...mockProjects[1],likeCount:5}]));
 const [posts,projects]=await Promise.allSettled([getPopularPosts('https://api.example/api/v1',request),getPopularProjects('https://api.example/api/v1',request)]);
 assert.equal(posts.status,'rejected');assert.equal(projects.status,'fulfilled');
 assert.equal(projects.value.content[0].id,mockProjects[1].id);
});
