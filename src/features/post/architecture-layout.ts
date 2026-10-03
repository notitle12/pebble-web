import type { ArchitectureSpec } from "./api/post-list.ts";

export const ARCH_NODE_WIDTH = 160;
export const ARCH_NODE_HEIGHT = 76;
export type ArchPoint = { x: number; y: number };
export type ArchBox = { x: number; y: number; width: number; height: number };
const autoPositions = (spec: ArchitectureSpec) => {
  const result = new Map<string, ArchPoint>();
  const roots = spec.nodes.filter((node) => !node.groupId);
  roots.forEach((node, index) => result.set(node.id, { x: 48 + index % 2 * 180, y: 96 + Math.floor(index / 2) * 112 }));
  const columns = spec.groups.filter((group) => group.type !== "DOCKER" || !group.parentId);
  columns.forEach((column, columnIndex) => {
    const lane = columnIndex + (roots.length ? 1 : 0);
    const direct = spec.nodes.filter((node) => node.groupId === column.id);
    direct.forEach((node, index) => result.set(node.id, { x: 48 + lane * 370 + index % 2 * 180, y: 96 + Math.floor(index / 2) * 112 }));
    const dockers = spec.groups.filter((group) => group.type === "DOCKER" && group.parentId === column.id);
    let dockerTop = 200 + Math.ceil(direct.length / 2) * 112;
    dockers.forEach((docker) => {
      const members = spec.nodes.filter((node) => node.groupId === docker.id);
      members.forEach((node, index) => result.set(node.id, { x: 48 + lane * 370 + index % 2 * 180, y: dockerTop + Math.floor(index / 2) * 112 }));
      dockerTop += Math.max(120, Math.ceil(members.length / 2) * 112 + 82);
    });
  });
  spec.nodes.forEach((node, index) => { if (!result.has(node.id)) result.set(node.id, { x: 48 + index % 4 * 230, y: 72 + Math.floor(index / 4) * 148 }); });
  return result;
};
export function architectureLayout(spec: ArchitectureSpec): { positions: Map<string, ArchPoint>; groups: Map<string, ArchBox>; width: number; height: number } {
  const positions = autoPositions(spec);
  spec.nodes.forEach((node) => { if (node.position) positions.set(node.id, node.position); });
  const groups = new Map<string, ArchBox>();
  [...spec.groups].sort((a, b) => Number(a.type !== "DOCKER") - Number(b.type !== "DOCKER")).forEach((group) => {
    if (group.bounds) { groups.set(group.id, group.bounds); return; }
    const memberIds = new Set(spec.nodes.filter((node) => node.groupId === group.id || (group.type !== "DOCKER" && spec.groups.some((child) => child.id === node.groupId && child.parentId === group.id))).map((node) => node.id));
    const points = Array.from(memberIds, (nodeId) => positions.get(nodeId)!);
    const nested = spec.groups.filter((child) => child.type === "DOCKER" && child.parentId === group.id).map((child) => groups.get(child.id)).filter((box): box is ArchBox => Boolean(box));
    const allLeft = [...points.map((point) => point.x), ...nested.map((box) => box.x)];
    const allTop = [...points.map((point) => point.y), ...nested.map((box) => box.y)];
    const allRight = [...points.map((point) => point.x + ARCH_NODE_WIDTH), ...nested.map((box) => box.x + box.width)];
    const allBottom = [...points.map((point) => point.y + ARCH_NODE_HEIGHT), ...nested.map((box) => box.y + box.height)];
    if (!allLeft.length) { const index = spec.groups.findIndex((item) => item.id === group.id); const box = { x: 24 + index * 300, y: 24, width: 230, height: 124 }; groups.set(group.id, box); return; }
    const paddingLeft = group.type === "DOCKER" ? 18 : 24;
    const paddingTop = group.type === "DOCKER" ? 38 : 42;
    const paddingBottom = group.type === "DOCKER" ? 18 : 24;
    const x = Math.max(0, Math.min(...allLeft) - paddingLeft);
    const y = Math.max(0, Math.min(...allTop) - paddingTop);
    groups.set(group.id, { x, y, width: Math.max(...allRight) - x + paddingLeft, height: Math.max(...allBottom) - y + paddingBottom });
  });
  const width = Math.max(620, ...Array.from(positions.values(), (point) => point.x + ARCH_NODE_WIDTH + 64), ...Array.from(groups.values(), (box) => box.x + box.width + 32));
  const height = Math.max(420, ...Array.from(positions.values(), (point) => point.y + ARCH_NODE_HEIGHT + 64), ...Array.from(groups.values(), (box) => box.y + box.height + 32));
  return { positions, groups, width, height };
}
