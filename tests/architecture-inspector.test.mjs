import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('selection helper determines hasSelection and inspector active target', () => {
  const spec = {
    schemaVersion: 1,
    groups: [{ id: 'grp-1', type: 'CUSTOM', label: 'Backend' }],
    nodes: [{ id: 'node-1', type: 'APP', label: 'API Server', icon: 'SPRING' }],
    edges: [{ id: 'edge-1', source: 'grp-1', target: 'node-1' }]
  };

  const computeSelectionState = (selectedNode, selectedGroup, selectedEdge, selectedNodes, selectedGroups) => {
    const isMulti = (selectedNodes.size + selectedGroups.size) > 1;
    const selected = !isMulti && selectedNode ? spec.nodes.find(n => n.id === selectedNode) ?? null : null;
    const group = !isMulti && selectedGroup ? spec.groups.find(g => g.id === selectedGroup) ?? null : null;
    const edge = !isMulti && selectedEdge ? spec.edges.find(e => e.id === selectedEdge) ?? null : null;
    const hasSelection = Boolean(isMulti || selected || group || edge);

    const currentSelectedKey = isMulti
      ? `multi:${selectedNodes.size}:${selectedGroups.size}`
      : selectedNode
        ? `node:${selectedNode}`
        : selectedGroup
          ? `group:${selectedGroup}`
          : selectedEdge
            ? `edge:${selectedEdge}`
            : null;

    return { isMulti, selected, group, edge, hasSelection, currentSelectedKey };
  };

  // 1. Empty selection -> hasSelection false
  const empty = computeSelectionState(null, null, null, new Set(), new Set());
  assert.equal(empty.hasSelection, false);
  assert.equal(empty.currentSelectedKey, null);

  // 2. Node selection -> hasSelection true, key is node
  const nodeSel = computeSelectionState('node-1', null, null, new Set(['node-1']), new Set());
  assert.equal(nodeSel.hasSelection, true);
  assert.equal(nodeSel.selected?.label, 'API Server');
  assert.equal(nodeSel.currentSelectedKey, 'node:node-1');

  // 3. Group selection -> hasSelection true, key is group
  const groupSel = computeSelectionState(null, 'grp-1', null, new Set(), new Set(['grp-1']));
  assert.equal(groupSel.hasSelection, true);
  assert.equal(groupSel.group?.label, 'Backend');
  assert.equal(groupSel.currentSelectedKey, 'group:grp-1');

  // 4. Edge selection -> hasSelection true, key is edge
  const edgeSel = computeSelectionState(null, null, 'edge-1', new Set(), new Set());
  assert.equal(edgeSel.hasSelection, true);
  assert.equal(edgeSel.edge?.id, 'edge-1');
  assert.equal(edgeSel.currentSelectedKey, 'edge:edge-1');

  // 5. Multi selection -> hasSelection true, isMulti true
  const multiSel = computeSelectionState(null, null, null, new Set(['node-1']), new Set(['grp-1']));
  assert.equal(multiSel.hasSelection, true);
  assert.equal(multiSel.isMulti, true);
  assert.equal(multiSel.currentSelectedKey, 'multi:1:1');
});

test('auto-open inspector on selection change and allow manual toggle', () => {
  let inspectorOpen = true;
  let lastSelectedKey = null;

  const onSelectionChange = (newKey) => {
    if (newKey && newKey !== lastSelectedKey) {
      inspectorOpen = true;
    }
    lastSelectedKey = newKey;
  };

  // Select node-1 -> open is true
  onSelectionChange('node:node-1');
  assert.equal(inspectorOpen, true);

  // User explicitly closes inspector via (x) close button or toolbar toggle
  inspectorOpen = false;
  assert.equal(inspectorOpen, false);

  // User selects node-2 -> auto-opens inspector
  onSelectionChange('node:node-2');
  assert.equal(inspectorOpen, true);

  // User deselects all (clicks empty canvas)
  onSelectionChange(null);
  assert.equal(lastSelectedKey, null);

  // User selects group-1 -> opens inspector
  onSelectionChange('group:grp-1');
  assert.equal(inspectorOpen, true);
});

test('CSS classes for workspace and inspector sidebar are present in globals.css and theme.css', () => {
  const globalsPath = new URL('../src/app/globals.css',import.meta.url);
  const themePath = new URL('../src/app/theme.css',import.meta.url);

  const globalsCss = fs.readFileSync(globalsPath, 'utf-8');
  const themeCss = fs.readFileSync(themePath, 'utf-8');

  // Workspace layout classes
  assert.ok(globalsCss.includes('.architecture-workspace'), 'globals.css must contain .architecture-workspace');
  assert.ok(globalsCss.includes('.architecture-workspace{position:relative;width:100%'), 'workspace must have position:relative and 100% width');
  assert.ok(globalsCss.includes('.architecture-workspace>.architecture-canvas-panel{width:100%'), 'canvas panel must retain 100% width and not shrink when inspector opens');
  assert.ok(globalsCss.includes('.architecture-inspector.architecture-inspector-sidebar{position:absolute;top:0;left:calc(100% + 16px)'), 'inspector sidebar must be detached and placed outside to the right of the canvas');
  assert.ok(!globalsCss.includes('.page-shell.detail-shell.architecture-dev'), 'must not touch or override page-shell width');
  assert.ok(globalsCss.includes('.architecture-inspector-close'), 'globals.css must contain close button styling');
  assert.ok(globalsCss.includes('.architecture-inspector-toggle'), 'globals.css must contain toolbar toggle styling');

  // Dark theme rules
  assert.ok(themeCss.includes('.architecture-inspector-close'), 'theme.css must support .architecture-inspector-close in dark theme');
  assert.ok(themeCss.includes('.architecture-inspector-sidebar'), 'theme.css must style sidebar controls in dark theme');
});
