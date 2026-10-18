import type { ArchitectureSpec } from './api/post-list.ts';
import { isArchitectureContainer, isDescendant, getAllDescendantGroupIds } from './architecture-groups.ts';
import { architectureLayout, ARCH_NODE_WIDTH, ARCH_NODE_HEIGHT, type ArchBox, type ArchPoint, architectureNodeWidth } from './architecture-layout.ts';

export { isDescendant, getAllDescendantGroupIds };

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(n)));

export function materializeArchitecture(spec: ArchitectureSpec): ArchitectureSpec {
  const layout = architectureLayout(spec);
  return {
    ...spec,
    groups: spec.groups.map(group => ({
      ...group,
      bounds: group.bounds ?? {
        ...layout.groups.get(group.id)!,
        width: Math.min(4200 - layout.groups.get(group.id)!.x, Math.max(200, layout.groups.get(group.id)!.width)),
        height: Math.min(4200 - layout.groups.get(group.id)!.y, Math.max(120, layout.groups.get(group.id)!.height))
      }
    })),
    nodes: spec.nodes.map(node => ({
      ...node,
      position: node.position ?? layout.positions.get(node.id)!
    }))
  };
}

export const canBeChildGroup = (_type: string) => true;
export const canBeParentGroup = (type: string) => !isArchitectureContainer(type);

export const containsNode = (box: ArchBox, point: ArchPoint, width = ARCH_NODE_WIDTH) =>
  point.x >= box.x - 8 &&
  point.y >= box.y + 32 &&
  point.x + width <= box.x + box.width + 8 &&
  point.y + ARCH_NODE_HEIGHT <= box.y + box.height + 8;

export const containsGroup = (parentBox: ArchBox, childBox: ArchBox) => {
  if (parentBox.width * parentBox.height <= childBox.width * childBox.height) return false;
  const childCenterX = childBox.x + childBox.width / 2;
  const childCenterY = childBox.y + childBox.height / 2;
  const centerInside = childCenterX >= parentBox.x && childCenterX <= parentBox.x + parentBox.width &&
                       childCenterY >= parentBox.y && childCenterY <= parentBox.y + parentBox.height;

  const ix1 = Math.max(parentBox.x, childBox.x);
  const iy1 = Math.max(parentBox.y, childBox.y);
  const ix2 = Math.min(parentBox.x + parentBox.width, childBox.x + childBox.width);
  const iy2 = Math.min(parentBox.y + parentBox.height, childBox.y + childBox.height);
  const iw = Math.max(0, ix2 - ix1);
  const ih = Math.max(0, iy2 - iy1);
  const intersectionArea = iw * ih;
  const childArea = childBox.width * childBox.height;

  if (centerInside && intersectionArea >= childArea * 0.5) return true;

  return childBox.x >= parentBox.x - 16 &&
         childBox.y >= parentBox.y - 16 &&
         childBox.x + childBox.width <= parentBox.x + parentBox.width + 16 &&
         childBox.y + childBox.height <= parentBox.y + parentBox.height + 16;
};

export function settleArchitectureHierarchy(spec: ArchitectureSpec): ArchitectureSpec {
  const current = materializeArchitecture(spec);
  const layout = architectureLayout(current);

  // 1. Resolve parentId for groups:
  // - Any group can be a child as long as parent is not a container and no cycle is created.
  // - Innermost enclosing group (smallest area) wins.
  const updatedGroups = current.groups.map(group => {
    if (!canBeChildGroup(group.type)) {
      return group.parentId ? { ...group, parentId: null } : group;
    }
    const groupBox = layout.groups.get(group.id)!;
    const candidateParents = current.groups.filter(parent =>
      parent.id !== group.id &&
      canBeParentGroup(parent.type) &&
      !isDescendant(current.groups, group.id, parent.id) &&
      containsGroup(layout.groups.get(parent.id)!, groupBox)
    );
    candidateParents.sort((a, b) => {
      const boxA = layout.groups.get(a.id)!, boxB = layout.groups.get(b.id)!;
      return (boxA.width * boxA.height - boxB.width * boxB.height) || a.id.localeCompare(b.id);
    });
    const bestParentId = candidateParents[0]?.id ?? null;
    return group.parentId !== bestParentId ? { ...group, parentId: bestParentId } : group;
  });

  // 2. Resolve groupId for nodes:
  // - Existing group members stay in their group unless an explicit child group inside it encloses them.
  // - Other moving/overlapping groups do NOT steal existing group members.
  // - Standalone nodes (groupId == null) get captured into the innermost enclosing group.
  const updatedNodes = current.nodes.map(node => {
    const nodePos = layout.positions.get(node.id)!;
    const nodeWidth = architectureNodeWidth(node.label);
    const enclosingGroups = updatedGroups.filter(group =>
      containsNode(layout.groups.get(group.id)!, nodePos, nodeWidth)
    );

    const prevGroupId = node.groupId;
    const prevGroupStillEncloses = prevGroupId && enclosingGroups.some(g => g.id === prevGroupId);

    if (prevGroupStillEncloses) {
      // Check if an explicit child group inside prevGroup specifically encloses this node:
      const childGroup = enclosingGroups.find(g => g.parentId === prevGroupId);
      if (childGroup) {
        return { ...node, groupId: childGroup.id };
      }
      return node;
    }

    // Node was standalone (no previous group) or its previous group no longer encloses it:
    if (enclosingGroups.length === 0) {
      return node.groupId !== null ? { ...node, groupId: null } : node;
    }

    // Pick the most specific enclosing group (innermost group wins)
    enclosingGroups.sort((a, b) => {
      if (isDescendant(updatedGroups, b.id, a.id)) return -1;
      if (isDescendant(updatedGroups, a.id, b.id)) return 1;
      const boxA = layout.groups.get(a.id)!, boxB = layout.groups.get(b.id)!;
      return (boxA.width * boxA.height - boxB.width * boxB.height) || a.id.localeCompare(b.id);
    });

    const bestGroupId = enclosingGroups[0]?.id ?? null;
    return node.groupId !== bestGroupId ? { ...node, groupId: bestGroupId } : node;
  });

  return { ...current, groups: updatedGroups, nodes: updatedNodes };
}

