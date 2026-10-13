import test from 'node:test';
import assert from 'node:assert/strict';
import {parseStoneView,mergeStones,splitStone,moveStone,stoneSize,stoneMergeTarget,snapStone,unusedPosts} from '../src/features/blog-home/stones.ts';
import {defaultBlogHomeSettings,parseBlogHomeSettings,saveMyBlogHome} from '../src/features/blog-home/api/blog-home.ts';
const posts=[1,2,3].map(id=>({id:String(id),title:`글 ${id}`,urlKey:`post-${id}`,publishedAt:'2026-10-13T03:00:00Z'}));
const stones=posts.slice(0,2).map((post,index)=>({id:`stone-${index}`,postIds:[post.id],x:400+index*80,y:300,rotation:0}));
test('merging and splitting conserve source posts and a merged stone grows wider',()=>{
 const merged=mergeStones(stones,stones.map(s=>s.id));
 assert.equal(merged.length,1);assert.deepEqual(merged[0].postIds,['1','2']);assert.ok(stoneSize(2).width>stoneSize(1).width);
 assert.deepEqual(unusedPosts(posts,merged).map(p=>p.id),['3']);
 const split=splitStone(merged,merged[0].id);assert.equal(split.length,2);assert.deepEqual(split.flatMap(s=>s.postIds),['1','2']);
 assert.equal(new Set(split.map(s=>s.id)).size,2);assert.deepEqual(unusedPosts(posts,split).map(p=>p.id),['3']);
 assert.deepEqual(stones[0].postIds,['1']);
});
test('merge refuses duplicate source reuse and bounds merge size',()=>{
 assert.throws(()=>mergeStones([stones[0],{...stones[1],postIds:['1']}],['stone-0','stone-1']));
 assert.throws(()=>mergeStones([{...stones[0],postIds:Array.from({length:100},(_,i)=>String(i+1))},{...stones[1],postIds:['101']}],['stone-0','stone-1']));
});
test('layout responses reject invalid sources, duplicate IDs and off-canvas geometry',()=>{
 const view={version:0,stones,posts};assert.deepEqual(parseStoneView({data:view}),view);
 for(const bad of [{...view,version:-1},{...view,stones:[stones[0],stones[0]]},{...view,posts:[]},{...view,stones:[{...stones[0],x:Infinity}]},{...view,stones:[{...stones[0],rotation:181}]},{...view,stones:[{...stones[0],postIds:['3','3']}]}])assert.throws(()=>parseStoneView({data:bad}));
 const clamped=moveStone(stones[0],-500,999);assert.ok(clamped.x>=stoneSize(1).width/2);assert.ok(clamped.y<=342-stoneSize(1).height*.4);
});
test('grass remains default and the selected stone display is saved with home settings',async()=>{
 const settings=defaultBlogHomeSettings();assert.equal(settings.activityDisplay,'GRASS');
 const chosen={...settings,activityDisplay:'STONES'};assert.equal(parseBlogHomeSettings({data:chosen}).activityDisplay,'STONES');
 assert.throws(()=>parseBlogHomeSettings({data:{...chosen,activityDisplay:'OTHER'}}));
 let sent;const result=await saveMyBlogHome(chosen,async(path,options)=>{sent=options.body;return {data:options.body};});assert.equal(sent.activityDisplay,'STONES');assert.equal(result.activityDisplay,'STONES');
});

test('drop onto a stone center merges while edge stacking and self selection stay separate',()=>{
 assert.equal(stoneMergeTarget(stones,'stone-0',480,300)?.id,'stone-1');
 assert.equal(stoneMergeTarget(stones,'stone-0',480,270),undefined);
 assert.equal(stoneMergeTarget([stones[0]],'stone-0',400,300),undefined);
});

test('merged stones keep growing substantially and near-top drops align for stacking',()=>{
 assert.ok(stoneSize(25).width>stoneSize(5).width*1.8);
 assert.ok(stoneSize(100).width>stoneSize(25).width*1.5);
 const top={...stones[0],id:'top',x:stones[1].x+5,y:265};
 const aligned=snapStone(top,[stones[1]]);assert.equal(aligned.x,stones[1].x);assert.ok(aligned.y<stones[1].y);
 assert.equal(snapStone({...top,x:100,y:100},[stones[1]]).y,100);
});
