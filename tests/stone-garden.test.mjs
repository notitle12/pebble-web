import test from 'node:test';
import assert from 'node:assert/strict';
import {gardenScene,gardenStones,parseGarden} from '../src/features/blog-home/stone-garden.ts';
test('natural garden starts with a tiny pebble and the base itself grows with records',()=>{
 const first=gardenStones(1),ten=gardenStones(10),fifty=gardenStones(50),hundred=gardenStones(100);
 assert.equal(first.length,1);assert.ok(first[0].width<20);
 assert.ok(ten[0].width>first[0].width);assert.ok(fifty[0].width>ten[0].width*2);assert.ok(hundred[0].width>fifty[0].width);
 assert.ok(ten.length>first.length);assert.ok(fifty.length>ten.length);assert.ok(hundred.length>fifty.length);
 assert.equal(first[0].id,hundred[0].id);assert.equal(first[0].x,hundred[0].x);
 assert.ok(gardenScene(1).plants.length===0);assert.ok(gardenScene(50).plants.some(p=>p.shape===4));
 assert.ok(gardenScene(500).plants.filter(p=>p.shape===4).length>gardenScene(50).plants.filter(p=>p.shape===4).length);
});
test('every cumulative record remains represented in a bounded landscape without resets or architecture',()=>{
 for(const count of [0,1,2,5,10,25,50,99,100,101,499,500,999,1000,5000,1000000]){
  const scene=gardenScene(count),stones=scene.stones;
  assert.equal(stones.reduce((sum,s)=>sum+s.count,0),count);assert.ok(stones.length<=24);assert.equal(new Set(stones.map(s=>s.id)).size,stones.length);
  for(const s of stones){assert.ok(s.count>0);assert.ok(s.width>0&&s.height>0);assert.ok(s.x-s.width/2>=180&&s.x+s.width/2<=820);assert.ok(s.y-s.height/2>=0&&s.y+s.height/2<=245);assert.ok(s.shape<=3);}
  for(const p of scene.plants)assert.ok(p.y-p.height>=0&&p.y<=245);
  assert.ok(scene.groundWidth<=630);
 }
 const before=gardenScene(99),after=gardenScene(100);assert.equal(after.stones[0].id,before.stones[0].id);assert.ok(after.stones[0].width>before.stones[0].width);
});
test('garden API responses require nonnegative safe integer counts',()=>{
 assert.deepEqual(parseGarden({data:{publicationCount:31}}),{publicationCount:31});
 for(const value of [null,{}, {publicationCount:-1},{publicationCount:1.5},{publicationCount:'100'},{publicationCount:Number.MAX_SAFE_INTEGER+1}])assert.throws(()=>parseGarden(value));
 assert.throws(()=>gardenScene(-1));assert.throws(()=>gardenScene(1.5));
});
