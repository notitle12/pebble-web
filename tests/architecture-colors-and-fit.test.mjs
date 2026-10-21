import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArchitectureSpec } from '../src/features/post/api/post-list.ts';
import { ARCHITECTURE_GROUP_COLORS, ARCHITECTURE_GROUP_COLOR_IDS } from '../src/features/post/architecture-groups.ts';
import { getArchitectureContentBounds, architectureLayout } from '../src/features/post/architecture-layout.ts';

test('10 pastel group colors are defined with unique IDs, labels, hex backgrounds, and borders', () => {
  assert.equal(ARCHITECTURE_GROUP_COLORS.length, 10, 'Must have 10 group colors');
  assert.equal(ARCHITECTURE_GROUP_COLOR_IDS.length, 10);

  const expectedIds = ["BLUE", "GREEN", "PURPLE", "AMBER", "ROSE", "PEACH", "TEAL", "INDIGO", "PINK", "GRAY"];
  assert.deepEqual([...ARCHITECTURE_GROUP_COLOR_IDS], expectedIds);

  const seenIds = new Set();
  for (const color of ARCHITECTURE_GROUP_COLORS) {
    assert.ok(!seenIds.has(color.id), `Duplicate color id: ${color.id}`);
    seenIds.add(color.id);
    assert.ok(color.label && color.label.length > 0, `Missing label for color ${color.id}`);
    assert.match(color.hex, /^#[0-9a-fA-F]{6}$/, `Invalid hex color for ${color.id}`);
    assert.match(color.border, /^#[0-9a-fA-F]{6}$/, `Invalid border color for ${color.id}`);
    assert.match(color.dot, /^#[0-9a-fA-F]{6}$/, `Invalid dot color for ${color.id}`);
  }
});

test('parseArchitectureSpec validates and accepts any of the 10 group colors and rejects invalid colors', () => {
  const baseSpec = {
    schemaVersion: 1,
    groups: [
      { id: 'g1', type: 'CLOUD', label: '운영 환경', color: 'BLUE' }
    ],
    nodes: [
      { id: 'n1', type: 'APP', label: 'Spring Boot', groupId: 'g1', position: { x: 100, y: 100 } }
    ],
    edges: []
  };

  // Test all 10 valid colors
  for (const colorId of ARCHITECTURE_GROUP_COLOR_IDS) {
    const spec = JSON.parse(JSON.stringify(baseSpec));
    spec.groups[0].color = colorId;
    const parsed = parseArchitectureSpec(spec);
    assert.equal(parsed.groups[0].color, colorId);
  }

  // Optional / null color
  {
    const spec = JSON.parse(JSON.stringify(baseSpec));
    spec.groups[0].color = null;
    const parsed = parseArchitectureSpec(spec);
    assert.equal(parsed.groups[0].color, null);
  }
  {
    const spec = JSON.parse(JSON.stringify(baseSpec));
    delete spec.groups[0].color;
    const parsed = parseArchitectureSpec(spec);
    assert.equal(parsed.groups[0].color, undefined);
  }

  // Reject invalid color name
  {
    const spec = JSON.parse(JSON.stringify(baseSpec));
    spec.groups[0].color = 'NEON_RED';
    assert.throws(() => parseArchitectureSpec(spec));
  }
  // Reject non-string color
  {
    const spec = JSON.parse(JSON.stringify(baseSpec));
    spec.groups[0].color = 123;
    assert.throws(() => parseArchitectureSpec(spec));
  }
});

test('getArchitectureContentBounds accurately calculates bounding box across nodes, groups, and edge waypoints', () => {
  const spec = {
    schemaVersion: 1,
    groups: [
      { id: 'g1', type: 'CLOUD', label: 'VPC', bounds: { x: 50, y: 40, width: 600, height: 350 }, color: 'TEAL' }
    ],
    nodes: [
      { id: 'n1', type: 'CLIENT', label: 'Web', position: { x: 80, y: 100 } },
      { id: 'n2', type: 'APP', label: 'API Server', position: { x: 300, y: 200 } }
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', waypoint: { x: 750, y: 450 } }
    ]
  };

  const layout = architectureLayout(spec);
  const bounds = getArchitectureContentBounds(spec, layout);

  // Group left is 50, top is 40. Node 1 is at (80, 100).
  assert.equal(bounds.minX, 50, 'minX should match leftmost group or element (50)');
  assert.equal(bounds.minY, 40, 'minY should match topmost group or element (40)');

  // Group right is 50 + 600 = 650. Waypoint right is 750.
  assert.equal(bounds.maxX, 750, 'maxX should include waypoint at 750');
  // Group bottom is 40 + 350 = 390. Waypoint y is 450.
  assert.equal(bounds.maxY, 450, 'maxY should include waypoint at 450');

  assert.equal(bounds.width, 700); // 750 - 50
  assert.equal(bounds.height, 410); // 450 - 40
});

test('getArchitectureContentBounds handles empty/minimal spec without negative dimensions', () => {
  const spec = {
    schemaVersion: 1,
    groups: [],
    nodes: [
      { id: 'n1', type: 'APP', label: 'Single', position: { x: 120, y: 150 } }
    ],
    edges: []
  };

  const layout = architectureLayout(spec);
  const bounds = getArchitectureContentBounds(spec, layout);

  assert.equal(bounds.minX, 120);
  assert.equal(bounds.minY, 150);
  assert.ok(bounds.width >= 68);
  assert.ok(bounds.height >= 70);
});
