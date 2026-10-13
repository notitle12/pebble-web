import test from 'node:test';
import assert from 'node:assert/strict';
import {parseStoneView,mergeStones,splitStone,moveStone,stoneSize,stoneMergeTarget,stonePaintOrder,stoneRotation,nudgeStone,moveStoneGroup,stonesInBox,stoneGroupBounds,rotateStoneGroup,unusedPosts} from '../src/features/blog-home/stones.ts';
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

test('merged stones keep growing and higher stones paint in front',()=>{
 assert.ok(stoneSize(25).width>stoneSize(5).width*1.8);
 assert.ok(stoneSize(100).width>stoneSize(25).width*1.5);
 const lower={...stones[0],id:'lower',y:300},upper={...stones[1],id:'upper',x:lower.x,y:298};
 assert.deepEqual(stonePaintOrder([upper,lower]).map(s=>s.id),['lower','upper']);
 assert.equal(stoneMergeTarget([upper,lower],'other',lower.x,lower.y)?.id,'upper');
});
test('merge requires a precise center overlap rather than stacking above or beside a stone',()=>{
 const target={...stones[0],postIds:Array.from({length:100},(_,i)=>String(i+1))};
 assert.equal(stoneMergeTarget([target],'other',target.x+19,target.y),undefined);
 assert.equal(stoneMergeTarget([target],'other',target.x,target.y-9),undefined);
 assert.equal(stoneMergeTarget([target],'other',target.x+3,target.y+2)?.id,target.id);
});
test('marquee selects intersecting stones in either drag direction including rotated extents',()=>{
 const rotated={...stones[0],rotation:90,x:200,y:100};
 assert.deepEqual(stonesInBox(stones,{x:350,y:270},{x:530,y:330}),stones.map(s=>s.id));
 assert.deepEqual(stonesInBox(stones,{x:530,y:330},{x:350,y:270}),stones.map(s=>s.id));
 assert.deepEqual(stonesInBox([rotated],{x:190,y:60},{x:210,y:65}),[rotated.id]);
 assert.deepEqual(stonesInBox(stones,{x:0,y:0},{x:50,y:50}),[]);
});
test('group movement keeps offsets, obeys canvas boundaries, and does not snap at release',()=>{
 const ids=stones.map(s=>s.id),moved=moveStoneGroup(stones,ids,20.25,-13.5);
 assert.equal(moved[0].x,stones[0].x+20.25);assert.equal(moved[0].y,stones[0].y-13.5);
 assert.equal(moved[1].x-moved[0].x,stones[1].x-stones[0].x);
 const limited=moveStoneGroup(stones,ids,1000,1000);
 assert.equal(limited[1].x-limited[0].x,80);
 assert.ok(limited[1].x+stoneSize(1).width/2<=1000);
 assert.ok(limited[0].y+stoneSize(1).height/2<=344);
 assert.equal(moveStoneGroup(stones,[stones[0].id],5,0)[1],stones[1]);
 assert.equal(stones[0].x,400);
});

test('arrow nudges are precise, accelerated with Shift, and keep the chosen shape',()=>{
 const stone={...stones[0],shape:4};
 assert.equal(nudgeStone(stone,'ArrowRight').x,stone.x+1);
 assert.equal(nudgeStone(stone,'ArrowUp',true).y,stone.y-10);
 assert.equal(nudgeStone(stone,'ArrowLeft').shape,4);
 assert.equal(nudgeStone(stone,'Escape'),stone);
 assert.equal(stoneRotation(170,30),-160);
 assert.equal(stoneRotation(0,22,true),15);
 assert.equal(stoneRotation(-175,-20),165);
});
test('shape presets round trip without changing stone size or source records',()=>{
 for(let shape=0;shape<=5;shape++){
  const view={version:0,stones:[{...stones[0],shape}],posts};
  assert.deepEqual(parseStoneView(view),view);
 }
 for(const shape of [-1,6,1.5,null,'1'])assert.throws(()=>parseStoneView({version:0,stones:[{...stones[0],shape}],posts}));
});

test('group bounds enclose outer stones and rotation keeps the group center and pair distances',()=>{
 const ids=stones.map(s=>s.id),bounds=stoneGroupBounds(stones,ids);
 assert.equal(bounds.x,440);assert.equal(bounds.width,170);assert.equal(bounds.height,40);
 const rotated=rotateStoneGroup(stones,ids,90);
 assert.ok(Math.abs(rotated[0].x-440)<.001);assert.ok(Math.abs(rotated[0].y-260)<.001);
 assert.ok(Math.abs(rotated[1].y-rotated[0].y-80)<.001);
 assert.equal(rotated[0].rotation,90);
 assert.equal(rotateStoneGroup(stones,[stones[0].id],45)[1],stones[1]);
 assert.equal(stoneGroupBounds(stones,[]),null);
});
