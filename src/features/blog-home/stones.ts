import {validId} from "../../lib/list-query.ts";
import {GuestApiError} from "../../lib/public-api.ts";
export type Stone={id:string;postIds:string[];x:number;y:number;rotation:number;shape?:number};
export type StonePost={id:string;title:string;urlKey:string;publishedAt:string};
export type StoneView={version:number;stones:Stone[];posts:StonePost[]};
const object=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==="object"&&!Array.isArray(value);
export function parseStonePost(value:unknown):StonePost{
 if(!object(value)||typeof value.id!=="string"||!validId(value.id)||typeof value.title!=="string"||value.title.length>200||typeof value.urlKey!=="string"||!value.urlKey||value.urlKey.length>200||typeof value.publishedAt!=="string"||!Number.isFinite(Date.parse(value.publishedAt)))throw new GuestApiError("response");
 return {id:value.id,title:value.title,urlKey:value.urlKey,publishedAt:value.publishedAt};
}
export function parseStoneView(value:unknown):StoneView{
 const data=object(value)&&"data" in value?value.data:value;
 if(!object(data)||!Number.isSafeInteger(data.version)||(data.version as number)<0||!Array.isArray(data.stones)||data.stones.length>200||!Array.isArray(data.posts)||data.posts.length>2000)throw new GuestApiError("response");
 const posts=data.posts.map(parseStonePost),allowed=new Set(posts.map(p=>p.id)),seen=new Set<string>(),ids=new Set<string>();
 if(allowed.size!==posts.length)throw new GuestApiError("response");
 const stones=data.stones.map(raw=>{
  if(!object(raw)||typeof raw.id!=="string"||!/^[a-zA-Z0-9_-]{1,64}$/.test(raw.id)||ids.has(raw.id)||!Array.isArray(raw.postIds)||!raw.postIds.length||raw.postIds.length>100)throw new GuestApiError("response");
  ids.add(raw.id);
  const postIds=raw.postIds.map(id=>{if(typeof id!=="string"||!allowed.has(id)||seen.has(id))throw new GuestApiError("response");seen.add(id);return id;});
  for(const [key,min,max] of [["x",0,1000],["y",0,360],["rotation",-180,180]] as const){if(typeof raw[key]!=="number"||!Number.isFinite(raw[key])||raw[key]<min||raw[key]>max)throw new GuestApiError("response");}
  if(raw.shape!==undefined&&(!Number.isInteger(raw.shape)||(raw.shape as number)<0||(raw.shape as number)>5))throw new GuestApiError("response");
  return {...(raw.shape===undefined?{}:{shape:raw.shape as number}),id:raw.id,postIds,x:raw.x as number,y:raw.y as number,rotation:raw.rotation as number};
 });
 return {version:data.version as number,stones,posts};
}
export function stoneSize(count:number){return {width:90*Math.pow(Math.min(100,Math.max(1,count)),.45),height:40*Math.pow(Math.min(100,Math.max(1,count)),.22)};}
export function moveStone(stone:Stone,x:number,y:number):Stone{
 const {width,height}=stoneSize(stone.postIds.length);
 return {...stone,x:Math.max(width/2,Math.min(1000-width/2,x)),y:Math.max(height*.46,Math.min(342-height*.46,y))};
}
export function mergeStones(stones:Stone[],selected:string[]):Stone[]{
 const chosen=stones.filter(stone=>selected.includes(stone.id));
 if(chosen.length<2)return stones;
 const postIds=chosen.flatMap(stone=>stone.postIds);
 if(postIds.length>100||new Set(postIds).size!==postIds.length)throw new Error("한 돌에는 최대 100개의 기록을 합칠 수 있어요.");
 const base=chosen[0];
 return [...stones.filter(stone=>!selected.includes(stone.id)),moveStone({...base,postIds},base.x,base.y)];
}
export function splitStone(stones:Stone[],id:string):Stone[]{
 const stone=stones.find(item=>item.id===id);if(!stone||stone.postIds.length<2)return stones;
 if(stones.length+stone.postIds.length-1>200)throw new Error("한 화면에는 돌을 최대 200개 배치할 수 있어요. 일부를 돌 보관함으로 돌려놓아 주세요.");
 return [...stones.filter(item=>item.id!==id),...stone.postIds.map((postId,index)=>moveStone({id:crypto.randomUUID(),postIds:[postId],x:stone.x,y:stone.y,rotation:0},stone.x+(index%6-2.5)*76,stone.y-Math.floor(index/6)*32))];
}
export function unusedPosts(posts:StonePost[],stones:Stone[]){const used=new Set(stones.flatMap(stone=>stone.postIds));return posts.filter(post=>!used.has(post.id));}

