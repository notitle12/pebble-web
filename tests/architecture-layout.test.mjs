import test from 'node:test';
import assert from 'node:assert/strict';
import { architectureLayout } from '../src/features/post/architecture-layout.ts';
const nodes = (count, groupId) => Array.from({length:count},(_,i)=>({id:`n-${i}`,type:'APP',label:`Node ${i}`,groupId}));
test('자동 배치는 최대 요소와 여러 Docker 경계를 겹치지 않게 배치하고 저장 좌표를 보존한다',()=>{
  const root={schemaVersion:1,groups:[],nodes:nodes(30),edges:[]};
  for(const point of architectureLayout(root).positions.values()) assert.ok(point.x>=0&&point.x<=4000&&point.y>=0&&point.y<=4000);
  const groups=[{id:'cloud',type:'CUSTOM',label:'Cloud'},...Array.from({length:9},(_,i)=>({id:`d-${i}`,type:'DOCKER',label:`Docker ${i}`,parentId:'cloud'}))];
  const spec={...root,groups,nodes:nodes(30,'d-8')};
  const layout=architectureLayout(spec);
  for(const point of layout.positions.values()) assert.ok(point.x<=4000&&point.y<=4000);
  const child=layout.groups.get('d-8'),parent=layout.groups.get('cloud');
  assert.ok(parent.x<child.x&&parent.y<child.y&&parent.x+parent.width>child.x+child.width&&parent.y+parent.height>child.y+child.height);
  spec.nodes[0].position={x:4000,y:20};
  assert.deepEqual(architectureLayout(spec).positions.get('n-0'),{x:4000,y:20});
  const dockerOnly={...root,groups:[{id:'standalone',type:'DOCKER',label:'Docker'}],nodes:nodes(30,'standalone')};
  for(const point of architectureLayout(dockerOnly).positions.values()) assert.ok(point.y<=4000);
});

import { materializeArchitecture, moveArchitectureNode, moveArchitectureGroup, resizeArchitectureGroup } from '../src/features/post/architecture-editing.ts';
import { parseArchitectureSpec } from '../src/features/post/api/post-list.ts';
test('경계 드롭으로 가장 안쪽 그룹을 선택하고 부모 이동 시 자식 경계와 카드도 같은 거리 이동한다',()=>{
 const spec={schemaVersion:1,groups:[{id:'cloud',type:'AWS',label:'Cloud',bounds:{x:100,y:100,width:600,height:500}},{id:'docker',type:'DOCKER',label:'Docker',parentId:'cloud',bounds:{x:150,y:170,width:400,height:300}}],nodes:[{id:'a',type:'APP',label:'A',position:{x:0,y:0}},{id:'b',type:'APP',label:'B',position:{x:800,y:100}}],edges:[]};
 let next=moveArchitectureNode(spec,'a',{x:200,y:220},true);
 assert.equal(next.nodes[0].groupId,'docker');
 next=moveArchitectureGroup(next,'cloud',{x:140,y:150});
 assert.deepEqual(next.nodes[0].position,{x:240,y:270}); assert.deepEqual(next.nodes[1].position,spec.nodes[1].position);
 assert.deepEqual(next.groups[1].bounds,{x:190,y:220,width:400,height:300});
 next=moveArchitectureNode(next,'a',{x:850,y:800},true); assert.equal(next.nodes[0].groupId,null);
 assert.deepEqual(parseArchitectureSpec(next),next);
});
test('경계 확대는 새 카드를 포함하며 이동 범위를 카드와 함께 제한하고 이전 자동 배치를 보존한다',()=>{
 const spec={schemaVersion:1,groups:[{id:'g',type:'CUSTOM',label:'Group',bounds:{x:100,y:100,width:200,height:120}}],nodes:[{id:'n',type:'APP',label:'Node',position:{x:330,y:220}}],edges:[{id:'e',source:'g',target:'n'}]};
 let next=resizeArchitectureGroup(spec,'g',{width:450,height:300}); assert.equal(next.nodes[0].groupId,'g');
 next=moveArchitectureGroup(next,'g',{x:4000,y:4000});
 assert.equal(next.groups[0].bounds.x+next.groups[0].bounds.width,4200);
 assert.ok(next.nodes[0].position.x<=4000); assert.ok(next.nodes[0].position.y<=4000); parseArchitectureSpec(next);
 const old={schemaVersion:1,groups:[{id:'g',type:'DOCKER',label:'Docker'}],nodes:nodes(3,'g'),edges:[]};
 assert.deepEqual(architectureLayout(materializeArchitecture(old)).positions,architectureLayout(old).positions);
 for(const bounds of [{x:0,y:0,width:199,height:120},{x:4000,y:0,width:201,height:120},{x:0,y:0,width:200,height:119},{x:0,y:0,width:200,height:120.5},{x:0,y:0,width:200,height:120,extra:1}]) assert.throws(()=>parseArchitectureSpec({...spec,groups:[{...spec.groups[0],bounds}]}));
 assert.throws(()=>parseArchitectureSpec({...spec,edges:[{id:'e',source:'g',target:'g'}]}));
});
