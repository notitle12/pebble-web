import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {getPopularPosts} from '../src/features/post/api/post-list.ts';
import {getPopularProjects} from '../src/features/project/api/project-list.ts';
import {createMockApi,mockPosts,mockProjects} from '../scripts/mock-post-api.mjs';

const envelope=(content,total=content.length,size=20)=>({data:{content,page:0,size,totalElements:total,totalPages:Math.ceil(total/size),hasNext:total>size,hasPrevious:false}});
const loaders=[['posts',getPopularPosts,mockPosts],['projects',getPopularProjects,mockProjects]];

for (const [kind,load,fixtures] of loaders) {
 test(`${kind} popular feed requests exactly one ranked page, preserves ordering and thumbnails`,async()=>{
  let calls=0;
  const size=kind==='posts'?10:20;
  const content=Array.from({length:size},(_,i)=>({...fixtures[i],likeCount:100-i,thumbnailUrl:'https://images.example/cover.webp'}));
  const result=await load('https://api.example/api/v1',async(url,init)=>{
   calls++;
   assert.equal(url.pathname,`/api/v1/${kind}/popular`);
   assert.deepEqual([...url.searchParams],[['page','0'],['size',String(size)]]);
   assert.equal(init.credentials,'omit');assert.equal(init.cache,'no-store');
   assert.deepEqual(init.headers,{Accept:'application/json'});
   return Response.json(envelope(content,1041,size));
  });
  assert.equal(calls,1);assert.equal(result.hasNext,true);assert.equal(result.content.length,size);
  assert.deepEqual(result.content.map(row=>row.id),content.map(row=>row.id));
  assert.equal(result.content[0].thumbnailUrl,'https://images.example/cover.webp');
 });
 test(`${kind} popular feed distinguishes empty pages, malformed envelopes and unavailable APIs`,async()=>{
  const size=kind==='posts'?10:20;
  assert.deepEqual((await load('https://api.example/api/v1',async()=>Response.json(envelope([],0,size)))).content,[]);
  for (const data of [{...envelope([],0,size).data,page:1},{...envelope([],0,size).data,size:3},{...envelope([],0,size).data,totalPages:2},{...envelope([],0,size).data,content:[{id:'bad'}]}]) {
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
  assert.ok(posts.content.some(row=>row.id===mockPosts[18].id));
  assert.ok(!posts.content.some(row=>row.id===mockPosts[20].id));
  assert.equal(projects.content.find(row=>row.id===mockProjects[1].id).thumbnailUrl,mockProjects[1].thumbnailUrl);
  assert.equal((await fetch(`${base}/posts/popular?page=0&size=20`)).status,200);
  assert.equal((await fetch(`${base}/posts/popular?page=0&size=101`)).status,400);
  const blogPopular=await fetch(`${base}/blogs/writer-5/popular-posts?page=0&size=10`).then(response=>response.json());
  assert.equal(blogPopular.data.totalElements,3);assert.ok(blogPopular.data.content.every(row=>row.likeCount===0));
  assert.equal((await fetch(`${base}/blogs/writer-5/popular-posts?size=11`)).status,400);
  assert.equal((await fetch(`${base}/projects/popular?lifecycleStatus=COMPLETED`)).status,400);
 } finally {await new Promise(resolve=>server.close(resolve));}
});

test('failure of one popular API does not prevent the other feed from completing',async()=>{
 const request=async url=>url.pathname.endsWith('/posts/popular')?new Response('',{status:503}):Response.json(envelope([{...mockProjects[1],likeCount:5}]));
 const [posts,projects]=await Promise.allSettled([getPopularPosts('https://api.example/api/v1',request),getPopularProjects('https://api.example/api/v1',request)]);
 assert.equal(posts.status,'rejected');assert.equal(projects.status,'fulfilled');
 assert.equal(projects.value.content[0].id,mockProjects[1].id);
});
