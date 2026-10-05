import {MemberApiError} from "../../../lib/member-api.ts";
import {guestJson} from "../../../lib/public-api.ts";
import {validTagId,parsePage} from "../../../lib/list-query.ts";
import {parsePostPage} from "../../post/api/post-list.ts";
export type Board={id:string;name:string;displayOrder:number;parentId?:string|null;children:Board[]};
export function boardId(id:string){if(typeof id!=="string"||!validTagId(id))throw new MemberApiError(400,"INVALID_REQUEST","폴더 주소를 확인해 주세요.");return id;}
const record=(value:unknown):value is Record<string,unknown>=>typeof value==="object"&&value!==null&&!Array.isArray(value);
function invalid(){return new MemberApiError(0,"INVALID_RESPONSE","폴더 응답을 확인하지 못했습니다.");}
export function parseBoards(value:unknown,own=false):Board[]{
 if(!record(value)||!Array.isArray(value.data))throw invalid();
 const seen=new Set<string>();
 function parse(items:unknown[],depth:number,parentId:string|null):Board[]{
  if(depth>3&&items.length)throw invalid();
  return items.map(item=>{
   if(!record(item)||typeof item.id!=="string"||!validTagId(item.id)||seen.has(item.id)||typeof item.name!=="string"||!item.name.trim()||typeof item.displayOrder!=="number"||!Number.isInteger(item.displayOrder)||item.displayOrder<0||item.displayOrder>2147483647||!Array.isArray(item.children)||(own&&item.parentId!==parentId))throw invalid();
   seen.add(item.id);
   return {id:item.id,name:item.name,displayOrder:item.displayOrder,...(own?{parentId}:{}),children:parse(item.children,depth+1,item.id)};
  }).sort((a,b)=>a.displayOrder-b.displayOrder||(BigInt(a.id)<BigInt(b.id)?-1:1));
 }
 return parse(value.data,1,null);
}
export function flattenBoards(items:Board[],depth=0):Array<Board&{depth:number}>{return items.flatMap(item=>[{...item,depth},...flattenBoards(item.children,depth+1)]);}
export function boardInput(name:string,parentId:string|null,displayOrder:number){
 if(!name.trim()||Array.from(name).length>50||/[\u0000]/u.test(name)||/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(name))throw new Error("폴더 이름은 올바른 문자로 1~50자여야 합니다.");
 if(parentId!==null)boardId(parentId);
 if(!Number.isInteger(displayOrder)||displayOrder<0||displayOrder>2147483647)throw new Error("순서는 0~2147483647 정수여야 합니다.");
 return {name,parentId,displayOrder};
}
export async function getPublicBoards(memberId:string,base=process.env.NEXT_PUBLIC_API_BASE_URL,request:typeof fetch=fetch){return parseBoards(await guestJson(`members/${boardId(memberId)}/boards`,new URLSearchParams(),base,request));}
export async function getBoardPosts(memberId:string,id:string,page:number,base=process.env.NEXT_PUBLIC_API_BASE_URL,request:typeof fetch=fetch){
 if(parsePage(String(page))!==page)throw invalid();
 const result=parsePostPage(await guestJson(`members/${boardId(memberId)}/boards/${boardId(id)}/posts`,new URLSearchParams({page:String(page),size:"20"}),base,request),page);
 if(result.content.some(post=>post.author.id!==memberId))throw invalid();
 return result;
}
export function boardFailure(e:unknown){if(e instanceof MemberApiError&&e.status===409)return "하위 폴더가 남아 있어 삭제할 수 없습니다. 먼저 하위 폴더를 이동하거나 삭제해 주세요.";return e instanceof Error?e.message:"폴더를 처리하지 못했습니다.";}

export function parseBoardWrite(value:unknown,expectedId?:string):Board{
 if(!record(value)||!record(value.data))throw invalid();const d=value.data;
 if(d.parentId!==null&&(typeof d.parentId!=="string"||!validTagId(d.parentId))||expectedId!==undefined&&d.id!==expectedId)throw invalid();
 const board=parseBoards({data:[{...d,parentId:null,children:[]}]},true)[0];
 return {...board,parentId:d.parentId as string|null};
}
