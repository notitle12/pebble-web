import test from 'node:test';
import assert from 'node:assert/strict';
import {gardenScene,gardenStones,parseGarden} from '../src/features/blog-home/stone-garden.ts';

test('new records add varied stones without moving or enlarging existing stones',()=>{
 for(let count=1;count<=10;count++)assert.equal(gardenStones(count).length,count);
 assert.ok(gardenStones(1)[0].width<20);
 let previous=[];
 for(const count of [1,10,25,50,100,250,500,1000,5000]){
  const stones=gardenStones(count),byId=new Map(stones.map(s=>[s.id,s]));
  for(const {count:ignored,...before} of previous){const {count:nextCount,...after}=byId.get(before.id);assert.deepEqual(after,before);}
  assert.ok(stones.length>previous.length);previous=stones;
 }
 assert.ok(new Set(gardenStones(100).filter(s=>s.id.startsWith('main-')).map(s=>s.shape)).size>=6);
});
test('plants grow gradually while stones retain their dimensions',()=>{
 const young=gardenScene(31),grown=gardenScene(100);
 for(const plant of young.plants){const next=grown.plants.find(p=>p.id===plant.id);assert.ok(next.width>plant.width&&next.height>plant.height);assert.equal(next.x,plant.x);assert.equal(next.y,plant.y);}
 assert.equal(gardenScene(1).plants.length,0);
 assert.ok(gardenScene(500).plants.filter(p=>p.shape===4).length>gardenScene(50).plants.filter(p=>p.shape===4).length);
});
test('tower stones rest within the support below, with pointed stones only at the top',()=>{
 const stones=gardenStones(5000);
 for(const prefix of ['main-','left-','right-','outer-']){
  const tower=stones.filter(s=>s.id.startsWith(prefix));
  for(let i=1;i<tower.length;i++){
   const lower=tower[i-1],upper=tower[i];
   assert.notEqual(lower.shape,9,'pointed wedge cannot support another stone');
   assert.ok(upper.width<=lower.width);
   assert.ok(Math.abs(upper.x-lower.x)+upper.width/2<=lower.width/2,'upper footprint stays inside support');
   const overlap=upper.y+upper.height/2-(lower.y-lower.height/2);
   assert.ok(overlap>=3&&overlap<=8,'stone contours touch without a floating gap');
  }
  assert.ok(tower[0].y+tower[0].height/2>=221,'base rests on the ground');
 }
});
test('every cumulative record remains represented in a bounded landscape without resets',()=>{
 for(const count of [0,1,2,5,10,25,50,99,100,101,499,500,999,1000,5000,1000000]){
  const scene=gardenScene(count),stones=scene.stones;
  assert.equal(stones.reduce((sum,s)=>sum+s.count,0),count);assert.ok(stones.length<=32);assert.equal(new Set(stones.map(s=>s.id)).size,stones.length);
  for(const s of stones){assert.ok(s.count>0);assert.ok(s.width>0&&s.height>0);assert.ok(s.x-s.width/2>=180&&s.x+s.width/2<=820);assert.ok(s.y-s.height/2>=0&&s.y+s.height/2<=245);assert.ok(![4,5].includes(s.shape));}
  for(const p of scene.plants)assert.ok(p.y-p.height>=0&&p.y<=245);
  assert.ok(scene.groundWidth<=630);
 }
});
test('garden API responses require nonnegative safe integer counts',()=>{
 assert.deepEqual(parseGarden({data:{publicationCount:31}}),{publicationCount:31});
 for(const value of [null,{}, {publicationCount:-1},{publicationCount:1.5},{publicationCount:'100'},{publicationCount:Number.MAX_SAFE_INTEGER+1}])assert.throws(()=>parseGarden(value));
 assert.throws(()=>gardenScene(-1));assert.throws(()=>gardenScene(1.5));
});
