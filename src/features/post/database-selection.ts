import type {DbTable} from './database-schema';

/** Clamp the translation once for the whole selection, preserving spacing at canvas edges. */
export function databaseSelectionPositions(targets: {id:string;startX:number;startY:number}[], dx:number, dy:number) {
 if (!targets.length) return {};
 const x = Math.max(-Math.min(...targets.map(t=>t.startX)), Math.min(6000-Math.max(...targets.map(t=>t.startX)), Math.round(dx)));
 const y = Math.max(-Math.min(...targets.map(t=>t.startY)), Math.min(6000-Math.max(...targets.map(t=>t.startY)), Math.round(dy)));
 return Object.fromEntries(targets.map(t=>[t.id,{x:t.startX+x,y:t.startY+y}]));
}

export function databaseMarqueeTables(tables:DbTable[], box:{minX:number;minY:number;maxX:number;maxY:number}, sizes:Record<string,{width:number;height:number}>, defaultWidth:number, editable:boolean) {
 return tables.filter(t=>{
  const size=sizes[t.id]??{width:defaultWidth,height:42+t.columns.length*32+(editable?32:0)};
  return t.position.x+size.width>=box.minX && t.position.x<=box.maxX && t.position.y+size.height>=box.minY && t.position.y<=box.maxY;
 }).map(t=>t.id);
}

export function databaseTableSelection(previous:Set<string>, id:string, additive=false) {
 if (!additive) return previous.size===1 && previous.has(id)?new Set<string>():new Set([id]);
 const next=new Set(previous);
 if(next.has(id)) next.delete(id); else next.add(id);
 return next;
}

/** Use the actual pointer position for both preview frames and the final release. */
export function databaseBendValue(drag:{axis:'x'|'y';startCoord:number;startVal:number;min:number;max:number}, point:{clientX:number;clientY:number}, scale:number) {
 const coordinate=drag.axis==='x'?point.clientX:point.clientY;
 return Math.round(Math.max(drag.min,Math.min(drag.max,drag.startVal+(coordinate-drag.startCoord)/scale)));
}
