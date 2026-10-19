import test from 'node:test';
import assert from 'node:assert/strict';
import { architectureLayout, ARCH_NODE_WIDTH, ARCH_NODE_HEIGHT, architectureNodeWidth } from '../src/features/post/architecture-layout.ts';
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

import { materializeArchitecture, moveArchitectureNode, moveArchitectureGroup, resizeArchitectureGroup, settleArchitectureHierarchy, moveArchitectureSelection } from '../src/features/post/architecture-editing.ts';
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

test('수동 경로(waypoint 지정 시)도 직각 형태를 유지하며, 바깥으로 이동 시 ㄷ자 우회 경로를 생성한다',()=>{
 const from={x:100,y:100,width:160,height:76},to={x:500,y:300,width:160,height:76};
 // 1. 시작점과 도착점 범위 내의 waypoint: 내부 S자 계단 경로
 const inBounds = { x: 350, y: 220 };
 const route1 = architectureEdgeRoute({ id: 'e', source: 'a', target: 'b', waypoint: inBounds }, from, to);
 assert.ok(route1.path.startsWith('M'));
 assert.ok(!route1.path.includes('C'), '수동 waypoint 지정 시에도 어색한 곡선(C) 대신 직각(L/Q) 경로여야 함');
 assert.deepEqual(route1.bend, inBounds);

 // 2. 시작점(y=138)보다 위로 벗어날 때: 상단 ㄷ자 우회 직각 경로 생성
 const aboveBounds = { x: 320, y: 40 };
 const route2 = architectureEdgeRoute({ id: 'e', source: 'a', target: 'b', waypoint: aboveBounds }, from, to);
 assert.equal(route2.bend.y, 40);
 assert.ok(!route2.path.includes('C'));
 assert.ok(route2.path.includes('40'), '상단 ㄷ자 우회 y좌표 40이 경로에 포함되어야 함');

 // 3. 도착점(y=338)보다 아래로 벗어날 때: 하단 ㄷ자 우회 직각 경로 생성
 const belowBounds = { x: 300, y: 500 };
 const route3 = architectureEdgeRoute({ id: 'e', source: 'a', target: 'b', waypoint: belowBounds }, from, to);
 assert.equal(route3.bend.y, 500);
 assert.ok(!route3.path.includes('C'));
 assert.ok(route3.path.includes('500'), '하단 ㄷ자 우회 y좌표 500이 경로에 포함되어야 함');

 // 4. 내부 수평 코리더 조절 시 시작점(x=260)보다 왼쪽으로 벗어나려 할 때: 최소 stub 여백(284)에서 안전하게 고정
 const leftBounds = { x: 100, y: 220 };
 const route4 = architectureEdgeRoute({ id: 'e', source: 'a', target: 'b', waypoint: leftBounds }, from, to);
 assert.equal(route4.bend.x, 284);
 assert.ok(!route4.path.includes('C'));
});

test('사용자 정의 표시 종류는 이전 문서와 호환되고 기본 종류는 덮어쓰지 못한다',()=>{
 const spec={schemaVersion:1,groups:[{id:'g',type:'CUSTOM',label:'로컬',typeLabel:'개발 환경'}],nodes:[{id:'n',type:'CUSTOM',label:'인증',typeLabel:'인증 서버'}],edges:[]};
 assert.deepEqual(parseArchitectureSpec(spec),spec);
 for(const typeLabel of ['', ' ', 'x'.repeat(51), 1])assert.throws(()=>parseArchitectureSpec({...spec,nodes:[{...spec.nodes[0],typeLabel}]}));
 assert.throws(()=>parseArchitectureSpec({...spec,nodes:[{...spec.nodes[0],type:'APP'}]}));
 assert.throws(()=>parseArchitectureSpec({...spec,groups:[{...spec.groups[0],type:'AWS'}]}));
 parseArchitectureSpec({...spec,nodes:[{...spec.nodes[0],type:'APP',typeLabel:null}]});
});

