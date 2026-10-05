import {guestJson,GuestApiError} from "../../../lib/public-api.ts";
import {validTagId} from "../../../lib/list-query.ts";
export type PublicCategory={id:string;parentId:string|null;name:string;status:"ACTIVE"|"INACTIVE";children:PublicCategory[]};
const record=(value:unknown):value is Record<string,unknown>=>typeof value==="object" && value!==null && !Array.isArray(value);
export function parseCategories(value:unknown):PublicCategory[] {
  if(!record(value) || !Array.isArray(value.data))throw new GuestApiError("response");
  const seen=new Set<string>();
  function node(value:unknown,parentId:string|null,depth:number):PublicCategory {
    if(!record(value) || typeof value.id!=="string" || !validTagId(value.id) || seen.has(value.id) || value.parentId!==parentId
      || typeof value.name!=="string" || !["ACTIVE","INACTIVE"].includes(String(value.status)) || !Array.isArray(value.children)
      || (depth===2 && value.children.length>0))throw new GuestApiError("response");
    seen.add(value.id);
    return {id:value.id,parentId,name:value.name,status:value.status as PublicCategory["status"],children:value.children.map(child=>node(child,value.id as string,depth+1))};
  }
  return value.data.map(item=>node(item,null,1));
}
export async function getPublicCategories(baseUrl=process.env.NEXT_PUBLIC_API_BASE_URL,request:typeof fetch=fetch):Promise<PublicCategory[]> {
  return parseCategories(await guestJson("categories",new URLSearchParams(),baseUrl,request));
}
export function categoryOptions(categories:PublicCategory[]):{id:string;name:string}[] {
  return categories.flatMap(category=>[{id:category.id,name:`${category.name}${category.status==="INACTIVE"?" (기존 분류)":""}`},...category.children.map(child=>({id:child.id,name:`${category.name} / ${child.name}${child.status==="INACTIVE"?" (기존 분류)":""}`}))]);
}
