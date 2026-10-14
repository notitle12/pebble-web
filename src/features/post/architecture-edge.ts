import type { ArchitectureEdge, ArchitectureSide } from './api/post-list.ts';
import type { ArchBox, ArchPoint } from './architecture-layout.ts';
export const architectureAnchor = (box: ArchBox,side: ArchitectureSide):ArchPoint => side==='TOP' ? {x:box.x+box.width/2,y:box.y} : side==='BOTTOM' ? {x:box.x+box.width/2,y:box.y+box.height} : side==='LEFT' ? {x:box.x,y:box.y+box.height/2} : {x:box.x+box.width,y:box.y+box.height/2};
const normal = (side:ArchitectureSide) => side==='TOP'?{x:0,y:-1}:side==='BOTTOM'?{x:0,y:1}:side==='LEFT'?{x:-1,y:0}:{x:1,y:0};
export function architectureEdgeRoute(edge:ArchitectureEdge,from:ArchBox,to:ArchBox) {
 const dx=to.x+to.width/2-from.x-from.width/2, dy=to.y+to.height/2-from.y-from.height/2;
 const sourceSide=edge.sourceSide ?? (Math.abs(dx)>=Math.abs(dy) ? dx>=0?'RIGHT':'LEFT' : dy>=0?'BOTTOM':'TOP');
 const targetSide=edge.targetSide ?? (Math.abs(dx)>=Math.abs(dy) ? dx>=0?'LEFT':'RIGHT' : dy>=0?'TOP':'BOTTOM');
 const start=architectureAnchor(from,sourceSide), end=architectureAnchor(to,targetSide);
 const a=normal(sourceSide), b=normal(targetSide);
 const distance=Math.max(36,Math.min(160,Math.hypot(end.x-start.x,end.y-start.y)*.35));
 const c1={x:start.x+a.x*distance,y:start.y+a.y*distance},c2={x:end.x+b.x*distance,y:end.y+b.y*distance};
 const automatic={x:(start.x+3*c1.x+3*c2.x+end.x)/8,y:(start.y+3*c1.y+3*c2.y+end.y)/8};
 // A coincident pair still has an editable route rather than a zero-length stroke.
 const bend=edge.waypoint ?? (Math.hypot(end.x-start.x,end.y-start.y)<1 ? {x:Math.min(4200,start.x+80),y:Math.max(0,start.y-80)} : automatic);
 const manual=Boolean(edge.waypoint)||Math.hypot(end.x-start.x,end.y-start.y)<1;
 // Both cubic segments share the same non-zero tangent at the dragged point.
 // Repeating the waypoint as a control point makes their direction discontinuous.
 const span={x:end.x-start.x,y:end.y-start.y};
 const magnitude=Math.hypot(span.x,span.y);
 const tangent=magnitude>1?{x:span.x/magnitude,y:span.y/magnitude}:{x:-a.y,y:a.x};
 const reach=Math.max(12,Math.min(120,Math.min(Math.hypot(bend.x-start.x,bend.y-start.y),Math.hypot(end.x-bend.x,end.y-bend.y))*.35));
 const before={x:bend.x-tangent.x*reach,y:bend.y-tangent.y*reach},after={x:bend.x+tangent.x*reach,y:bend.y+tangent.y*reach};
 const path=manual ? `M${start.x} ${start.y} C${c1.x} ${c1.y},${before.x} ${before.y},${bend.x} ${bend.y} C${after.x} ${after.y},${c2.x} ${c2.y},${end.x} ${end.y}` : `M${start.x} ${start.y} C${c1.x} ${c1.y},${c2.x} ${c2.y},${end.x} ${end.y}`;
 return {path,start,end,bend,label:{x:bend.x,y:bend.y-8}};
}