export const captureArchitectureNodes = settleArchitectureHierarchy;

export function moveArchitectureNode(spec: ArchitectureSpec, id: string, point: ArchPoint, finished = false): ArchitectureSpec {
  const current = materializeArchitecture(spec);
  const next = {
    ...current,
    nodes: current.nodes.map(node => node.id === id ? { ...node, position: { x: clamp(point.x, 0, 4000), y: clamp(point.y, 0, 4000) } } : node)
  };
  if (!finished) return next;
  // Node was explicitly moved by user. When finished, find which group contains this moved node:
  const layout = architectureLayout(next);
  const nodePos = layout.positions.get(id)!;
  const node = next.nodes.find(n => n.id === id);
  const nodeWidth = architectureNodeWidth(node?.label);
  const enclosingGroups = next.groups.filter(group => containsNode(layout.groups.get(group.id)!, nodePos, nodeWidth));
  enclosingGroups.sort((a, b) => {
    if (isDescendant(next.groups, b.id, a.id)) return -1;
    if (isDescendant(next.groups, a.id, b.id)) return 1;
    const boxA = layout.groups.get(a.id)!, boxB = layout.groups.get(b.id)!;
    return (boxA.width * boxA.height - boxB.width * boxB.height) || a.id.localeCompare(b.id);
  });
  const newGroupId = enclosingGroups[0]?.id ?? null;
  return {
    ...next,
    nodes: next.nodes.map(node => node.id === id ? { ...node, groupId: newGroupId } : node)
  };
}

export function moveArchitectureGroup(spec: ArchitectureSpec, id: string, point: ArchPoint, finished = false): ArchitectureSpec {
  const current = materializeArchitecture(spec);
  const target = current.groups.find(group => group.id === id);
  if (!target?.bounds) return spec;
  const descendantIds = getAllDescendantGroupIds(current.groups, id);
  const ids = new Set([id, ...descendantIds]);
  const movingGroups = current.groups.filter(group => ids.has(group.id));
  const movingNodes = current.nodes.filter(node => ids.has(node.groupId ?? ''));
  const movingEndpoints = new Set([...ids, ...movingNodes.map(node => node.id)]);
  const movingEdges = current.edges.filter(edge => movingEndpoints.has(edge.source) && movingEndpoints.has(edge.target) && edge.waypoint);
  let minX = -Math.min(...movingGroups.map(g => g.bounds!.x), ...(movingNodes.length ? movingNodes.map(n => n.position!.x) : [Infinity]));
  let minY = -Math.min(...movingGroups.map(g => g.bounds!.y), ...(movingNodes.length ? movingNodes.map(n => n.position!.y) : [Infinity]));
  let maxX = Math.min(...movingGroups.map(g => 4200 - g.bounds!.x - g.bounds!.width), ...(movingNodes.length ? movingNodes.map(n => 4000 - n.position!.x) : [Infinity]), ...movingGroups.map(g => 4000 - g.bounds!.x));
  let maxY = Math.min(...movingGroups.map(g => 4200 - g.bounds!.y - g.bounds!.height), ...(movingNodes.length ? movingNodes.map(n => 4000 - n.position!.y) : [Infinity]), ...movingGroups.map(g => 4000 - g.bounds!.y));
  if (movingEdges.length) {
    minX = Math.max(minX, -Math.min(...movingEdges.map(edge => edge.waypoint!.x)));
    minY = Math.max(minY, -Math.min(...movingEdges.map(edge => edge.waypoint!.y)));
    maxX = Math.min(maxX, 4200 - Math.max(...movingEdges.map(edge => edge.waypoint!.x)));
    maxY = Math.min(maxY, 4200 - Math.max(...movingEdges.map(edge => edge.waypoint!.y)));
  }
  const dx = clamp(point.x - target.bounds.x, minX, maxX);
  const dy = clamp(point.y - target.bounds.y, minY, maxY);
  const next: ArchitectureSpec = {
    ...current,
    edges: current.edges.map(edge => movingEdges.includes(edge) ? { ...edge, waypoint: { x: edge.waypoint!.x + dx, y: edge.waypoint!.y + dy } } : edge),
    groups: current.groups.map(group => ids.has(group.id) ? { ...group, bounds: { ...group.bounds!, x: group.bounds!.x + dx, y: group.bounds!.y + dy } } : group),
    nodes: current.nodes.map(node => ids.has(node.groupId ?? '') ? { ...node, position: { x: node.position!.x + dx, y: node.position!.y + dy } } : node)
  };
  return finished ? settleArchitectureHierarchy(next) : next;
}

