import test from 'node:test';
import assert from 'node:assert/strict';
import {selectedFeaturedIds} from '../src/features/project/project-featured-selection.ts';
import {defaultBlogHomeSettings} from '../src/features/blog-home/api/blog-home.ts';
const home=(ids,limit=2)=>({...defaultBlogHomeSettings(),featuredProjectIds:ids,featuredProjectLimit:limit});
test('featured publish respects the configured display count and permits atomic replacement',()=>{
 assert.throws(()=>selectedFeaturedIds(home(['1','2']),'3',{featured:true,removedIds:[]},true),/2개/);
 assert.deepEqual(selectedFeaturedIds(home(['1','2']),'3',{featured:true,removedIds:['1']},true),['2','3']);
});
test('editing a featured project retains order and hidden projects are never added',()=>{
 assert.deepEqual(selectedFeaturedIds(home(['1','2']),'1',{featured:true,removedIds:[]},true),['1','2']);
 assert.deepEqual(selectedFeaturedIds(home(['1','2']),'1',{featured:true,removedIds:[]},false),['2']);
 assert.deepEqual(selectedFeaturedIds(home(['1','2']),'3',{featured:true,removedIds:[]},false),['1','2']);
});
test('selection uses latest IDs and preserves unrelated concurrent additions',()=>{
 assert.deepEqual(selectedFeaturedIds(home(['1','2','4'],4),'3',{featured:true,removedIds:['1']},true),['2','4','3']);
 assert.deepEqual(selectedFeaturedIds(home(['1','2','4'],1),'1',{featured:false,removedIds:[]},true),['2','4']);
});

import {saveProjectFeaturedSelection} from '../src/features/project/project-featured-selection.ts';
for(const title of ['newly published','edited'])test(`${title} project can retry a failed featured write with the same saved ID`,async()=>{
 const project={id:'3',visibilityStatus:'PUBLIC',isBlocked:false};
 let stored={...home(['1','2']),activityDisplay:'STONES',techStacks:['Java']};let writes=0;const calls=[];
 const request=async(path,options)=>{
  calls.push([path,options]);
  if(!options)return {data:stored};
  if(++writes===1)throw new Error('network failure after project saved');
  stored=options.body;return {data:stored};
 };
 const selection={featured:true,removedIds:['1']};
 await assert.rejects(saveProjectFeaturedSelection(project,selection,request,()=>true),/network/);
 const result=await saveProjectFeaturedSelection(project,selection,request,()=>true);
 assert.deepEqual(result.featuredProjectIds,['2','3']);
 assert.deepEqual(result.techStacks,['Java']);assert.equal(result.activityDisplay,'STONES');
 assert.equal(calls.filter(([,options])=>options?.method==='POST').length,0);
 assert.ok(calls.every(([path])=>path==='/members/me/blog-home'));
});
test('lost session after reading settings prevents the featured mutation',async()=>{
 const calls=[];
 const result=await saveProjectFeaturedSelection({id:'3',visibilityStatus:'PUBLIC',isBlocked:false},{featured:true,removedIds:['1']},async(path,options)=>{calls.push([path,options]);return {data:home(['1','2'])};},()=>false);
 assert.equal(result,null);assert.equal(calls.length,1);assert.equal(calls[0][1],undefined);
});
test('uncertain success is idempotent on retry and does not duplicate the saved project',async()=>{
 let stored=home(['1','2']);let writes=0;
 const request=async(path,options)=>{if(!options)return {data:stored};stored=options.body;writes++;throw new Error('response lost');};
 const project={id:'3',visibilityStatus:'PUBLIC',isBlocked:false},selection={featured:true,removedIds:['1']};
 await assert.rejects(saveProjectFeaturedSelection(project,selection,request,()=>true));
 assert.deepEqual((await saveProjectFeaturedSelection(project,selection,request,()=>true)).featuredProjectIds,['2','3']);
 assert.equal(writes,1);
});
