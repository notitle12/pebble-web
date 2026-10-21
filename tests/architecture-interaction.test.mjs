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

test('연결점 선택 범위(hit radius)가 원 근처(<=10px)로 제한되어 카드 이동을 방해하지 않는다', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const blockFile = fs.readFileSync(new URL('../src/features/post/components/architecture-block.tsx',import.meta.url), 'utf-8');
  const match = blockFile.match(/className="arch-connect-hit"\s+r="(\d+)"/);
  assert.ok(match, 'arch-connect-hit circle must be defined');
  const radius = Number(match[1]);
  assert.ok(radius <= 10, `Hit radius ${radius} must be <= 10 to prevent accidental connection drags when moving cards`);
  assert.ok(radius >= 5, `Hit radius ${radius} must be >= visible dot radius 5`);
});

// Large ERDs can be fitted below the architecture editor's default 40% minimum.
test('large ERD zoom changes smoothly below 40% and retains the configured limits',()=>{
  assert.equal(architectureZoom(.08,0,.01),.08);
  assert.ok(architectureZoom(.08,-100,.01)>.08);
  assert.ok(architectureZoom(.08,-100,.01)<.4);
  assert.ok(architectureZoom(.08,100,.01)<.08);
  assert.equal(architectureZoom(.01,100,.01),.01);
  assert.equal(architectureZoom(3,-100,.01),3);
});
