import {relationCardinality,type DatabaseSchema} from './database-schema.ts';
export type DbPoint={x:number;y:number};
export type DbRect={x:number;y:number;width:number;height:number};
export type DbSize={width:number;height:number};
type Port=DbPoint&{angle:number;normal:DbPoint};
function ports(r:DbRect):Port[]{return [
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
/** Pick the shortest clear orthogonal route between outward-facing side centers. */
export function routeTableConnection(source:DbRect,target:DbRect,obstacles:DbRect[],self=false){
 const stub=32,sp=ports(source),tp=ports(target);
 if(self){const a={...sp[0],y:source.y+source.height/3},b={...sp[0],y:source.y+source.height*2/3},x=source.x+source.width+48;return {source:a,target:b,points:[a,{x,y:a.y},{x,y:b.y},b]};}
 const left=Math.max(4,Math.min(...obstacles.map(r=>r.x))-40),right=Math.max(...obstacles.map(r=>r.x+r.width))+40,top=Math.max(4,Math.min(...obstacles.map(r=>r.y))-40),bottom=Math.max(...obstacles.map(r=>r.y+r.height))+40;
 let best:{source:Port;target:Port;points:DbPoint[];score:number}|undefined;
 for(const a of sp)for(const b of tp){
  const u={x:a.x+a.normal.x*stub,y:a.y+a.normal.y*stub},v={x:b.x+b.normal.x*stub,y:b.y+b.normal.y*stub};
  const middles:DbPoint[][]=[[{x:v.x,y:u.y}],[{x:u.x,y:v.y}]];
  for(const x of [(u.x+v.x)/2,left,right])middles.push([{x,y:u.y},{x,y:v.y}]);
  for(const y of [(u.y+v.y)/2,top,bottom])middles.push([{x:u.x,y},{x:v.x,y}]);
  for(const middle of middles){
   const points=compact([a,u,...middle,v,b]);if(!points||points.some(p=>p.x<0||p.y<0))continue;
   if(points.slice(1).some((p,i)=>obstacles.some(r=>segmentHitsRect(points[i],p,r))))continue;
   const length=points.slice(1).reduce((n,p,i)=>n+Math.abs(p.x-points[i].x)+Math.abs(p.y-points[i].y),0),score=length+(points.length-2)*12;
   if(!best||score<best.score)best={source:a,target:b,points,score};
  }
 }
 if(best)return best;
 // Overlapping cards can cover every port. Keep the fallback outside their right edges.
 const a=sp[0],b=tp[0],x=Math.max(source.x+source.width,target.x+target.width)+48;
 return {source:a,target:b,points:[a,{x,y:a.y},{x,y:b.y},b]};
}
export function databaseLinks(schema:DatabaseSchema,editable=false,sizes:Record<string,DbSize>={}){
 const scale=editable?2.5:1;
 const rects=Object.fromEntries(schema.tables.map(t=>[t.id,{x:t.position.x*scale,y:t.position.y*scale,width:sizes[t.id]?.width??(editable?660:280),height:sizes[t.id]?.height??(editable?124+t.columns.length*40+t.columns.filter(c=>c.reference).length*34:42+t.columns.length*32)}]));
 return schema.tables.flatMap(t=>t.columns.flatMap(c=>{
  const target=schema.tables.find(k=>k.id===c.reference?.tableId),column=target?.columns.find(k=>k.id===c.reference?.columnId);if(!target||!column)return [];
  const route=routeTableConnection(rects[t.id],rects[target.id],Object.values(rects),t.id===target.id),cardinality=relationCardinality(t,c);
  return [{id:`${t.id}-${c.id}`,reference:{tableId:t.id,columnId:c.id},...route,d:route.points.map((p,i)=>`${i?'L':'M'}${p.x} ${p.y}`).join(' '),label:`${t.name}.${c.name} → ${target.name}.${column.name}`,...cardinality,notation:cardinality.notation==='CHEN'?'CHEN' as const:'IE' as const}];
 }));
}
/** IE glyph in local coordinates; the entire glyph rotates with its port. */
export function crowFootPaths(x:number,y:number,direction:number,many:boolean,required:boolean){
 const max=x+direction*10,min=x+direction*23;
 return {maximum:many?`M${x} ${y-7} L${max} ${y} L${x} ${y+7}`:`M${max} ${y-7} V${y+7}`,minimum:required?`M${min} ${y-7} V${y+7}`:null,circle:required?null:{cx:min,cy:y,r:4}};
}
