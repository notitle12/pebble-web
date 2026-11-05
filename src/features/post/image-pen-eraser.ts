import type {ImageEditOperation,PenPoint,PenOperation} from './image-edit-model.ts';

function distanceToSegment(point:PenPoint,a:PenPoint,b:PenPoint):number {
 const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
 const t=length?Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/length)):0;
 return (point.x-a.x-t*dx)**2+(point.y-a.y-t*dy)**2;
}
function segmentsTouch(a:PenPoint,b:PenPoint,c:PenPoint,d:PenPoint,radius:number):boolean {
 if(Math.max(a.x,b.x)+radius<Math.min(c.x,d.x)||Math.max(c.x,d.x)+radius<Math.min(a.x,b.x)||Math.max(a.y,b.y)+radius<Math.min(c.y,d.y)||Math.max(c.y,d.y)+radius<Math.min(a.y,b.y))return false;
 const cross=(p:PenPoint,q:PenPoint,r:PenPoint)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
 // Proper intersections have zero distance even when neither endpoint is nearby.
 if(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)return true;
 return Math.min(distanceToSegment(a,c,d),distanceToSegment(b,c,d),distanceToSegment(c,a,b),distanceToSegment(d,a,b))<=radius*radius;
}
function touchesPen(operation:PenOperation,points:PenPoint[],width:number):boolean {
 for(let i=0;i<operation.points.length;i++)for(let j=0;j<points.length;j++){
  if(segmentsTouch(operation.points[i],operation.points[Math.min(i+1,operation.points.length-1)],points[j],points[Math.min(j+1,points.length-1)],(width+operation.width)/2))return true;
 }
 return false;
}
/** Mask pen ink only. Earlier strokes retain their original coordinates through crops. */
export function eraseImagePen(operations:ImageEditOperation[],points:PenPoint[],width:number):ImageEditOperation[] {
 if(!points.length||!Number.isFinite(width)||width<=0||points.some(point=>!Number.isFinite(point.x)||!Number.isFinite(point.y)))return operations;
 let offsetX=0,offsetY=0,changed=false;
 const next=operations.slice();
 for(let index=operations.length-1;index>=0;index--){
  const operation=operations[index];
  if(operation.type==='crop'){offsetX+=operation.x;offsetY+=operation.y;continue;}
  if(operation.type!=='pen')continue;
  const sourcePoints=points.slice(0,5000).map(point=>({x:point.x+offsetX,y:point.y+offsetY}));
  if(!touchesPen(operation,sourcePoints,width))continue;
  next[index]={...operation,erasures:[...(operation.erasures??[]),{points:sourcePoints,width:Math.max(1,Math.min(128,width))}]};changed=true;
 }
 return changed?next:operations;
}
