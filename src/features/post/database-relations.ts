import {relationCardinality,type DatabaseSchema} from './database-schema.ts';
export type DbPoint={x:number;y:number};
export type DbRect={x:number;y:number;width:number;height:number};
export type DbSize={width:number;height:number};
type Port=DbPoint&{angle:number;normal:DbPoint};
function ports(r:DbRect,row?:number):Port[]{if(row!==undefined){const y=Math.max(r.y+16,Math.min(r.y+r.height-8,row));return [{x:r.x+r.width,y,angle:0,normal:{x:1,y:0}},{x:r.x,y,angle:180,normal:{x:-1,y:0}}];}return [
 {x:r.x+r.width,y:r.y+r.height/2,angle:0,normal:{x:1,y:0}},
 {x:r.x+r.width/2,y:r.y+r.height,angle:90,normal:{x:0,y:1}},
 {x:r.x,y:r.y+r.height/2,angle:180,normal:{x:-1,y:0}},
 {x:r.x+r.width/2,y:r.y,angle:270,normal:{x:0,y:-1}},
 ];}
export function segmentHitsRect(a:DbPoint,b:DbPoint,r:DbRect){
 if(a.x===b.x)return a.x>r.x+.1&&a.x<r.x+r.width-.1&&Math.max(a.y,b.y)>r.y+.1&&Math.min(a.y,b.y)<r.y+r.height-.1;
 if(a.y===b.y)return a.y>r.y+.1&&a.y<r.y+r.height-.1&&Math.max(a.x,b.x)>r.x+.1&&Math.min(a.x,b.x)<r.x+r.width-.1;
 return true;
}
function compact(points:DbPoint[]){
 const result:DbPoint[]=[];
 for(const p of points){const last=result.at(-1);if(last?.x===p.x&&last?.y===p.y)continue;result.push(p);}
 for(let i=1;i<result.length-1;){const a=result[i-1],b=result[i],c=result[i+1];if((a.x===b.x&&b.x===c.x&&(b.y-a.y)*(c.y-b.y)<0)||(a.y===b.y&&b.y===c.y&&(b.x-a.x)*(c.x-b.x)<0))return null;
 if(a.x===b.x&&b.x===c.x||a.y===b.y&&b.y===c.y)result.splice(i,1);else i++;}
 return result;
}
// Shared end stubs are unavoidable when several FKs reference one PK; separate their middle lanes.
function overlapCost(points:DbPoint[],used:DbPoint[][]){
 let cost=0;
 for(let i=1;i<points.length-2;i++)for(const path of used.slice(-24))for(let j=1;j<path.length-2;j++){
  const a=points[i],b=points[i+1],c=path[j],d=path[j+1];
  if(a.x===b.x&&c.x===d.x&&a.x===c.x)cost+=Math.max(0,Math.min(Math.max(a.y,b.y),Math.max(c.y,d.y))-Math.max(Math.min(a.y,b.y),Math.min(c.y,d.y)));
  if(a.y===b.y&&c.y===d.y&&a.y===c.y)cost+=Math.max(0,Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x))-Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x)));
 }
 return cost*6;
}
export type DbRelationBend = {
 axis: 'x' | 'y';
 value: number;
 min: number;
 max: number;
 mid: DbPoint;
 start: DbPoint;
 end: DbPoint;
};

