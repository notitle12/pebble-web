import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isNodeInMarquee,
  isGroupInMarquee,
  moveArchitectureSelection,
  deleteArchitectureSelection
} from '../src/features/post/architecture-editing.ts';
import { ARCH_NODE_WIDTH, ARCH_NODE_HEIGHT } from '../src/features/post/architecture-layout.ts';

test('isNodeInMarquee detects when a node box intersects or is enclosed by the marquee', () => {
  const nodeBox = { x: 100, y: 100, width: ARCH_NODE_WIDTH, height: ARCH_NODE_HEIGHT };

  // Fully enclosed
  assert.equal(isNodeInMarquee(nodeBox, { minX: 50, minY: 50, maxX: 300, maxY: 300 }), true);

  // Partial intersection
  assert.equal(isNodeInMarquee(nodeBox, { minX: 120, minY: 120, maxX: 250, maxY: 250 }), true);

  // Touching edge
  assert.equal(isNodeInMarquee(nodeBox, { minX: 100 + ARCH_NODE_WIDTH, minY: 100, maxX: 300, maxY: 200 }), true);

  // Completely outside (to the left)
  assert.equal(isNodeInMarquee(nodeBox, { minX: 10, minY: 100, maxX: 80, maxY: 200 }), false);

  // Completely outside (above)
  assert.equal(isNodeInMarquee(nodeBox, { minX: 100, minY: 10, maxX: 200, maxY: 80 }), false);
});

test('isGroupInMarquee encloses, headers, overlaps, but does not select group when marquee is inside group', () => {
  const groupBox = { x: 100, y: 100, width: 400, height: 300 };

  // Fully encloses group -> selected
  assert.equal(isGroupInMarquee(groupBox, { minX: 50, minY: 50, maxX: 600, maxY: 500 }), true);

  // Completely inside group (e.g. user marquee-selecting nodes inside group) -> NOT selected
  assert.equal(isGroupInMarquee(groupBox, { minX: 150, minY: 150, maxX: 300, maxY: 250 }), false);

  // Intersects group header (top 34px: y=100..134) -> selected
  assert.equal(isGroupInMarquee(groupBox, { minX: 80, minY: 90, maxX: 200, maxY: 120 }), true);

  // Intersects content area only and <60% overlap -> NOT selected
  assert.equal(isGroupInMarquee(groupBox, { minX: 450, minY: 200, maxX: 550, maxY: 350 }), false);

  // Large overlap (>= 60% of group area: 400*300*0.6 = 72,000)
  // Overlap: x from 100 to 450 (width 400), y from 100 to 350 (height 250) -> overlap area = 100,000 >= 72,000
  assert.equal(isGroupInMarquee(groupBox, { minX: 50, minY: 100, maxX: 500, maxY: 350 }), true);
});

test('moveArchitectureSelection moves multiple nodes and groups together with waypoints', () => {
  const spec = {
    schemaVersion: 1,
    groups: [
      { id: 'g1', type: 'DOCKER', label: 'Docker', bounds: { x: 100, y: 100, width: 400, height: 300 } },
      { id: 'g2', type: 'CUSTOM', label: 'Other', bounds: { x: 600, y: 100, width: 300, height: 200 } }
    ],
    nodes: [
      { id: 'n1', type: 'APP', label: 'Node 1', groupId: 'g1', position: { x: 150, y: 150 } },
      { id: 'n2', type: 'APP', label: 'Node 2', groupId: 'g1', position: { x: 300, y: 150 } },
      { id: 'n3', type: 'APP', label: 'Node 3', position: { x: 600, y: 400 } }
    ],
    edges: [
      // Edge between n1 and n2 (both moving)
      { id: 'e1', source: 'n1', target: 'n2', waypoint: { x: 220, y: 120 } },
      // Edge between n1 (moving) and n3 (not moving)
      { id: 'e2', source: 'n1', target: 'n3', waypoint: { x: 400, y: 300 } }
    ]
  };

  // Case 1: Select only n1 and n3 (two independent nodes)
  const movedNodes = moveArchitectureSelection(spec, ['n1', 'n3'], [], { x: 50, y: 30 }, false);
  assert.deepEqual(movedNodes.nodes.find(n => n.id === 'n1').position, { x: 200, y: 180 });
  assert.deepEqual(movedNodes.nodes.find(n => n.id === 'n2').position, { x: 300, y: 150 }); // didn't move
  assert.deepEqual(movedNodes.nodes.find(n => n.id === 'n3').position, { x: 650, y: 430 });
  // Neither edge has BOTH endpoints moving, so waypoints stay
  assert.deepEqual(movedNodes.edges.find(e => e.id === 'e1').waypoint, { x: 220, y: 120 });

  // Case 2: Select g1 and n3 (group g1 moves with its nodes n1, n2, plus independent node n3)
  const movedGroupAndNode = moveArchitectureSelection(spec, ['n3'], ['g1'], { x: 40, y: 20 }, false);
  assert.deepEqual(movedGroupAndNode.groups.find(g => g.id === 'g1').bounds, { x: 140, y: 120, width: 400, height: 300 });
  assert.deepEqual(movedGroupAndNode.nodes.find(n => n.id === 'n1').position, { x: 190, y: 170 });
  assert.deepEqual(movedGroupAndNode.nodes.find(n => n.id === 'n2').position, { x: 340, y: 170 });
  assert.deepEqual(movedGroupAndNode.nodes.find(n => n.id === 'n3').position, { x: 640, y: 420 });
  // Since n1 and n2 both moved, e1's waypoint moved!
  assert.deepEqual(movedGroupAndNode.edges.find(e => e.id === 'e1').waypoint, { x: 260, y: 140 });
  // Since n1 and n3 both moved, e2's waypoint ALSO moved!
  assert.deepEqual(movedGroupAndNode.edges.find(e => e.id === 'e2').waypoint, { x: 440, y: 320 });

  // Case 3: Both g1 AND n1 are in selection -> n1 must NOT move twice!
  const movedBoth = moveArchitectureSelection(spec, ['n1'], ['g1'], { x: 40, y: 20 }, false);
  assert.deepEqual(movedBoth.nodes.find(n => n.id === 'n1').position, { x: 190, y: 170 });
});

