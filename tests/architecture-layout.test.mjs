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

import { architectureEdgeRoute } from '../src/features/post/architecture-edge.ts';
test('선택한 연결 변과 경로 지점을 보존하고 카드 이동 시 끝점만 따라간다',()=>{
 const from={x:100,y:100,width:160,height:76},to={x:500,y:300,width:200,height:160};
 const edge={id:'e',source:'a',target:'b',sourceSide:'BOTTOM',targetSide:'RIGHT',waypoint:{x:320,y:240}};
 const route=architectureEdgeRoute(edge,from,to);
 assert.deepEqual(route.start,{x:180,y:176}); assert.deepEqual(route.end,{x:700,y:380}); assert.deepEqual(route.bend,edge.waypoint);
 const moved=architectureEdgeRoute(edge,{...from,x:120},to); assert.equal(moved.start.x,200); assert.deepEqual(moved.bend,route.bend);
 const automatic=architectureEdgeRoute({...edge,sourceSide:null,targetSide:null,waypoint:null},from,to); assert.ok(!automatic.path.includes('NaN'));
 const spec={schemaVersion:1,groups:[],nodes:[{id:'a',type:'APP',label:'A'},{id:'b',type:'APP',label:'B'}],edges:[edge]}; parseArchitectureSpec(spec);
 for(const patch of [{sourceSide:'auto'},{targetSide:1},{sourceSide:['TOP']},{waypoint:{x:4201,y:0}},{waypoint:{x:1.5,y:0}},{waypoint:{x:0,y:0,z:0}}]) assert.throws(()=>parseArchitectureSpec({...spec,edges:[{...edge,...patch}]}));
});

test('그룹 내부의 두 끝점이 함께 이동할 때 수동 화살표 경로도 함께 이동한다',()=>{
 const spec={schemaVersion:1,groups:[{id:'g',type:'AWS',label:'Cloud',bounds:{x:100,y:100,width:600,height:500}}],nodes:[{id:'a',type:'APP',label:'A',groupId:'g',position:{x:150,y:180}},{id:'b',type:'APP',label:'B',groupId:'g',position:{x:400,y:350}}],edges:[{id:'e',source:'a',target:'b',sourceSide:'BOTTOM',targetSide:'LEFT',waypoint:{x:350,y:300}}]};
 const moved=moveArchitectureGroup(spec,'g',{x:130,y:140});
 assert.deepEqual(moved.edges[0].waypoint,{x:380,y:340}); assert.equal(moved.edges[0].sourceSide,'BOTTOM'); parseArchitectureSpec(moved);
});
