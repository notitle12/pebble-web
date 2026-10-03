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