test('deleteArchitectureSelection deletes selected elements and cleans up references', () => {
  const spec = {
    schemaVersion: 1,
    groups: [
      { id: 'parent', type: 'CUSTOM', label: 'Parent', bounds: { x: 100, y: 100, width: 600, height: 500 } },
      { id: 'child', type: 'DOCKER', label: 'Child', parentId: 'parent', bounds: { x: 150, y: 150, width: 300, height: 200 } }
    ],
    nodes: [
      { id: 'n1', type: 'APP', label: 'Node 1', groupId: 'child', position: { x: 200, y: 200 } },
      { id: 'n2', type: 'APP', label: 'Node 2', groupId: 'parent', position: { x: 500, y: 200 } },
      { id: 'n3', type: 'APP', label: 'Node 3', position: { x: 800, y: 200 } }
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'child', target: 'n3' }
    ]
  };

  // Case 1: Delete n1 and n2
  const deletedNodes = deleteArchitectureSelection(spec, ['n1', 'n2'], []);
  assert.equal(deletedNodes.nodes.length, 1);
  assert.equal(deletedNodes.nodes[0].id, 'n3');
  // Edges e1 and e2 connected to deleted nodes are removed
  assert.equal(deletedNodes.edges.length, 1);
  assert.equal(deletedNodes.edges[0].id, 'e3');

  // Case 2: Delete parent group -> child group is also removed as a descendant
  const deletedGroup = deleteArchitectureSelection(spec, [], ['parent']);
  assert.equal(deletedGroup.groups.length, 0);
  // Remaining nodes (n1, n2, n3) have their groupId reset to null
  assert.equal(deletedGroup.nodes.find(n => n.id === 'n1').groupId, null);
  assert.equal(deletedGroup.nodes.find(n => n.id === 'n2').groupId, null);
  // Edge e3 connected to child group is removed
  assert.ok(!deletedGroup.edges.some(e => e.id === 'e3'));
});


test('다중 이동은 짧은 빈 그룹의 시작 좌표도 4000 이하로 제한한다', async () => {
  const { parseArchitectureSpec } = await import('../src/features/post/api/post-list.ts');
  const spec = {
    schemaVersion: 1,
    groups: [
      { id: 'a', type: 'CUSTOM', label: 'A', bounds: { x: 0, y: 0, width: 200, height: 120 } },
      { id: 'b', type: 'CUSTOM', label: 'B', bounds: { x: 300, y: 0, width: 200, height: 120 } }
    ],
    nodes: [{ id: 'n', type: 'APP', label: 'N', position: { x: 0, y: 0 } }], edges: []
  };
  const moved = moveArchitectureSelection(spec, [], ['a', 'b'], { x: 4200, y: 4200 }, true);
  assert.equal(moved.groups[1].bounds.x, 4000);
  assert.equal(moved.groups[0].bounds.y, 4000);
  assert.equal(moved.groups[1].bounds.y, 4000);
  assert.equal(moved.groups[1].bounds.x - moved.groups[0].bounds.x, 300);
  parseArchitectureSpec(moved);
});
