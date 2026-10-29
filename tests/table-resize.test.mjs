import test from 'node:test';
import assert from 'node:assert/strict';
import {resizeTableSegments} from '../src/features/post/table-resize.ts';
import {resizeColumnWidths} from '../src/features/post/table-column-resize.ts';
import {resizeRowHeights} from '../src/features/post/table-row-resize.ts';

test('both axes consume neighbor slack, grow at the minimum and retain the outline when returning',()=>{
 for(const [resize,minimum] of [[resizeColumnWidths,48],[resizeRowHeights,20]]) {
  const start=[minimum,minimum,100];
  const grown=resize(start,0,80);
  assert.deepEqual(grown,[minimum+80,minimum,100]);
  const returned=resize(grown,0,-50);
  assert.deepEqual(returned,[minimum+30,minimum+50,100]);
  assert.equal(returned.reduce((a,b)=>a+b),grown.reduce((a,b)=>a+b));
  assert.deepEqual(resize(returned,2,-40),[minimum+30,minimum+50,60]);
 }
});

test('a single row or column can be resized directly at its outside boundary',()=>{
 assert.deepEqual(resizeColumnWidths([48],0,100),[148]);
 assert.deepEqual(resizeColumnWidths([148],0,-200),[48]);
 assert.deepEqual(resizeRowHeights([25],0,100,[25]),[125]);
 assert.deepEqual(resizeRowHeights([125],0,-200,[25]),[25]);
});

test('internal shrinking preserves total and unrelated segments for every boundary',()=>{
 for(const minimum of [20,48]) for(let boundary=0;boundary<3;boundary++) {
  const start=[100,150,120,130];
  for(const delta of [-1000,-50,0,10]) {
   const next=resizeTableSegments(start,boundary,delta,start.map(()=>minimum));
   assert.equal(next.reduce((a,b)=>a+b),500);
   next.forEach((size,index)=>{assert.ok(size>=minimum);if(index!==boundary&&index!==boundary+1)assert.equal(size,start[index]);});
  }
 }
});

test('invalid geometry and limits do not produce partial or non-finite sizes',()=>{
 for(const [sizes,boundary,delta,minimums,max] of [
  [[],0,10,[],Infinity],[[100],1,10,[20],Infinity],[[100],0,NaN,[20],Infinity],
  [[100],0,10,[],Infinity],[[100],0,10,[101],Infinity],[[100],0,10,[20],NaN],
  [[100],0,10,[20],0],[[NaN],0,10,[20],Infinity],[[1201],0,10,[20],1200],
 ]) assert.equal(resizeTableSegments(sizes,boundary,delta,minimums,max),null);
});