test('노드의 하단 연결점은 글씨 아래에 위치하고 측면 연결점은 아이콘 중심을 향한다',()=>{
 const nodeBox={x:100,y:100,width:ARCH_NODE_WIDTH,height:ARCH_NODE_HEIGHT,anchorY:25};
 const bottomRoute=architectureEdgeRoute({id:'e1',source:'a',target:'b',sourceSide:'BOTTOM',targetSide:'TOP'},nodeBox,{x:100,y:300,width:ARCH_NODE_WIDTH,height:ARCH_NODE_HEIGHT,anchorY:25});
 assert.deepEqual(bottomRoute.start,{x:100+ARCH_NODE_WIDTH/2,y:100+ARCH_NODE_HEIGHT});
 assert.deepEqual(bottomRoute.end,{x:100+ARCH_NODE_WIDTH/2,y:300});
 const sideRoute=architectureEdgeRoute({id:'e2',source:'a',target:'b',sourceSide:'RIGHT',targetSide:'LEFT'},nodeBox,{x:300,y:100,width:ARCH_NODE_WIDTH,height:ARCH_NODE_HEIGHT,anchorY:25});
 assert.deepEqual(sideRoute.start,{x:100+ARCH_NODE_WIDTH,y:125});
 assert.deepEqual(sideRoute.end,{x:300,y:125});
});

test('기존 그룹의 아이콘은 다른 그룹의 이동으로 빼앗기지 않고 명시적 하위 컨테이너나 더 큰 감싸는 그룹에만 포함된다',()=>{
  const spec = {
    schemaVersion: 1,
    groups: [
      { id: 'g1', type: 'AWS', label: 'Existing Group', bounds: { x: 100, y: 100, width: 400, height: 350 } },
      { id: 'g2', type: 'CUSTOM', label: 'Other Group', bounds: { x: 600, y: 100, width: 250, height: 200 } }
    ],
    nodes: [
      { id: 'n1', type: 'APP', label: 'Node 1', groupId: 'g1', position: { x: 150, y: 180 } },
      { id: 'standalone', type: 'APP', label: 'Standalone', groupId: null, position: { x: 700, y: 600 } }
    ],
    edges: []
  };

  // 1. g2를 g1 및 n1 위로 드래그하는 중 (finished=false): g1의 n1을 빼앗거나 이동시키지 않는다
  let dragged = moveArchitectureGroup(spec, 'g2', { x: 120, y: 150 }, false);
  assert.equal(dragged.nodes[0].groupId, 'g1');
  assert.deepEqual(dragged.nodes[0].position, { x: 150, y: 180 });

  // 2. g2를 g1 및 n1 위에 드롭 (finished=true): g2는 g1의 하위 컨테이너가 아니므로 n1은 여전히 g1에 남는다
  let dropped = moveArchitectureGroup(spec, 'g2', { x: 120, y: 150 }, true);
  assert.equal(dropped.nodes[0].groupId, 'g1');

  // 3. g2를 단독 노드(standalone) 위로 이동하여 드롭: 단독 노드는 감싼 새 그룹에 포함된다
  let dropOnStandalone = moveArchitectureGroup(spec, 'g2', { x: 650, y: 550 }, true);
  assert.equal(dropOnStandalone.nodes.find(n => n.id === 'standalone').groupId, 'g2');

  // 4. 컨테이너(DOCKER)를 부모 그룹(AWS) 내부로 이동하여 드롭: 하위 컨테이너로 감싸지며 부모의 노드가 하위 컨테이너에 포함된다
  const withDocker = {
    ...spec,
    groups: [
      { id: 'cloud', type: 'AWS', label: 'Cloud', bounds: { x: 100, y: 100, width: 600, height: 500 } },
      { id: 'docker', type: 'DOCKER', label: 'Docker', bounds: { x: 800, y: 100, width: 300, height: 250 } }
    ],
    nodes: [
      { id: 'app', type: 'APP', label: 'App', groupId: 'cloud', position: { x: 200, y: 220 } }
    ]
  };
  let dockerInside = moveArchitectureGroup(withDocker, 'docker', { x: 150, y: 170 }, true);
  assert.equal(dockerInside.groups.find(g => g.id === 'docker').parentId, 'cloud');
  assert.equal(dockerInside.nodes.find(n => n.id === 'app').groupId, 'docker');

  // 5. 더 큰 부모 그룹을 이동해 컨테이너를 완전히 감싸도록 배치: 컨테이너가 부모의 하위그룹으로 지정되고 노드는 컨테이너에 유지된다
  const separate = {
    ...spec,
    groups: [
      { id: 'cloud', type: 'AWS', label: 'Cloud', bounds: { x: 800, y: 800, width: 600, height: 500 } },
      { id: 'docker', type: 'DOCKER', label: 'Docker', bounds: { x: 200, y: 200, width: 300, height: 250 } }
    ],
    nodes: [
      { id: 'app', type: 'APP', label: 'App', groupId: 'docker', position: { x: 250, y: 260 } }
    ]
  };
  let cloudEncloses = moveArchitectureGroup(separate, 'cloud', { x: 150, y: 150 }, true);
  assert.equal(cloudEncloses.groups.find(g => g.id === 'docker').parentId, 'cloud');
  assert.equal(cloudEncloses.nodes.find(n => n.id === 'app').groupId, 'docker');
});