export function detectBend(points: DbPoint[], obstacles: DbRect[]): DbRelationBend | undefined {
 if (points.length < 4) return undefined;
 let bestBend: DbRelationBend | undefined;
 let bestSpan = -1;
 for (let i = 1; i <= points.length - 3; i++) {
  const prev = points[i - 1], curr = points[i], next = points[i + 1], post = points[i + 2];
  if (curr.x === next.x && prev.y === curr.y && next.y === post.y) {
   const y1 = Math.min(curr.y, next.y), y2 = Math.max(curr.y, next.y);
   const currentX = curr.x;
   let minX = 16;
   let maxX = Math.max(...obstacles.map(r => r.x + r.width)) + 120;
   const leftAnchor = Math.min(prev.x, post.x);
   const rightAnchor = Math.max(prev.x, post.x);
   if (currentX >= rightAnchor - 1) {
    minX = Math.max(minX, rightAnchor + 8);
   } else if (currentX <= leftAnchor + 1) {
    maxX = Math.min(maxX, leftAnchor - 8);
   } else {
    minX = Math.max(minX, leftAnchor + 8);
    maxX = Math.min(maxX, rightAnchor - 8);
   }
   for (const r of obstacles) {
    if (!(r.y + r.height <= y1 || r.y >= y2)) {
     if (r.x + r.width <= currentX) minX = Math.max(minX, r.x + r.width + 12);
     if (r.x >= currentX) maxX = Math.min(maxX, r.x - 12);
    }
   }
   minX = Math.min(minX, currentX);
   maxX = Math.max(maxX, currentX);
   const span = Math.abs(curr.y - next.y);
   if (span > bestSpan) {
    bestSpan = span;
    bestBend = { axis: 'x', value: currentX, min: minX, max: maxX, mid: { x: currentX, y: (curr.y + next.y) / 2 }, start: curr, end: next };
   }
  }
  if (curr.y === next.y && prev.x === curr.x && next.x === post.x) {
   const x1 = Math.min(curr.x, next.x), x2 = Math.max(curr.x, next.x);
   const currentY = curr.y;
   let minY = 16;
   let maxY = Math.max(...obstacles.map(r => r.y + r.height)) + 120;
   const topAnchor = Math.min(prev.y, post.y);
   const bottomAnchor = Math.max(prev.y, post.y);
   if (currentY >= bottomAnchor - 1) {
    minY = Math.max(minY, bottomAnchor + 8);
   } else if (currentY <= topAnchor + 1) {
    maxY = Math.min(maxY, topAnchor - 8);
   } else {
    minY = Math.max(minY, topAnchor + 8);
    maxY = Math.min(maxY, bottomAnchor - 8);
   }
   for (const r of obstacles) {
    if (!(r.x + r.width <= x1 || r.x >= x2)) {
     if (r.y + r.height <= currentY) minY = Math.max(minY, r.y + r.height + 12);
     if (r.y >= currentY) maxY = Math.min(maxY, r.y - 12);
    }
   }
   minY = Math.min(minY, currentY);
   maxY = Math.max(maxY, currentY);
   const span = Math.abs(curr.x - next.x);
   if (span > bestSpan) {
    bestSpan = span;
    bestBend = { axis: 'y', value: currentY, min: minY, max: maxY, mid: { x: (curr.x + next.x) / 2, y: currentY }, start: curr, end: next };
   }
  }
 }
 return bestBend;
}

