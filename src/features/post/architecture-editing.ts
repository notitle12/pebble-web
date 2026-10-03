import type { ArchitectureSpec } from './api/post-list.ts';
import { architectureLayout, ARCH_NODE_WIDTH, ARCH_NODE_HEIGHT, type ArchBox, type ArchPoint } from './architecture-layout.ts';
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(n)));
export function materializeArchitecture(spec: ArchitectureSpec): ArchitectureSpec {
  const layout = architectureLayout(spec);
  return { ...spec, groups: spec.groups.map(group => ({ ...group, bounds: group.bounds ?? { ...layout.groups.get(group.id)!, width: Math.min(4200-layout.groups.get(group.id)!.x, Math.max(200, layout.groups.get(group.id)!.width)), height: Math.min(4200-layout.groups.get(group.id)!.y, Math.max(120, layout.groups.get(group.id)!.height)) } })), nodes: spec.nodes.map(node => ({ ...node, position: node.position ?? layout.positions.get(node.id)! })) };
}
const contains = (box: ArchBox, point: ArchPoint) => point.x >= box.x && point.y >= box.y + 32 && point.x + ARCH_NODE_WIDTH <= box.x + box.width && point.y + ARCH_NODE_HEIGHT <= box.y + box.height;
export function captureArchitectureNodes(spec: ArchitectureSpec): ArchitectureSpec {
  const layout = architectureLayout(spec);
  return { ...spec, nodes: spec.nodes.map(node => {
    const candidates = spec.groups.filter(group => contains(layout.groups.get(group.id)!, layout.positions.get(node.id)!));
    // Nested Docker wins over its parent; overlapping peers use smallest area then stable ID.
    candidates.sort((a,b) => a.parentId === b.id ? -1 : b.parentId === a.id ? 1 : (layout.groups.get(a.id)!.width * layout.groups.get(a.id)!.height - layout.groups.get(b.id)!.width * layout.groups.get(b.id)!.height) || a.id.localeCompare(b.id));
    return { ...node, groupId: candidates[0]?.id ?? null };
  }) };
}
export function moveArchitectureNode(spec: ArchitectureSpec, id: string, point: ArchPoint, finished = false): ArchitectureSpec {
  const current = materializeArchitecture(spec);
  const next = { ...current, nodes: current.nodes.map(node => node.id === id ? { ...node, position: { x: clamp(point.x,0,4000), y: clamp(point.y,0,4000) } } : node) };
  return finished ? captureArchitectureNodes(next) : next;
}
export function moveArchitectureGroup(spec: ArchitectureSpec, id: string, point: ArchPoint): ArchitectureSpec {
  const current = captureArchitectureNodes(materializeArchitecture(spec));
  const target = current.groups.find(group => group.id === id);
  if (!target?.bounds) return spec;
  const ids = new Set([id, ...current.groups.filter(group => group.parentId === id).map(group => group.id)]);
  const movingGroups = current.groups.filter(group => ids.has(group.id));
  const movingNodes = current.nodes.filter(node => ids.has(node.groupId ?? ''));
  const movingEndpoints = new Set([...ids,...movingNodes.map(node=>node.id)]);
  const movingEdges = current.edges.filter(edge=>movingEndpoints.has(edge.source)&&movingEndpoints.has(edge.target)&&edge.waypoint);
  const parent = current.groups.find(group => group.id === target.parentId)?.bounds;
  let minX = -Math.min(...movingGroups.map(g=>g.bounds!.x), ...movingNodes.map(n=>n.position!.x));
  let minY = -Math.min(...movingGroups.map(g=>g.bounds!.y), ...movingNodes.map(n=>n.position!.y));
  let maxX = Math.min(...movingGroups.map(g=>4200-g.bounds!.x-g.bounds!.width), ...movingNodes.map(n=>4000-n.position!.x), ...movingGroups.map(g=>4000-g.bounds!.x));
  let maxY = Math.min(...movingGroups.map(g=>4200-g.bounds!.y-g.bounds!.height), ...movingNodes.map(n=>4000-n.position!.y), ...movingGroups.map(g=>4000-g.bounds!.y));
  if (parent && target.bounds.width <= parent.width && target.bounds.height <= parent.height-32) {
    minX = Math.max(minX,parent.x-target.bounds.x); minY = Math.max(minY,parent.y+32-target.bounds.y);
    maxX = Math.min(maxX,parent.x+parent.width-target.bounds.x-target.bounds.width); maxY = Math.min(maxY,parent.y+parent.height-target.bounds.y-target.bounds.height);
  }
  if (movingEdges.length) {
    minX=Math.max(minX,-Math.min(...movingEdges.map(edge=>edge.waypoint!.x))); minY=Math.max(minY,-Math.min(...movingEdges.map(edge=>edge.waypoint!.y)));
    maxX=Math.min(maxX,4200-Math.max(...movingEdges.map(edge=>edge.waypoint!.x))); maxY=Math.min(maxY,4200-Math.max(...movingEdges.map(edge=>edge.waypoint!.y)));
  }
  const dx = clamp(point.x-target.bounds.x,minX,maxX), dy = clamp(point.y-target.bounds.y,minY,maxY);
  return { ...current, edges:current.edges.map(edge=>movingEdges.includes(edge)?{...edge,waypoint:{x:edge.waypoint!.x+dx,y:edge.waypoint!.y+dy}}:edge), groups: current.groups.map(group=>ids.has(group.id) ? { ...group, bounds: { ...group.bounds!, x:group.bounds!.x+dx,y:group.bounds!.y+dy } } : group), nodes: current.nodes.map(node=>ids.has(node.groupId ?? '') ? { ...node, position:{x:node.position!.x+dx,y:node.position!.y+dy} } : node) };
}
export function resizeArchitectureGroup(spec: ArchitectureSpec,id:string,size:{width:number;height:number}): ArchitectureSpec {
  const current = materializeArchitecture(spec);
  const target = current.groups.find(group=>group.id===id);
  if (!target?.bounds) return spec;
  const children = current.groups.filter(group=>group.parentId===id);
  const minWidth = Math.max(200,...children.map(g=>g.bounds!.x+g.bounds!.width-target.bounds!.x));
  const minHeight = Math.max(120,...children.map(g=>g.bounds!.y+g.bounds!.height-target.bounds!.y));
  return captureArchitectureNodes({ ...current, groups:current.groups.map(group=>group.id===id ? { ...group,bounds:{...group.bounds!,width:clamp(size.width,minWidth,4200-group.bounds!.x),height:clamp(size.height,minHeight,4200-group.bounds!.y)} } : group) });
}
