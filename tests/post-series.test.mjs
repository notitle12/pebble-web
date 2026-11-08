import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePostSeries,parsePostSeriesList,getPublicPostSeries,getPublicPostSeriesDetail,getPublicPostSeriesPosts,getMemberPostSeriesPosts,getSeriesCandidatePosts,publicPostSeriesHref,validatePostSeriesInput} from '../src/features/post/api/post-series.ts';
import {filterSeriesCandidates} from '../src/features/post/series-post-filter.ts';
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

test('add dialog searches and combines status/series filters without including existing members',()=>{
 const rows=[ownPost({id:'1',seriesId:null,title:'Spring 첫 글'}),ownPost({id:'2',seriesId:null,title:'기록',visibilityStatus:'HIDDEN'}),ownPost({id:'3',seriesId:'99',title:'SPRING 다른 연재'}),ownPost({id:'4',seriesId:null,draft:true}),ownPost({id:'5',seriesId:null,isBlocked:true}),ownPost({id:'6',seriesId:id})];
 const ids=(q='',state='all',connection='all')=>filterSeriesCandidates(rows,id,q,state,connection).map(row=>row.id);
 assert.deepEqual(ids(),['1','2','3','4','5']);
 assert.deepEqual(ids(' spring '),['1','3']);
 assert.deepEqual(ids('spring','public','99'),['3']);
 assert.deepEqual(ids('spring','public','none'),['1']);
 assert.deepEqual(ids('','hidden'),['2']);
 assert.deepEqual(ids('','draft'),['4']);
 assert.deepEqual(ids('','blocked'),['5']);
 assert.deepEqual(ids('찾을 수 없음'),[]);
});

const candidatePage=(content,pageNo=0,total=content.length)=>({data:{content,page:pageNo,size:100,totalElements:total,totalPages:Math.ceil(total/100),hasNext:pageNo+1<Math.ceil(total/100),hasPrevious:pageNo>0}});
test('candidate search loads every owner page so matches after the first page remain available',async()=>{
 const rows=Array.from({length:101},(_,i)=>ownPost({id:String(i+1),seriesId:null,title:i===100?'마지막 검색 대상':'기록'}));
 const calls=[];const result=await getSeriesCandidatePosts(async path=>{calls.push(path);return path.includes('page=0')?candidatePage(rows.slice(0,100),0,101):candidatePage(rows.slice(100),1,101);},'721389012345678903');
 assert.deepEqual(calls,['/members/me/posts?page=0&size=100','/members/me/posts?page=1&size=100']);
 assert.equal(filterSeriesCandidates(result,id,'검색 대상','all','all')[0].id,'101');
});
test('candidate snapshots reject changing totals, duplicates, wrong owners and excessive results',async()=>{
 const rows=Array.from({length:100},(_,i)=>ownPost({id:String(i+1),seriesId:null}));
 for(const last of [candidatePage([rows[0]],1,101),candidatePage([ownPost({id:'101'})],1,102),candidatePage([],1,101)])await assert.rejects(getSeriesCandidatePosts(async path=>path.includes('page=0')?candidatePage(rows,0,101):last,'721389012345678903'));
 await assert.rejects(getSeriesCandidatePosts(async()=>candidatePage([ownPost()]),'999'));
 let calls=0;await assert.rejects(getSeriesCandidatePosts(async()=>{calls++;return candidatePage(rows,0,10001);},'721389012345678903'));assert.equal(calls,1);
});
