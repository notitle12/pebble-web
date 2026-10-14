import test from 'node:test';
import assert from 'node:assert/strict';
import { architectureZoom, nearestArchitectureSide } from '../src/features/post/architecture-interaction.ts';

test('캔버스 휠 확대는 방향을 따르고 과도한 휠과 반복 확대를 제한한다',()=>{
  assert.ok(architectureZoom(1,-40)>1);
  assert.ok(architectureZoom(1,40)<1);
  assert.equal(architectureZoom(1,0),1);
  assert.equal(architectureZoom(3,-100),3);
  assert.equal(architectureZoom(.4,100),.4);
  assert.equal(architectureZoom(1,-10000),architectureZoom(1,-100));
});
test('카드 어느 위치에 놓아도 가장 가까운 변에 연결한다',()=>{
  const box={left:100,right:300,top:50,bottom:150};
  assert.equal(nearestArchitectureSide(box,110,100),'LEFT');
  assert.equal(nearestArchitectureSide(box,290,100),'RIGHT');
  assert.equal(nearestArchitectureSide(box,200,55),'TOP');
  assert.equal(nearestArchitectureSide(box,200,145),'BOTTOM');
  assert.equal(nearestArchitectureSide({left:50,right:150,top:25,bottom:75},145,50),'RIGHT');
});
