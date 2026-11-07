import test from 'node:test';
import assert from 'node:assert/strict';
import {getPopularPosts} from '../src/features/post/api/post-list.ts';
import {getPopularPublicBlogPosts} from '../src/features/post/api/public-blog.ts';
import {ownBlogPopularPostsPath,parseOwnerBlogPopularPosts} from '../src/features/post/api/owner-blog-posts.ts';

const post=(id,extra={})=>({id:String(id),urlKey:`entry-${id}`,title:`글 ${id}`,summary:null,author:{id:'100',handle:'owner-test',nickname:'작성자',blogName:null},tags:[],likeCount:0,publishedAt:'2026-10-01T00:00:00Z',createdAt:'2026-10-01T00:00:00Z',...extra});
const page=(content,size=10)=>({content,page:0,size,totalElements:content.length,totalPages:content.length?1:0,hasNext:false,hasPrevious:false});
const response=data=>Response.json({data});

test('전역 인기 글은 서버 순위 API 한 번으로 최대 10개를 요청한다',async()=>{
 const rows=Array.from({length:10},(_,index)=>post(index+1,{likeCount:10-index}));
 const calls=[];
 const result=await getPopularPosts('https://api.example/api/v1',async(input,init)=>{
  const url=new URL(input);calls.push(url);
  assert.equal(init.credentials,'omit');assert.equal(init.cache,'no-store');
  return response(page(rows));
 });
 assert.equal(calls.length,1);assert.equal(calls[0].pathname,'/api/v1/posts/popular');
 assert.equal(calls[0].searchParams.get('page'),'0');assert.equal(calls[0].searchParams.get('size'),'10');
 assert.deepEqual(result.content.map(row=>row.id),rows.map(row=>row.id));
});

test('공개 블로그 인기 글은 블로그 전용 서버 순위 경로를 사용하고 작성자를 검증한다',async()=>{
 const rows=[post('9007199254740995',{likeCount:5}),post('9007199254740994',{likeCount:0})];
 let calls=0;
 const result=await getPopularPublicBlogPosts('owner-test','https://api.example/api/v1',async(input,init)=>{
  calls++;const url=new URL(input);
  assert.equal(url.pathname,'/api/v1/blogs/owner-test/popular-posts');
  assert.equal(url.searchParams.get('size'),'10');assert.equal(init.credentials,'omit');
  return response(page(rows));
 });
 assert.equal(calls,1);assert.deepEqual(result.content.map(row=>row.id),rows.map(row=>row.id));
 await assert.rejects(getPopularPublicBlogPosts('owner-test','https://api.example/api/v1',async()=>response(page([post(1,{author:{...post(1).author,handle:'other-blog'}})]))));
});

test('본인 블로그 인기 글은 private 전용 API와 10개 DTO 검증을 사용한다',()=>{
 assert.equal(ownBlogPopularPostsPath(),'/members/me/blog/posts/popular?page=0&size=10');
 const rows=[post(1,{visibilityStatus:'HIDDEN',isBlocked:false,draft:false,displayOrder:0})];
 assert.deepEqual(parseOwnerBlogPopularPosts({data:page(rows)}, '100','owner-test').content.map(row=>row.id),['1']);
 assert.throws(()=>parseOwnerBlogPopularPosts({data:page([post(1,{isBlocked:true,visibilityStatus:'HIDDEN',draft:false,displayOrder:0})])}, '100','owner-test'));
});
