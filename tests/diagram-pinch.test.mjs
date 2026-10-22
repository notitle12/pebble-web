import test from 'node:test';
import assert from 'node:assert/strict';
import {beginDiagramPinch,moveDiagramPinch} from '../src/features/post/diagram-pinch.ts';
test('pinch preserves the content under the midpoint while adding the viewer gutter',()=>{
 const start=beginDiagramPinch({x:100,y:100},{x:200,y:100},.2,200,60,0);
 const next=moveDiagramPinch(start,{x:50,y:120},{x:250,y:120},48);
 assert.equal(next.zoom,.4);
 assert.equal((next.left+150-48)/next.zoom,(200+150)/.2);
 assert.equal((next.top+120-48)/next.zoom,(60+100)/.2);
});
test('two-finger translation pans even at the same scale',()=>{
 const start=beginDiagramPinch({x:100,y:100},{x:200,y:100},1,200,100,48);
 const next=moveDiagramPinch(start,{x:130,y:120},{x:230,y:120},48);
 assert.deepEqual(next,{zoom:1,left:170,top:80});
});
test('pinch works below 40%, clamps to 1–300%, and never scrolls below zero',()=>{
 const start=beginDiagramPinch({x:0,y:0},{x:100,y:0},.08,0,0,0);
 assert.equal(moveDiagramPinch(start,{x:0,y:0},{x:200,y:0},0).zoom,.16);
 assert.equal(moveDiagramPinch(start,{x:0,y:0},{x:1,y:0},0).zoom,.01);
 assert.equal(moveDiagramPinch(start,{x:0,y:0},{x:10000,y:0},0).zoom,3);
 assert.ok(moveDiagramPinch(start,{x:500,y:500},{x:600,y:500},0).left>=0);
 assert.equal(beginDiagramPinch({x:0,y:0},{x:0,y:0},1,0,0,0),null);
});
