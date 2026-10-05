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
 const path=manual ? `M${start.x} ${start.y} C${c1.x} ${c1.y},${bend.x} ${bend.y},${bend.x} ${bend.y} C${bend.x} ${bend.y},${c2.x} ${c2.y},${end.x} ${end.y}` : `M${start.x} ${start.y} C${c1.x} ${c1.y},${c2.x} ${c2.y},${end.x} ${end.y}`;
 return {path,start,end,bend,label:{x:bend.x,y:bend.y-8}};
}
