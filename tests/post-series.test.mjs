import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePostSeries,parsePostSeriesList,getPublicPostSeries,getPublicPostSeriesDetail,getPublicPostSeriesPosts,getMemberPostSeriesPosts,publicPostSeriesHref,validatePostSeriesInput} from '../src/features/post/api/post-series.ts';
import {parseOwnPosts} from '../src/features/post/api/member-posts.ts';
import {parsePostPage,parsePublicPostPage} from '../src/features/post/api/post-list.ts';

const id='721389012345678901',handle='pebble-dev';
const series={id,name:'시리즈 🌱',description:'설명',postCount:1,createdAt:'2026-11-08T00:00:00Z',updatedAt:'2026-11-08T00:00:00Z'};
const post=(extra={})=>({id:'721389012345678902',seriesId:id,urlKey:'spring-note',title:'기록',summary:null,author:{id:'721389012345678903',handle,nickname:'작성자',blogName:null},tags:[],publishedAt:'2026-11-08T00:00:00Z',createdAt:'2026-11-08T00:00:00Z',...extra});
const ownPost=(extra={})=>post({visibilityStatus:'PUBLIC',isBlocked:false,draft:false,displayOrder:0,seriesDisplayOrder:0,...extra});
const page=(content,pageNo=0,total=content.length)=>({data:{content,page:pageNo,size:20,totalElements:total,totalPages:Math.ceil(total/20),hasNext:pageNo+1<Math.ceil(total/20),hasPrevious:pageNo>0}});

test('Series DTO validates IDs, Unicode lengths, counts, and timestamps',()=>{
 assert.deepEqual(parsePostSeries({data:series}),series);
 assert.equal(parsePostSeriesList({data:[series]}).length,1);
 assert.throws(()=>parsePostSeriesList({data:[series,series]}));
 for(const invalid of [{...series,id:'0'},{...series,name:' '},{...series,name:'x'.repeat(101)},{...series,description:'x'.repeat(1001)},{...series,postCount:-1},{...series,createdAt:'bad'}])assert.throws(()=>parsePostSeries(invalid));
 assert.equal(validatePostSeriesInput('한글🌱','설명'),null);
 assert.ok(validatePostSeriesInput('','설명'));
 assert.ok(validatePostSeriesInput('시리즈','x'.repeat(1001)));
 assert.ok(validatePostSeriesInput('시리즈\n이름','설명'));
 assert.equal(validatePostSeriesInput('🌱'.repeat(100),'여러\n줄 설명'),null);
 assert.equal(publicPostSeriesHref(handle,id,3),`/blogs/${handle}?view=series&seriesId=${id}&page=3`);
 assert.throws(()=>publicPostSeriesHref(handle,undefined,1));
});

test('public series reads use only guest no-store endpoints and page through series posts',async()=>{
 const seen=[];
 const request=async(url,options)=>{seen.push([String(url),options]);const path=new URL(url).pathname;
  if(path.endsWith('/series'))return Response.json({data:[series]});
  if(path.endsWith(`/series/${id}`))return Response.json({data:series});
  return Response.json(page([post()]));
 };
 assert.equal((await getPublicPostSeries(handle,'https://api.example.test/api/v1',request))[0].id,id);
 assert.equal((await getPublicPostSeriesDetail(handle,id,'https://api.example.test/api/v1',request)).name,series.name);
 assert.equal((await getPublicPostSeriesPosts(handle,id,0,'https://api.example.test/api/v1',request)).content[0].seriesDisplayOrder,undefined);
 assert.deepEqual(seen.map(([url])=>new URL(url).pathname.replace('/api/v1','')),[`/blogs/${handle}/series`,`/blogs/${handle}/series/${id}`,`/blogs/${handle}/series/${id}/posts`]);
 for(const [,options] of seen){assert.equal(options.cache,'no-store');assert.equal(options.credentials,'omit');}
});

test('public series post parser rejects hidden, wrong-owner, and wrong-series rows',async()=>{
 for(const item of [post({visibilityStatus:'HIDDEN'}),post({author:{...post().author,handle:'other'} }),post({seriesId:'721389012345678904'}),post({seriesDisplayOrder:1})]){
  await assert.rejects(getPublicPostSeriesPosts(handle,id,0,'https://api.example.test/api/v1',async()=>Response.json(page([item]))));
 }
});

test('member series posts require owner identity and preserve API sequence metadata',async()=>{
 const request=async()=>page([ownPost({visibilityStatus:'HIDDEN',isBlocked:true,draft:true,displayOrder:8})]);
 const result=await getMemberPostSeriesPosts(request,id,0,'721389012345678903');
 assert.equal(result.content[0].draft,true); // owner endpoint intentionally includes hidden, blocked, and draft posts
 assert.equal((await getMemberPostSeriesPosts(async()=>page([ownPost({seriesDisplayOrder:9})]),id,0)).content[0].seriesDisplayOrder,9); // API gaps after moderation remain valid
 await assert.rejects(getMemberPostSeriesPosts(async()=>page([ownPost({seriesId:null})]),id,0));
 await assert.rejects(getMemberPostSeriesPosts(async()=>page([ownPost({author:{...post().author,id:'721389012345678905'}})]),id,0,'721389012345678903'));
});

test('legacy public page records without series fields stay readable',()=>{
 const legacy={...post()};delete legacy.seriesId;delete legacy.seriesDisplayOrder;
 assert.equal(parsePostPage(page([legacy]),0).content[0].seriesId,undefined);
 assert.equal(parsePublicPostPage(page([post({seriesDisplayOrder:null})]),0).content[0].seriesDisplayOrder,null);
 assert.throws(()=>parsePublicPostPage(page([post({seriesDisplayOrder:0})]),0));
});

test('owner list accepts an unassigned post with the API default order zero',()=>{
 const parsed=parseOwnPosts(page([ownPost({seriesId:null,seriesDisplayOrder:0})]),0);
 assert.equal(parsed.content[0].seriesId,null);
 assert.equal(parsed.content[0].seriesDisplayOrder,0);
 assert.throws(()=>parseOwnPosts(page([ownPost({seriesDisplayOrder:null})]),0));
});