test('아이콘 라벨 길이에 따라 카드 너비가 유동적으로 조절된다',()=>{
  // 짧은 이름은 최소 기준 너비(68) 유지
  assert.equal(architectureNodeWidth('DB'), 68);
  assert.equal(architectureNodeWidth('Redis'), 68);
  assert.equal(architectureNodeWidth(''), 68);

  // 긴 영문/한글 이름은 글씨가 온전히 들어가도록 너비가 확장됨
  const postgresWidth = architectureNodeWidth('PostgreSQL');
  assert.ok(postgresWidth >= 80, `PostgreSQL width should be >= 80, got ${postgresWidth}`);

  const springGatewayWidth = architectureNodeWidth('Spring Cloud Gateway');
  assert.ok(springGatewayWidth >= 130, `Spring Cloud Gateway width should be >= 130, got ${springGatewayWidth}`);

  const koreanServiceWidth = architectureNodeWidth('사용자 인증 및 인가 서비스');
  assert.ok(koreanServiceWidth >= 140, `Korean service width should be >= 140, got ${koreanServiceWidth}`);
});

test('기존 그룹 안에 새로운 커스텀 그룹을 넣거나 바깥에 더 큰 그룹을 감싸면 부모-자식 계층이 형성되고 함께 이동한다', () => {
  const spec = {
    schemaVersion: 1,
    groups: [
      { id: 'g_existing', type: 'CUSTOM', label: 'Existing Group', bounds: { x: 100, y: 100, width: 500, height: 400 } },
      { id: 'g_new', type: 'CUSTOM', label: 'New Inner Group', bounds: { x: 800, y: 100, width: 220, height: 160 } }
    ],
    nodes: [
      { id: 'n1', type: 'APP', label: 'Node 1', groupId: 'g_existing', position: { x: 200, y: 220 } },
      { id: 'n2', type: 'APP', label: 'Node 2', groupId: 'g_existing', position: { x: 400, y: 220 } }
    ],
    edges: []
  };

  // 1. g_new를 g_existing 내부의 n1 위로 이동하여 드롭:
  // g_new는 g_existing의 자식 그룹이 되고, n1을 감싸 n1의 groupId는 g_new가 된다. n2는 g_existing에 남는다.
  const nested = moveArchitectureGroup(spec, 'g_new', { x: 160, y: 170 }, true);
  assert.equal(nested.groups.find(g => g.id === 'g_new').parentId, 'g_existing');
  assert.equal(nested.nodes.find(n => n.id === 'n1').groupId, 'g_new');
  assert.equal(nested.nodes.find(n => n.id === 'n2').groupId, 'g_existing');

  // 부모 그룹(g_existing)을 50px 이동하면 자식 그룹(g_new)과 n1, n2 모두 50px 함께 이동한다.
  const parentMoved = moveArchitectureGroup(nested, 'g_existing', { x: 150, y: 150 }, true);
  assert.equal(parentMoved.groups.find(g => g.id === 'g_new').bounds.x, 210);
  assert.equal(parentMoved.groups.find(g => g.id === 'g_new').bounds.y, 220);
  assert.equal(parentMoved.nodes.find(n => n.id === 'n1').position.x, 250);
  assert.equal(parentMoved.nodes.find(n => n.id === 'n2').position.x, 450);

  // 2. 자식 그룹(g_new)을 g_existing 바깥으로 드래그하여 드롭하면 부모 관계가 해제된다.
  const unnested = moveArchitectureGroup(nested, 'g_new', { x: 800, y: 100 }, true);
  assert.equal(unnested.groups.find(g => g.id === 'g_new').parentId, null);
  // g_new에 속해있던 n1도 g_new와 함께 바깥으로 이동되어 g_new에 유지된다.
  assert.equal(unnested.nodes.find(n => n.id === 'n1').groupId, 'g_new');

  // 3. 기존 그룹 바깥에 더 큰 그룹을 감싸는 경우 (외부 그룹을 이동해 기존 그룹을 감싸기)
  const outerSpec = {
    schemaVersion: 1,
    groups: [
      { id: 'g_inner', type: 'CUSTOM', label: 'Inner Service', bounds: { x: 200, y: 200, width: 250, height: 180 } },
      { id: 'g_outer', type: 'CUSTOM', label: 'Outer VPC', bounds: { x: 700, y: 700, width: 550, height: 450 } }
    ],
    nodes: [
      { id: 'innerNode', type: 'APP', label: 'App', groupId: 'g_inner', position: { x: 250, y: 260 } }
    ],
    edges: []
  };
  const outerMoved = moveArchitectureGroup(outerSpec, 'g_outer', { x: 150, y: 150 }, true);
  assert.equal(outerMoved.groups.find(g => g.id === 'g_inner').parentId, 'g_outer');
  assert.equal(outerMoved.nodes.find(n => n.id === 'innerNode').groupId, 'g_inner');

  // 4. 기존 그룹 바깥에 더 큰 그룹을 크기 조절(resize)로 감싸는 경우
  const resizeSpec = {
    schemaVersion: 1,
    groups: [
      { id: 'g_inner', type: 'CUSTOM', label: 'Inner Service', bounds: { x: 200, y: 200, width: 250, height: 180 } },
      { id: 'g_outer', type: 'CUSTOM', label: 'Outer VPC', bounds: { x: 150, y: 150, width: 200, height: 150 } }
    ],
    nodes: [
      { id: 'innerNode', type: 'APP', label: 'App', groupId: 'g_inner', position: { x: 250, y: 260 } }
    ],
    edges: []
  };
  // 5. 다단계 중첩: 자식 그룹(docker)을 이미 포함하고 있는 상위 그룹(oracle) 바깥에 더 큰 그룹(big)을 감싸면 3단계 계층이 형성되고 모두 함께 이동한다
  const multiLevelSpec = {
    schemaVersion: 1,
    groups: [
      { id: 'oracle', type: 'CLOUD', label: 'Oracle Cloud', bounds: { x: 300, y: 200, width: 400, height: 350 } },
      { id: 'docker', type: 'CONTAINER', label: 'Docker', parentId: 'oracle', bounds: { x: 350, y: 280, width: 250, height: 200 } },
      { id: 'big', type: 'CUSTOM', label: 'Global Infrastructure', bounds: { x: 800, y: 800, width: 700, height: 600 } }
    ],
    nodes: [
      { id: 'apiNode', type: 'APP', label: 'API', groupId: 'docker', position: { x: 380, y: 340 } },
      { id: 'cloudNode', type: 'STORAGE', label: 'Storage', groupId: 'oracle', position: { x: 350, y: 240 } }
    ],
    edges: []
  };
  const bigEncloses = moveArchitectureGroup(multiLevelSpec, 'big', { x: 250, y: 150 }, true);
  assert.equal(bigEncloses.groups.find(g => g.id === 'oracle').parentId, 'big');
  assert.equal(bigEncloses.groups.find(g => g.id === 'docker').parentId, 'oracle');
  assert.equal(bigEncloses.nodes.find(n => n.id === 'apiNode').groupId, 'docker');
  assert.equal(bigEncloses.nodes.find(n => n.id === 'cloudNode').groupId, 'oracle');

  // big을 이동하면 oracle, docker, apiNode, cloudNode 모두 함께 이동한다
  const movedBig = moveArchitectureGroup(bigEncloses, 'big', { x: 300, y: 200 }, true);
  assert.equal(movedBig.groups.find(g => g.id === 'oracle').bounds.x, 350);
  assert.equal(movedBig.groups.find(g => g.id === 'docker').bounds.x, 400);
  assert.equal(movedBig.nodes.find(n => n.id === 'apiNode').position.x, 430);
  assert.equal(movedBig.nodes.find(n => n.id === 'cloudNode').position.x, 400);

  // 6. CLOUD 타입 그룹(Cloudflare 등)도 외부 그룹에 의해 자식 그룹으로 감싸질 수 있다
  const cloudSpec = {
    schemaVersion: 1,
    groups: [
      { id: 'cf', type: 'CLOUD', label: 'Cloudflare', bounds: { x: 200, y: 200, width: 300, height: 250 } },
      { id: 'wrapper', type: 'CUSTOM', label: 'Wrapper', bounds: { x: 150, y: 150, width: 500, height: 400 } }
    ],
    nodes: [
      { id: 'cfNode', type: 'APP', label: 'Edge', groupId: 'cf', position: { x: 220, y: 260 } }
    ],
    edges: []
  };
  const wrapped = settleArchitectureHierarchy(cloudSpec);
  assert.equal(wrapped.groups.find(g => g.id === 'cf').parentId, 'wrapper');
  assert.equal(wrapped.nodes.find(n => n.id === 'cfNode').groupId, 'cf');
});


