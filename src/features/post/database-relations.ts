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
/** Pick the shortest clear orthogonal route between column anchors or outward-facing side centers. */
export function routeTableConnection(source:DbRect,target:DbRect,obstacles:DbRect[],self=false,options:{sourceY?:number;targetY?:number;lane?:number;used?:DbPoint[][]}={}){
 const gap=Math.max(target.x-source.x-source.width,source.x-target.x-target.width,0);
 const lane=options.lane??0,stub=gap>0?Math.min(32,Math.max(4,gap/3)):32,sp=ports(source,options.sourceY),tp=ports(target,options.targetY);
 if(self){const a={...sp[0],y:options.sourceY??source.y+source.height/3},b={...tp[0],y:options.targetY??source.y+source.height*2/3},x=source.x+source.width+48+lane*16;return {source:a,target:b,points:[a,{x,y:a.y},{x,y:b.y},b]};}
 const left=Math.max(4,Math.min(...obstacles.map(r=>r.x))-40),right=Math.max(...obstacles.map(r=>r.x+r.width))+40,top=Math.max(4,Math.min(...obstacles.map(r=>r.y))-40),bottom=Math.max(...obstacles.map(r=>r.y+r.height))+40;
 let best:{source:Port;target:Port;points:DbPoint[];score:number}|undefined;
 for(const a of sp)for(const b of tp){
  const u={x:a.x+a.normal.x*stub,y:a.y+a.normal.y*stub},v={x:b.x+b.normal.x*stub,y:b.y+b.normal.y*stub};
  const middles:DbPoint[][]=[[{x:v.x,y:u.y}],[{x:u.x,y:v.y}]];
  for(const x of [(u.x+v.x)/2+lane*14,Math.max(4,left-lane*14),right+lane*14,...obstacles.flatMap(r=>[Math.max(4,r.x-32-lane*8),r.x+r.width+32+lane*8])])middles.push([{x,y:u.y},{x,y:v.y}]);
  for(const y of [(u.y+v.y)/2+lane*14,Math.max(4,top-lane*14),bottom+lane*14])middles.push([{x:u.x,y},{x:v.x,y}]);
  for(const middle of middles){
   const points=compact([a,u,...middle,v,b]);if(!points||points.some(p=>p.x<0||p.y<0))continue;
   if(points.slice(1).some((p,i)=>obstacles.some(r=>segmentHitsRect(points[i],p,r))))continue;
   const length=points.slice(1).reduce((n,p,i)=>n+Math.abs(p.x-points[i].x)+Math.abs(p.y-points[i].y),0),score=length+(points.length-2)*12+overlapCost(points,options.used??[]);
   if(!best||score<best.score)best={source:a,target:b,points,score};
  }
 }
 if(best)return best;
 // Overlapping cards can cover every port. Keep the fallback outside their right edges.
 const a=sp[0],b=tp[0],x=Math.max(source.x+source.width,target.x+target.width)+48;
 return {source:a,target:b,points:[a,{x,y:a.y},{x,y:b.y},b]};
}
export function databaseLinks(schema:DatabaseSchema,_editable=false,sizes:Record<string,DbSize>={}){
 const rects=Object.fromEntries(schema.tables.map(t=>[t.id,{x:t.position.x,y:t.position.y,width:sizes[t.id]?.width??280,height:sizes[t.id]?.height??42+t.columns.length*32}]));
 const used:DbPoint[][]=[],pairs=new Map<string,number>();
 const relations=schema.tables.flatMap(t=>t.columns.flatMap(c=>{
  const target=schema.tables.find(k=>k.id===c.reference?.tableId),column=target?.columns.find(k=>k.id===c.reference?.columnId);return target&&column?[{t,c,target,column}]:[];
 })).sort((a,b)=>(a.t.id+'/'+a.c.id).localeCompare(b.t.id+'/'+b.c.id));
 return relations.map(({t,c,target,column})=>{
  const pair=[t.id,target.id].sort().join('/'),lane=pairs.get(pair)??0;pairs.set(pair,lane+1);
  const route=routeTableConnection(rects[t.id],rects[target.id],Object.values(rects),t.id===target.id,{sourceY:t.position.y+40+(t.columns.indexOf(c)+.5)*32,targetY:target.position.y+40+(target.columns.indexOf(column)+.5)*32,lane,used});
  used.push(route.points);const cardinality=relationCardinality(t,c);
  return {id:`${t.id}-${c.id}`,sourceTableId:t.id,targetTableId:target.id,sourceColumnId:c.id,targetColumnId:column.id,reference:{tableId:t.id,columnId:c.id},...route,d:route.points.map((p,i)=>`${i?'L':'M'}${p.x} ${p.y}`).join(' '),label:`${t.name}.${c.name} → ${target.name}.${column.name}`,...cardinality,notation:cardinality.notation==='CHEN'?'CHEN' as const:'IE' as const};
 });
}
/** IE glyph in local coordinates; the entire glyph rotates with its port. */
export function crowFootPaths(x:number,y:number,direction:number,many:boolean,required:boolean){
 const max=x+direction*10,min=x+direction*23;
 return {maximum:many?`M${x} ${y-7} L${max} ${y} L${x} ${y+7}`:`M${max} ${y-7} V${y+7}`,minimum:required?`M${min} ${y-7} V${y+7}`:null,circle:required?null:{cx:min,cy:y,r:4}};
}