/** Pick the shortest clear orthogonal route between column anchors or outward-facing side centers. */
export function routeTableConnection(source:DbRect,target:DbRect,obstacles:DbRect[],self=false,options:{sourceY?:number;targetY?:number;lane?:number;used?:DbPoint[][];customBend?:number|{axis?:'x'|'y';value:number}}={}){
 const gap=Math.max(target.x-source.x-source.width,source.x-target.x-target.width,0);
 const lane=options.lane??0,stub=gap>0?Math.min(32,Math.max(4,gap/3)):32,sp=ports(source,options.sourceY),tp=ports(target,options.targetY);
 if(self){const a={...sp[0],y:options.sourceY??source.y+source.height/3},b={...tp[0],y:options.targetY??source.y+source.height*2/3},x=source.x+source.width+48+lane*16;return {source:a,target:b,points:[a,{x,y:a.y},{x,y:b.y},b]};}
 const left=Math.max(4,Math.min(...obstacles.map(r=>r.x))-40),right=Math.max(...obstacles.map(r=>r.x+r.width))+40,top=Math.max(4,Math.min(...obstacles.map(r=>r.y))-40),bottom=Math.max(...obstacles.map(r=>r.y+r.height))+40;
 const customBend=typeof options.customBend==='number'?{axis:undefined,value:options.customBend}:options.customBend;
 let best:{source:Port;target:Port;points:DbPoint[];score:number}|undefined;
 for(const a of sp)for(const b of tp){
  const u={x:a.x+a.normal.x*stub,y:a.y+a.normal.y*stub},v={x:b.x+b.normal.x*stub,y:b.y+b.normal.y*stub};
  const middles:{points:DbPoint[];bendVal?:number;bendAxis?:'x'|'y';midRef?:number}[]=[];
  if(u.x===v.x||u.y===v.y){middles.push({points:[{x:v.x,y:u.y}]},{points:[{x:u.x,y:v.y}]});}

  const minX=Math.min(u.x,v.x),maxX=Math.max(u.x,v.x),midX=(u.x+v.x)/2;
  const xCandidates=new Set<number>();
  if(customBend?.value!==undefined&&(customBend.axis==='x'||customBend.axis===undefined))xCandidates.add(customBend.value);
  xCandidates.add(midX+lane*14);
  if(maxX-minX>24){
   for(let d=0;d<=(maxX-minX)/2-8;d+=14){
    if(d===0)xCandidates.add(midX);
    else{xCandidates.add(midX-d);xCandidates.add(midX+d);}
   }
  }
  xCandidates.add(Math.max(4,left-lane*14));
  xCandidates.add(right+lane*14);
  for(const r of obstacles){xCandidates.add(Math.max(4,r.x-32-lane*8));xCandidates.add(r.x+r.width+32+lane*8);}
  for(const x of xCandidates){
   const ptA=(x-a.x)*a.normal.x>0&&(x-a.x)*a.normal.x<stub?{x,y:a.y}:u;
   const ptB=(x-b.x)*b.normal.x>0&&(x-b.x)*b.normal.x<stub?{x,y:b.y}:v;
   middles.push({points:[ptA,{x,y:a.y},{x,y:b.y},ptB],bendVal:x,bendAxis:'x',midRef:midX});
  }

  const minY=Math.min(u.y,v.y),maxY=Math.max(u.y,v.y),midY=(u.y+v.y)/2;
  const yCandidates=new Set<number>();
  if(customBend?.value!==undefined&&(customBend.axis==='y'||(customBend.axis===undefined&&Math.abs(customBend.value-midY)<Math.abs(customBend.value-midX))))yCandidates.add(customBend.value);
  yCandidates.add(midY+lane*14);
  if(maxY-minY>24){
   for(let d=0;d<=(maxY-minY)/2-8;d+=14){
    if(d===0)yCandidates.add(midY);
    else{yCandidates.add(midY-d);yCandidates.add(midY+d);}
   }
  }
  yCandidates.add(Math.max(4,top-lane*14));
  yCandidates.add(bottom+lane*14);
  for(const r of obstacles){yCandidates.add(Math.max(4,r.y-32-lane*8));yCandidates.add(r.y+r.height+32+lane*8);}
  for(const y of yCandidates){
   middles.push({points:[u,{x:u.x,y},{x:v.x,y},v],bendVal:y,bendAxis:'y',midRef:midY});
  }

  for(const {points:middle,bendVal,bendAxis,midRef} of middles){
   const points=compact([a,...middle,b]);if(!points||points.some(p=>p.x<0||p.y<0))continue;
   if(points.slice(1).some((p,i)=>obstacles.some(r=>segmentHitsRect(points[i],p,r))))continue;
   const length=points.slice(1).reduce((n,p,i)=>n+Math.abs(p.x-points[i].x)+Math.abs(p.y-points[i].y),0);
   const isCustom=customBend?.value!==undefined&&bendVal!==undefined&&Math.abs(bendVal-customBend.value)<0.5&&(customBend.axis===undefined||customBend.axis===bendAxis);
   const centerBias=bendVal!==undefined&&midRef!==undefined?Math.abs(bendVal-midRef)*0.05:0;
   const score=length+(points.length-2)*12+overlapCost(points,options.used??[])+centerBias-(isCustom?1000000:0);
   if(!best||score<best.score)best={source:a,target:b,points,score};
  }
 }
 if(best)return best;
 // Overlapping cards can cover every port. Keep the fallback outside their right edges.
 const a=sp[0],b=tp[0],x=Math.max(source.x+source.width,target.x+target.width)+48;
 return {source:a,target:b,points:[a,{x,y:a.y},{x,y:b.y},b]};
}
export function databaseLinks(schema:DatabaseSchema,_editable=false,sizes:Record<string,DbSize>={},columnY:Record<string,number>={},customBends:Record<string,number|{axis?:'x'|'y';value:number}>={}){
 const rects=Object.fromEntries(schema.tables.map(t=>[t.id,{x:t.position.x,y:t.position.y,width:sizes[t.id]?.width??280,height:sizes[t.id]?.height??42+t.columns.length*32}]));
 const used:DbPoint[][]=[],pairs=new Map<string,number>();
 const relations=schema.tables.flatMap(t=>t.columns.flatMap(c=>{
  const target=schema.tables.find(k=>k.id===c.reference?.tableId),column=target?.columns.find(k=>k.id===c.reference?.columnId);return target&&column?[{t,c,target,column}]:[];
 })).sort((a,b)=>(a.t.id+'/'+a.c.id).localeCompare(b.t.id+'/'+b.c.id));
 const targetGroups=new Map<string,{relId:string;srcY:number}[]>();
 for(const r of relations){
  const k=`${r.target.id}-${r.column.id}`;
  const srcY=columnY[`${r.t.id}-${r.c.id}`]??(r.t.position.y+40+(r.t.columns.indexOf(r.c)+.5)*32);
  const list=targetGroups.get(k)??[];
  list.push({relId:`${r.t.id}-${r.c.id}`,srcY});
  targetGroups.set(k,list);
 }
 for(const list of targetGroups.values()){
  list.sort((a,b)=>a.srcY-b.srcY);
 }
 const targetSlotMap=new Map<string,{index:number;total:number}>();
 for(const [k,list] of targetGroups.entries()){
  list.forEach((item,idx)=>{
   targetSlotMap.set(`${k}:${item.relId}`,{index:idx,total:list.length});
  });
 }
 return relations.map(({t,c,target,column})=>{
  const pair=[t.id,target.id].sort().join('/'),lane=pairs.get(pair)??0;pairs.set(pair,lane+1);
  const relId=`${t.id}-${c.id}`;
  const targetKey=`${target.id}-${column.id}`;
  const slot=targetSlotMap.get(`${targetKey}:${relId}`)??{index:0,total:1};
  const spreadOffset=slot.total>1?(slot.index-(slot.total-1)/2)*Math.min(8,20/slot.total):0;
  const srcY=columnY[`${t.id}-${c.id}`]??(t.position.y+40+(t.columns.indexOf(c)+.5)*32);
  const baseTgtY=columnY[targetKey]??(target.position.y+40+(target.columns.indexOf(column)+.5)*32);
  const tgtY=baseTgtY+spreadOffset;
  const customBend=customBends[relId];
  const route=routeTableConnection(rects[t.id],rects[target.id],Object.values(rects),t.id===target.id,{sourceY:srcY,targetY:tgtY,lane,used,customBend});
  used.push(route.points);const cardinality=relationCardinality(t,c);
  const bend=detectBend(route.points,Object.values(rects));
  return {id:relId,sourceTableId:t.id,targetTableId:target.id,sourceColumnId:c.id,targetColumnId:column.id,reference:{tableId:t.id,columnId:c.id},...route,bend,hasCustomBend:customBend!==undefined,d:route.points.map((p,i)=>`${i?'L':'M'}${p.x} ${p.y}`).join(' '),label:`${t.name}.${c.name} → ${target.name}.${column.name}`,...cardinality,notation:cardinality.notation==='CHEN'?'CHEN' as const:'IE' as const};
 });
 }
/** IE glyph in local coordinates; the entire glyph rotates with its port. */
export function crowFootPaths(x:number,y:number,direction:number,many:boolean,required:boolean){
 const max=x+direction*10,min=x+direction*23;
 return {maximum:many?`M${x} ${y-7} L${max} ${y} L${x} ${y+7}`:`M${max} ${y-7} V${y+7}`,minimum:required?`M${min} ${y-7} V${y+7}`:null,circle:required?null:{cx:min,cy:y,r:4}};
}