test('자동 경계는 빈 자식과 다단계 하위 그룹의 경계까지 감싼다', () => {
  const spec = {
    schemaVersion: 1,
    groups: [
      { id: 'outer', type: 'CLOUD', label: 'Outer' },
      { id: 'middle', type: 'CUSTOM', label: 'Middle', parentId: 'outer' },
      { id: 'inner', type: 'CONTAINER', label: 'Inner', parentId: 'middle', bounds: { x: 500, y: 500, width: 300, height: 200 } }
    ],
    nodes: [], edges: []
  };
  // Input order must not determine whether the child bounds have been calculated.
  for (const groups of [spec.groups, [...spec.groups].reverse()]) {
    const layout = architectureLayout({ ...spec, groups });
    for (const [parentId, childId] of [['outer', 'middle'], ['middle', 'inner']]) {
      const parent = layout.groups.get(parentId), child = layout.groups.get(childId);
      assert.ok(parent.x < child.x && parent.y < child.y);
      assert.ok(parent.x + parent.width > child.x + child.width);
      assert.ok(parent.y + parent.height > child.y + child.height);
    }
    const settled = settleArchitectureHierarchy({ ...spec, groups });
    assert.equal(settled.groups.find(g => g.id === 'inner').parentId, 'middle');
    assert.equal(settled.groups.find(g => g.id === 'middle').parentId, 'outer');
  }
});

