import {relationCardinality,type DatabaseSchema} from './database-schema.ts';
/** Geometry stays in the same coordinate system as the cards, including editor zoom. */
export function databaseLinks(schema:DatabaseSchema,editable=false){
 const scale=editable?2.5:1,cardWidth=editable?660:280,rowHeight=editable?40:32,rowTop=editable?96:56;
 return schema.tables.flatMap(t=>t.columns.flatMap((c,i)=>{
  const target=schema.tables.find(k=>k.id===c.reference?.tableId),index=target?.columns.findIndex(k=>k.id===c.reference?.columnId)??-1;
  if(!target||index<0)return [];
  const right=target.position.x>=t.position.x,self=t.id===target.id;
  const dir1=self||right?1:-1,dir2=self||!right?1:-1;
  const x1=t.position.x*scale+(dir1===1?cardWidth:0),x2=target.position.x*scale+(dir2===1?cardWidth:0),y1=t.position.y*scale+rowTop+i*rowHeight,y2=target.position.y*scale+rowTop+index*rowHeight;
  const bend=self?x1+60:(x1+x2)/2,mid=(y1+y2)/2;
  const first=`M${x1} ${y1} H${bend} V${mid}`,second=`M${bend} ${mid} V${y2} H${x2}`;
  return [{id:`${t.id}-${c.id}`,reference:{tableId:t.id,columnId:c.id},first,second,d:first+second.replace('M',' M'),x1,x2,y1,y2,dir1,dir2,label:`${t.name}.${c.name} → ${target.name}.${target.columns[index].name}`,...relationCardinality(t,c)}];
 }));
}
/** IE minimum/maximum end markers, drawn outside the table edge. */
export function crowFootPaths(x:number,y:number,direction:number,many:boolean,required:boolean){
 const max=x+direction*10,min=x+direction*23;
 return {maximum:many?`M${x} ${y-7} L${max} ${y} L${x} ${y+7}`:`M${max} ${y-7} V${y+7}`,minimum:required?`M${min} ${y-7} V${y+7}`:null,circle:required?null:{cx:min,cy:y,r:4}};
}