// SVG paints later elements in front: a smaller canvas Y means a higher stone.
export function stonePaintOrder(stones:Stone[]):Stone[]{return [...stones].sort((a,b)=>b.y-a.y||a.id.localeCompare(b.id));}

export function stoneMergeTarget(stones:Stone[],sourceId:string,x:number,y:number):Stone|undefined{
 return stonePaintOrder(stones).reverse().find(stone=>{if(stone.id===sourceId)return false;const size=stoneSize(stone.postIds.length),angle=stone.rotation*Math.PI/180,dx=x-stone.x,dy=y-stone.y;return Math.abs(dx*Math.cos(angle)+dy*Math.sin(angle))<=Math.min(18,size.width*.12)&&Math.abs(-dx*Math.sin(angle)+dy*Math.cos(angle))<=Math.min(8,size.height*.14);});
}

export function stoneRotation(start:number,delta:number,snap=false){const angle=start+delta;const value=snap?Math.round(angle/15)*15:Math.round(angle);return ((value+180)%360+360)%360-180;}
export function nudgeStone(stone:Stone,key:string,large=false):Stone{const step=large?10:1;const direction:Record<string,[number,number]>={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]};const change=direction[key];return change?moveStone(stone,stone.x+change[0],stone.y+change[1]):stone;}

function stoneExtents(stone:Stone){const size=stoneSize(stone.postIds.length),angle=stone.rotation*Math.PI/180;return {x:(Math.abs(Math.cos(angle))*size.width+Math.abs(Math.sin(angle))*size.height)/2,y:(Math.abs(Math.sin(angle))*size.width+Math.abs(Math.cos(angle))*size.height)/2};}
export function moveStoneGroup(stones:Stone[],ids:string[],dx:number,dy:number):Stone[]{
 const chosen=stones.filter(stone=>ids.includes(stone.id));if(!chosen.length)return stones;
 // 경계에서도 모든 돌에 같은 이동량을 적용해 묶음 안의 간격을 유지한다.
 const minX=Math.min(...chosen.map(s=>s.x-stoneExtents(s).x)),maxX=Math.max(...chosen.map(s=>s.x+stoneExtents(s).x));
 const minY=Math.min(...chosen.map(s=>s.y-stoneExtents(s).y)),maxY=Math.max(...chosen.map(s=>s.y+stoneExtents(s).y));
 const x=Math.max(-minX,Math.min(1000-maxX,dx)),y=Math.max(-minY,Math.min(344-maxY,dy));
 return stones.map(stone=>ids.includes(stone.id)?{...stone,x:stone.x+x,y:stone.y+y}:stone);
}
export function stonesInBox(stones:Stone[],start:{x:number;y:number},end:{x:number;y:number}):string[]{
 const left=Math.min(start.x,end.x),right=Math.max(start.x,end.x),top=Math.min(start.y,end.y),bottom=Math.max(start.y,end.y);
 return stones.filter(stone=>{const e=stoneExtents(stone);return stone.x+e.x>=left&&stone.x-e.x<=right&&stone.y+e.y>=top&&stone.y-e.y<=bottom;}).map(s=>s.id);
}

export function stoneGroupBounds(stones:Stone[],ids:string[]){const chosen=stones.filter(s=>ids.includes(s.id));if(!chosen.length)return null;const left=Math.min(...chosen.map(s=>s.x-stoneExtents(s).x)),right=Math.max(...chosen.map(s=>s.x+stoneExtents(s).x)),top=Math.min(...chosen.map(s=>s.y-stoneExtents(s).y)),bottom=Math.max(...chosen.map(s=>s.y+stoneExtents(s).y));return {x:(left+right)/2,y:(top+bottom)/2,width:right-left,height:bottom-top};}
export function rotateStoneGroup(stones:Stone[],ids:string[],degrees:number,center?:{x:number;y:number}):Stone[]{const bounds=center??stoneGroupBounds(stones,ids);if(!bounds)return stones;const angle=degrees*Math.PI/180;return stones.map(stone=>{if(!ids.includes(stone.id))return stone;const x=stone.x-bounds.x,y=stone.y-bounds.y;return {...stone,x:bounds.x+x*Math.cos(angle)-y*Math.sin(angle),y:bounds.y+x*Math.sin(angle)+y*Math.cos(angle),rotation:stoneRotation(stone.rotation,degrees)};});}