test('자동 정렬은 긴 라벨이 있는 루트·직접 그룹·컨테이너 노드를 겹치지 않게 배치한다', () => {
  const label = '이것은최대너비까지확장되는매우긴서비스이름입니다';
  const groups = [
    { id: 'cloud', type: 'CLOUD', label: 'Cloud' },
    { id: 'container', type: 'CONTAINER', label: 'Container', parentId: 'cloud' }
  ];
  const elements = [null, 'cloud', 'container'].flatMap((groupId, lane) =>
    Array.from({ length: 3 }, (_, index) => ({ id: `${lane}-${index}`, type: 'APP', label, groupId })));
  const layout = architectureLayout({ schemaVersion: 1, groups, nodes: elements, edges: [] });
  for (let i = 0; i < elements.length; i++) {
    for (let j = i + 1; j < elements.length; j++) {
      const a = layout.positions.get(elements[i].id), b = layout.positions.get(elements[j].id);
      assert.ok(a.x + architectureNodeWidth(elements[i].label) <= b.x || b.x + architectureNodeWidth(elements[j].label) <= a.x || a.y + ARCH_NODE_HEIGHT <= b.y || b.y + ARCH_NODE_HEIGHT <= a.y, `${elements[i].id} overlaps ${elements[j].id}`);
    }
  }
  const maximum = { schemaVersion: 1, groups: [], nodes: Array.from({ length: 30 }, (_, i) => ({ id: `n${i}`, type: 'APP', label })), edges: [] };
  parseArchitectureSpec(materializeArchitecture(maximum));
  const nestedMaximum = { ...maximum, groups: [{ id: "cloud", type: "CLOUD", label: "Cloud" }, ...Array.from({ length: 9 }, (_, i) => ({ id: `d${i}`, type: "CONTAINER", label: "Container", parentId: "cloud" }))], nodes: maximum.nodes.map(node => ({ ...node, groupId: "d8" })) };
  parseArchitectureSpec(materializeArchitecture(nestedMaximum));
});

