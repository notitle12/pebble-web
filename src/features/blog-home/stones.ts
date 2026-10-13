import {validId} from "../../lib/list-query.ts";
import {GuestApiError} from "../../lib/public-api.ts";
export type Stone={id:string;postIds:string[];x:number;y:number;rotation:number};
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
  return {id:raw.id,postIds,x:raw.x as number,y:raw.y as number,rotation:raw.rotation as number};
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
 return stonePaintOrder(stones).reverse().find(stone=>{if(stone.id===sourceId)return false;const size=stoneSize(stone.postIds.length),angle=stone.rotation*Math.PI/180,dx=x-stone.x,dy=y-stone.y;return Math.abs(dx*Math.cos(angle)+dy*Math.sin(angle))<=size.width*.36&&Math.abs(-dx*Math.sin(angle)+dy*Math.cos(angle))<=size.height*.4;});
}

export function snapStone(stone:Stone,others:Stone[]):Stone{
 if(Math.abs(stone.rotation)>30)return moveStone(stone,stone.x,stone.y);
 const size=stoneSize(stone.postIds.length);
 const target=others.filter(item=>item.id!==stone.id&&Math.abs(item.rotation)<=30).map(item=>{const otherSize=stoneSize(item.postIds.length);return {item,otherSize,top:item.y-otherSize.height*.46,distance:Math.abs(stone.y+size.height*.46-(item.y-otherSize.height*.46))};}).filter(candidate=>candidate.item.y>stone.y&&candidate.distance<22&&Math.abs(stone.x-candidate.item.x)<(size.width+candidate.otherSize.width)*.36).sort((a,b)=>a.distance-b.distance)[0];
 if(target){const x=Math.abs(stone.x-target.item.x)<18?target.item.x:stone.x;return moveStone(stone,x,target.top-size.height*.46+3);}
 const floor=342-size.height*.46;
 return moveStone(stone,stone.x,Math.abs(stone.y-floor)<22?floor:stone.y);
}
