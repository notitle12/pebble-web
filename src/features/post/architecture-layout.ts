import { isArchitectureContainer, isDescendant, getAllDescendantGroupIds } from "./architecture-groups.ts";
import type { ArchitectureSpec } from "./api/post-list.ts";

export const ARCH_NODE_MIN_WIDTH = 68;
export const ARCH_NODE_MAX_WIDTH = 220;
export const ARCH_NODE_WIDTH = 68;
export const ARCH_NODE_HEIGHT = 70;
export type ArchPoint = { x: number; y: number };
export type ArchBox = { x: number; y: number; width: number; height: number; anchorY?: number };

export function measureTextWidth(text: string, fontSize = 11): number {
  let width = 0;
  for (const char of Array.from(text)) {
    width += char.codePointAt(0)! > 255 ? fontSize : fontSize * 0.58;
  }
  return width;
}

export function architectureNodeWidth(label?: string | null): number {
  const text = (label || "이름 입력").trim();
  const textWidth = measureTextWidth(text, 11);
  return Math.min(ARCH_NODE_MAX_WIDTH, Math.max(ARCH_NODE_MIN_WIDTH, Math.ceil(textWidth + 16)));
}

const autoPositions = (spec: ArchitectureSpec) => {
  const result = new Map<string, ArchPoint>();
  const widestNode = Math.max(ARCH_NODE_MIN_WIDTH, ...spec.nodes.map(node => architectureNodeWidth(node.label)));
  const columnGap = Math.max(180, widestNode + 28);
  // Keep every lane within its 370px allocation; wide labels use one column.
  const columnsPerLane = widestNode + columnGap + 32 <= 370 ? 2 : 1;
  const rowGap = columnsPerLane === 1 && spec.nodes.length > 20 && spec.groups.length > 5 ? 86 : 112;
  const roots = spec.nodes.filter((node) => !node.groupId);
  roots.forEach((node, index) => result.set(node.id, { x: 48 + index % columnsPerLane * columnGap, y: 96 + Math.floor(index / columnsPerLane) * rowGap }));
  const columns = spec.groups.filter((group) => !isArchitectureContainer(group.type) || !group.parentId);
  columns.forEach((column, columnIndex) => {
    const lane = columnIndex + (roots.length ? 1 : 0);
    const direct = spec.nodes.filter((node) => node.groupId === column.id);
    direct.forEach((node, index) => result.set(node.id, { x: 48 + lane * 370 + index % columnsPerLane * columnGap, y: 96 + Math.floor(index / columnsPerLane) * rowGap }));
    const dockers = spec.groups.filter((group) => isArchitectureContainer(group.type) && group.parentId === column.id);
    let dockerTop = 200 + Math.ceil(direct.length / columnsPerLane) * rowGap;
    dockers.forEach((docker) => {
      const members = spec.nodes.filter((node) => node.groupId === docker.id);
      members.forEach((node, index) => result.set(node.id, { x: 48 + lane * 370 + index % columnsPerLane * columnGap, y: dockerTop + Math.floor(index / columnsPerLane) * rowGap }));
      dockerTop += Math.max(120, Math.ceil(members.length / columnsPerLane) * rowGap + 82);
    });
  });
  spec.nodes.forEach((node, index) => { if (!result.has(node.id)) result.set(node.id, { x: 48 + index % 4 * 230, y: 72 + Math.floor(index / 4) * 148 }); });
  return result;
};