test('아이콘을 그룹의 상단·중단·하단 어느 위치에 드롭해도 정상적으로 그룹에 포함된다', () => {
  const spec = {
    schemaVersion: 1,
    groups: [
      { id: 'cluster', type: 'CUSTOM', label: 'Cluster', bounds: { x: 100, y: 100, width: 400, height: 350 } }
    ],
    nodes: [
      { id: 'node1', type: 'APP', label: 'App', groupId: null, position: { x: 800, y: 800 } }
    ],
    edges: []
  };

  // 1. 그룹 상단 영역 (y = box.y + 8, 과거 box.y + 32 미만으로 잡히지 않던 영역)에 드롭
  const droppedAtTop = moveArchitectureNode(spec, 'node1', { x: 150, y: 108 }, true);
  assert.equal(droppedAtTop.nodes.find(n => n.id === 'node1').groupId, 'cluster');

  // 그룹을 이동하면 상단에 들어간 노드도 함께 이동한다
  const groupMoved = moveArchitectureGroup(droppedAtTop, 'cluster', { x: 200, y: 200 }, true);
  assert.equal(groupMoved.nodes.find(n => n.id === 'node1').position.x, 250);
  assert.equal(groupMoved.nodes.find(n => n.id === 'node1').position.y, 208);

  // 2. 그룹 중단 영역에 드롭
  const droppedAtMid = moveArchitectureNode(spec, 'node1', { x: 150, y: 250 }, true);
  assert.equal(droppedAtMid.nodes.find(n => n.id === 'node1').groupId, 'cluster');

  // 3. 그룹 바깥으로 드롭하면 그룹 해제
  const droppedOutside = moveArchitectureNode(droppedAtTop, 'node1', { x: 800, y: 800 }, true);
  assert.equal(droppedOutside.nodes.find(n => n.id === 'node1').groupId, null);
});

