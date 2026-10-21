import test from 'node:test';
import assert from 'node:assert/strict';
import {MemberApiError} from '../src/lib/member-api.ts';
import {defaultBlogHomeSettings,parseBlogHomeSettings,featuredProjectIdsForHome,saveMyBlogHome,setMyProjectFeatured} from '../src/features/blog-home/api/blog-home.ts';

const settings=()=>({...defaultBlogHomeSettings(),featuredProjectIds:['1','2','3','4','5','6'],featuredProjectLimit:3,techStacks:['Java'],activityDisplay:'STONES'});

test('legacy home responses default to six and explicit display limits must be integers from one to six',()=>{
 const legacy=settings();delete legacy.featuredProjectLimit;
 assert.equal(parseBlogHomeSettings({data:legacy}).featuredProjectLimit,6);
 for(const value of [1,2,3,4,5,6])assert.equal(parseBlogHomeSettings({data:{...settings(),featuredProjectLimit:value}}).featuredProjectLimit,value);
 for(const value of [null,0,7,-1,1.5,'3',true])assert.throws(()=>parseBlogHomeSettings({data:{...settings(),featuredProjectLimit:value}}));
});

test('display limits preserve the full ordered selection and only fetch visible featured IDs',()=>{
 const home=settings();
 assert.deepEqual(featuredProjectIdsForHome(home),['1','2','3']);
 assert.equal(home.featuredProjectIds.length,6);
 assert.deepEqual(featuredProjectIdsForHome({...home,featuredProjectLimit:1}),['1']);
 assert.deepEqual(featuredProjectIdsForHome({...home,featuredProjectLimit:6}),home.featuredProjectIds);
});

test('home settings save the display limit and accept the API pruning previously deleted selections',async()=>{
 const before=settings();
 const result=await saveMyBlogHome(before,async(path,options)=>{
  assert.equal(path,'/members/me/blog-home');assert.equal(options.method,'PUT');
  assert.equal(options.body.featuredProjectLimit,3);
  assert.deepEqual(options.body.featuredProjectIds,before.featuredProjectIds);
  return {data:{...options.body,featuredProjectIds:['2','3']}};
 });
 assert.deepEqual(result.featuredProjectIds,['2','3']);assert.equal(result.featuredProjectLimit,3);
 assert.deepEqual(result.techStacks,['Java']);assert.equal(result.activityDisplay,'STONES');
});

test('project management changes a single featured flag and consumes the complete preserved settings',async()=>{
 for(const featured of [true,false]){
  const before=settings(),ids=featured?['1','2','3']:['1','3'];
  const result=await setMyProjectFeatured('2',featured,async(path,options)=>{
   assert.equal(path,'/members/me/projects/2/featured');assert.deepEqual(options,{method:'PUT',body:{featured}});
   return {data:{...before,featuredProjectIds:ids}};
  });
  assert.deepEqual(result.featuredProjectIds,ids);assert.equal(result.featuredProjectLimit,before.featuredProjectLimit);
  assert.deepEqual(result.sections,before.sections);assert.deepEqual(result.techStacks,before.techStacks);
 }
});

test('featured changes reject invalid IDs and inconsistent responses without retrying writes',async()=>{
 let calls=0;
 const request=async()=>{calls++;return {data:settings()};};
 await assert.rejects(setMyProjectFeatured('../1',true,request),error=>error.code==='INVALID_REQUEST');
 assert.equal(calls,0);
 await assert.rejects(setMyProjectFeatured('2',false,request),error=>error.code==='INVALID_RESPONSE'&&error.status===0);
 assert.equal(calls,1);
 await assert.rejects(setMyProjectFeatured('2',true,async()=>({data:{...settings(),featuredProjectLimit:7}})),error=>error.code==='INVALID_RESPONSE');
});

test('six-project limit and ownership errors remain actionable and are not silently retried',async()=>{
 for(const status of [409,404]){
  const failure=new MemberApiError(status,'FEATURED_PROJECT_LIMIT','대표 프로젝트는 최대 6개까지 지정할 수 있어요.');
  let calls=0;
  await assert.rejects(setMyProjectFeatured('7',true,async()=>{calls++;throw failure;}),error=>error===failure);
  assert.equal(calls,1);
 }
});