export function architectureLayout(spec: ArchitectureSpec): { positions: Map<string, ArchPoint>; groups: Map<string, ArchBox>; width: number; height: number } {
  const positions = autoPositions(spec);
  spec.nodes.forEach((node) => { if (node.position) positions.set(node.id, node.position); });
  const groups = new Map<string, ArchBox>();
  [...spec.groups].sort((a, b) => {
    if (isDescendant(spec.groups, a.id, b.id)) return 1;
    if (isDescendant(spec.groups, b.id, a.id)) return -1;
    return Number(Boolean(b.parentId)) - Number(Boolean(a.parentId));
  }).forEach((group) => {
    if (group.bounds) { groups.set(group.id, group.bounds); return; }
    const descendantIds = getAllDescendantGroupIds(spec.groups, group.id);
    const memberIds = new Set(spec.nodes.filter((node) => node.groupId === group.id || descendantIds.has(node.groupId ?? '')).map((node) => node.id));
    const memberBoxes = Array.from(memberIds, (nodeId) => {
      const node = spec.nodes.find((n) => n.id === nodeId);
      const point = positions.get(nodeId)!;
      const width = architectureNodeWidth(node?.label);
      return { point, width };
    });
    const nested = spec.groups.filter((child) => child.parentId === group.id).map((child) => groups.get(child.id)).filter((box): box is ArchBox => Boolean(box));
    const allLeft = [...memberBoxes.map(({ point }) => point.x), ...nested.map((box) => box.x)];
    const allTop = [...memberBoxes.map(({ point }) => point.y), ...nested.map((box) => box.y)];
    const allRight = [...memberBoxes.map(({ point, width }) => point.x + width), ...nested.map((box) => box.x + box.width)];
    const allBottom = [...memberBoxes.map(({ point }) => point.y + ARCH_NODE_HEIGHT), ...nested.map((box) => box.y + box.height)];
    if (!allLeft.length) { const index = spec.groups.findIndex((item) => item.id === group.id); const box = { x: 24 + index * 300, y: 24, width: 230, height: 124 }; groups.set(group.id, box); return; }
    const isChild = Boolean(group.parentId) || isArchitectureContainer(group.type);
    const paddingLeft = isChild ? 18 : 24;
    const paddingTop = isChild ? 38 : 42;
    const paddingBottom = isChild ? 18 : 24;
    const x = Math.max(0, Math.min(...allLeft) - paddingLeft);
    const y = Math.max(0, Math.min(...allTop) - paddingTop);
    groups.set(group.id, { x, y, width: Math.max(...allRight) - x + paddingLeft, height: Math.max(...allBottom) - y + paddingBottom });
  });
  const allNodeRight = spec.nodes.map((node) => {
    const point = positions.get(node.id)!;
    return point.x + architectureNodeWidth(node.label) + 64;
  });
  const width = Math.max(680, ...spec.edges.flatMap(edge=>edge.waypoint?[edge.waypoint.x+80]:[]), ...allNodeRight, ...Array.from(groups.values(), (box) => box.x + box.width + 64));
  const height = Math.max(460, ...spec.edges.flatMap(edge=>edge.waypoint?[edge.waypoint.y+80]:[]), ...Array.from(positions.values(), (point) => point.y + ARCH_NODE_HEIGHT + 80), ...Array.from(groups.values(), (box) => box.y + box.height + 64));
  return { positions, groups, width, height };
}

export type ArchBounds = { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number };

export function getArchitectureContentBounds(
  spec: ArchitectureSpec,
  layout: { positions: Map<string, ArchPoint>; groups: Map<string, ArchBox> }
): ArchBounds {
  const allMinX: number[] = [];
  const allMinY: number[] = [];
  const allMaxX: number[] = [];
  const allMaxY: number[] = [];

  for (const node of spec.nodes) {
    const pt = layout.positions.get(node.id);
    if (pt) {
      const w = architectureNodeWidth(node.label);
      allMinX.push(pt.x);
      allMinY.push(pt.y);
      allMaxX.push(pt.x + w);
      allMaxY.push(pt.y + ARCH_NODE_HEIGHT);
    }
  }

  for (const group of spec.groups) {
    const box = layout.groups.get(group.id);
    if (box) {
      allMinX.push(box.x);
      allMinY.push(box.y);
      allMaxX.push(box.x + box.width);
      allMaxY.push(box.y + box.height);
    }
  }

  for (const edge of spec.edges) {
    if (edge.waypoint) {
      allMinX.push(edge.waypoint.x);
      allMinY.push(edge.waypoint.y);
      allMaxX.push(edge.waypoint.x);
      allMaxY.push(edge.waypoint.y);
    }
  }

  if (!allMinX.length) {
    return { minX: 0, minY: 0, maxX: 620, maxY: 420, width: 620, height: 420 };
  }

  const minX = Math.min(...allMinX);
  const minY = Math.min(...allMinY);
  const maxX = Math.max(...allMaxX);
  const maxY = Math.max(...allMaxY);

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(80, maxX - minX),
    height: Math.max(80, maxY - minY),
  };
}