test('그룹에 속했던 아이콘이 그룹 바깥에 위치할 때 그룹을 이동해도 바깥 아이콘은 따라 움직이지 않고 연결이 해제된다', () => {
  const spec = {
    schemaVersion: 1,
    groups: [
      { id: 'group1', type: 'CUSTOM', label: 'My Group', bounds: { x: 100, y: 100, width: 300, height: 250 } }
    ],
    nodes: [
      { id: 'insideNode', type: 'APP', label: 'Inside', groupId: 'group1', position: { x: 150, y: 150 } },
      // 바깥으로 옮겼으나 포인터 캡처 유실/비정상 종료 등으로 groupId가 여전히 남아있는 비정상 상태 가정
      { id: 'outsideNode', type: 'APP', label: 'Outside', groupId: 'group1', position: { x: 800, y: 800 } }
    ],
    edges: []
  };

  // 1. 그룹 드래그 중 (finished=false): 바깥에 있는 아이콘은 절대 이동하지 않아야 함
  const dragProgress = moveArchitectureGroup(spec, 'group1', { x: 200, y: 150 }, false);
  const insideDrag = dragProgress.nodes.find(n => n.id === 'insideNode');
  const outsideDrag = dragProgress.nodes.find(n => n.id === 'outsideNode');

  // 내부 노드는 그룹과 함께 +100, +50 이동
  assert.deepEqual(insideDrag.position, { x: 250, y: 200 });
  assert.equal(insideDrag.groupId, 'group1');
  // 바깥 노드는 원래 좌표(800, 800) 유지 및 stale groupId 즉시 해제
  assert.deepEqual(outsideDrag.position, { x: 800, y: 800 });
  assert.equal(outsideDrag.groupId, null);

  // 2. 그룹 드롭 완료 (finished=true): 바깥 노드는 여전히 원래 좌표 유지
  const dropped = moveArchitectureGroup(spec, 'group1', { x: 200, y: 150 }, true);
  const insideDrop = dropped.nodes.find(n => n.id === 'insideNode');
  const outsideDrop = dropped.nodes.find(n => n.id === 'outsideNode');

  assert.deepEqual(insideDrop.position, { x: 250, y: 200 });
  assert.equal(insideDrop.groupId, 'group1');
  assert.deepEqual(outsideDrop.position, { x: 800, y: 800 });
  assert.equal(outsideDrop.groupId, null);

  // 3. 다중 선택 이동(moveArchitectureSelection)에서도 동일하게 바깥 아이콘은 그룹과 함께 움직이지 않음
  const selectionMoved = moveArchitectureSelection(spec, [], ['group1'], { x: 50, y: 50 }, true);
  const insideSel = selectionMoved.nodes.find(n => n.id === 'insideNode');
  const outsideSel = selectionMoved.nodes.find(n => n.id === 'outsideNode');

  assert.deepEqual(insideSel.position, { x: 200, y: 200 });
  assert.equal(insideSel.groupId, 'group1');
  assert.deepEqual(outsideSel.position, { x: 800, y: 800 });
  assert.equal(outsideSel.groupId, null);
});

test('자동 연결선은 직각(orthogonal) 경로를 생성하고 다중 연결 시 포트 오프셋이 적용된다', () => {
  const from = { x: 100, y: 100, width: 120, height: 76 };
  const to = { x: 400, y: 200, width: 120, height: 76 };
  const edge = { id: 'e1', source: 'a', target: 'b' };

  // 1. 기본 직각 경로 생성 확인
  const route = architectureEdgeRoute(edge, from, to);
  assert.ok(route.path.startsWith('M'));
  assert.ok(route.path.includes('L') || route.path.includes('Q'));
  assert.ok(!route.path.includes('C'), '수동 waypoint가 없을 때는 베지에 곡선(C) 대신 직각(L/Q) 경로여야 함');

  // 2. 포트 오프셋 (sourceOffset, targetOffset) 적용 시 시작점/도착점이 이동하는지 확인
  const routeWithOffsets = architectureEdgeRoute(edge, from, to, {
    sourceOffset: { y: 12 },
    targetOffset: { y: -12 },
  });
  assert.notDeepEqual(routeWithOffsets.start, route.start);
  assert.notDeepEqual(routeWithOffsets.end, route.end);

  // 3. 수동 waypoint가 있는 경우에도 직각(L/Q) 경로를 유지하며 조절점 일치
  const manualRoute = architectureEdgeRoute({ ...edge, waypoint: { x: 260, y: 200 } }, from, to);
  assert.ok(!manualRoute.path.includes('C'), '수동 waypoint가 지정된 경우에도 직각(L/Q) 경로여야 함');
  assert.deepEqual(manualRoute.bend, { x: 260, y: 200 });
});