export function resizeArchitectureGroup(spec: ArchitectureSpec, id: string, size: { width: number; height: number }): ArchitectureSpec {
  const current = materializeArchitecture(spec);
  const target = current.groups.find(group => group.id === id);
  if (!target?.bounds) return spec;
  const descendantIds = getAllDescendantGroupIds(current.groups, id);
  const children = current.groups.filter(group => descendantIds.has(group.id));
  const minWidth = Math.max(200, ...children.map(g => g.bounds!.x + g.bounds!.width - target.bounds!.x));
  const minHeight = Math.max(120, ...children.map(g => g.bounds!.y + g.bounds!.height - target.bounds!.y));
  const next: ArchitectureSpec = {
    ...current,
    groups: current.groups.map(group => group.id === id ? { ...group, bounds: { ...group.bounds!, width: clamp(size.width, minWidth, 4200 - group.bounds!.x), height: clamp(size.height, minHeight, 4200 - group.bounds!.y) } } : group)
  };
  return settleArchitectureHierarchy(next);
}

export type ArchRect = { minX: number; minY: number; maxX: number; maxY: number };

export function isNodeInMarquee(nodeBox: ArchBox, marquee: ArchRect): boolean {
  return !(
    nodeBox.x + nodeBox.width < marquee.minX ||
    nodeBox.x > marquee.maxX ||
    nodeBox.y + nodeBox.height < marquee.minY ||
    nodeBox.y > marquee.maxY
  );
}

export function isGroupInMarquee(groupBox: ArchBox, marquee: ArchRect): boolean {
  if (
    marquee.minX <= groupBox.x &&
    marquee.maxX >= groupBox.x + groupBox.width &&
    marquee.minY <= groupBox.y &&
    marquee.maxY >= groupBox.y + groupBox.height
  ) {
    return true;
  }
  if (
    marquee.minX >= groupBox.x &&
    marquee.maxX <= groupBox.x + groupBox.width &&
    marquee.minY >= groupBox.y &&
    marquee.maxY <= groupBox.y + groupBox.height
  ) {
    return false;
  }
  const headerBottom = groupBox.y + 34;
  const intersectsHeader = !(
    groupBox.x + groupBox.width < marquee.minX ||
    groupBox.x > marquee.maxX ||
    headerBottom < marquee.minY ||
    groupBox.y > marquee.maxY
  );
  if (intersectsHeader) return true;

  const ix1 = Math.max(groupBox.x, marquee.minX);
  const iy1 = Math.max(groupBox.y, marquee.minY);
  const ix2 = Math.min(groupBox.x + groupBox.width, marquee.maxX);
  const iy2 = Math.min(groupBox.y + groupBox.height, marquee.maxY);
  const iw = Math.max(0, ix2 - ix1);
  const ih = Math.max(0, iy2 - iy1);
  return (iw * ih) >= (groupBox.width * groupBox.height * 0.6);
}

export function moveArchitectureSelection(
  spec: ArchitectureSpec,
  selectedNodeIds: string[],
  selectedGroupIds: string[],
  delta: ArchPoint,
  finished = false
): ArchitectureSpec {
  const current = materializeArchitecture(spec);

  const selectedGroupsSet = new Set(selectedGroupIds);
  const selectedNodesSet = new Set(selectedNodeIds);

  const allMovingGroupIds = new Set<string>();
  for (const gid of selectedGroupsSet) {
    allMovingGroupIds.add(gid);
    for (const did of getAllDescendantGroupIds(current.groups, gid)) {
      allMovingGroupIds.add(did);
    }
  }

  const movingNodeIds = new Set<string>();
  for (const node of current.nodes) {
    if (selectedNodesSet.has(node.id) || (node.groupId && allMovingGroupIds.has(node.groupId))) {
      movingNodeIds.add(node.id);
    }
  }

  const movingGroups = current.groups.filter(g => allMovingGroupIds.has(g.id));
  const movingNodes = current.nodes.filter(n => movingNodeIds.has(n.id));

  if (movingGroups.length === 0 && movingNodes.length === 0) return spec;

  let minX = -Math.min(
    ...(movingGroups.length ? movingGroups.map(g => g.bounds!.x) : [Infinity]),
    ...(movingNodes.length ? movingNodes.map(n => n.position!.x) : [Infinity])
  );
  let minY = -Math.min(
    ...(movingGroups.length ? movingGroups.map(g => g.bounds!.y) : [Infinity]),
    ...(movingNodes.length ? movingNodes.map(n => n.position!.y) : [Infinity])
  );
  let maxX = Math.min(
    ...(movingGroups.length ? movingGroups.map(g => Math.min(4200 - g.bounds!.x - g.bounds!.width, 4000 - g.bounds!.x)) : [Infinity]),
    ...(movingNodes.length ? movingNodes.map(n => 4000 - n.position!.x) : [Infinity])
  );
  let maxY = Math.min(
    ...(movingGroups.length ? movingGroups.map(g => Math.min(4200 - g.bounds!.y - g.bounds!.height, 4000 - g.bounds!.y)) : [Infinity]),
    ...(movingNodes.length ? movingNodes.map(n => 4000 - n.position!.y) : [Infinity])
  );

  const movingEndpoints = new Set([...allMovingGroupIds, ...movingNodeIds]);
  const movingEdges = current.edges.filter(
    edge => movingEndpoints.has(edge.source) && movingEndpoints.has(edge.target) && edge.waypoint
  );

  if (movingEdges.length) {
    minX = Math.max(minX, -Math.min(...movingEdges.map(e => e.waypoint!.x)));
    minY = Math.max(minY, -Math.min(...movingEdges.map(e => e.waypoint!.y)));
    maxX = Math.min(maxX, 4200 - Math.max(...movingEdges.map(e => e.waypoint!.x)));
    maxY = Math.min(maxY, 4200 - Math.max(...movingEdges.map(e => e.waypoint!.y)));
  }

  const dx = clamp(delta.x, minX, maxX);
  const dy = clamp(delta.y, minY, maxY);

  const next: ArchitectureSpec = {
    ...current,
    edges: current.edges.map(edge => movingEdges.includes(edge) ? {
      ...edge,
      waypoint: { x: edge.waypoint!.x + dx, y: edge.waypoint!.y + dy }
    } : edge),
    groups: current.groups.map(group => allMovingGroupIds.has(group.id) ? {
      ...group,
      bounds: { ...group.bounds!, x: group.bounds!.x + dx, y: group.bounds!.y + dy }
    } : group),
    nodes: current.nodes.map(node => movingNodeIds.has(node.id) ? {
      ...node,
      position: { x: node.position!.x + dx, y: node.position!.y + dy }
    } : node)
  };

  return finished ? settleArchitectureHierarchy(next) : next;
}

export function deleteArchitectureSelection(
  spec: ArchitectureSpec,
  selectedNodeIds: string[],
  selectedGroupIds: string[]
): ArchitectureSpec {
  const current = materializeArchitecture(spec);
  const nodeSet = new Set(selectedNodeIds);
  const groupSet = new Set(selectedGroupIds);
  if (nodeSet.size === 0 && groupSet.size === 0) return spec;

  const allRemovedGroupIds = new Set<string>();
  for (const gid of groupSet) {
    allRemovedGroupIds.add(gid);
    for (const did of getAllDescendantGroupIds(current.groups, gid)) {
      allRemovedGroupIds.add(did);
    }
  }

  return settleArchitectureHierarchy({
    ...current,
    groups: current.groups.filter(g => !allRemovedGroupIds.has(g.id)),
    nodes: current.nodes
      .filter(n => !nodeSet.has(n.id))
      .map(n => allRemovedGroupIds.has(n.groupId ?? '') ? { ...n, groupId: null } : n),
    edges: current.edges.filter(edge =>
      !nodeSet.has(edge.source) &&
      !nodeSet.has(edge.target) &&
      !allRemovedGroupIds.has(edge.source) &&
      !allRemovedGroupIds.has(edge.target)
    )
  });
}
