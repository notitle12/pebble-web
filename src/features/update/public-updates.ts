import {guestJson, GuestApiError} from "../../lib/public-api.ts";
import {parsePage, validId} from "../../lib/list-query.ts";

export const UPDATE_TYPES = ["FEATURE", "PERFORMANCE", "FIX"] as const;
export type UpdateType = typeof UPDATE_TYPES[number];
export const UPDATE_LABELS: Record<UpdateType, string> = {FEATURE:"기능 업데이트", PERFORMANCE:"성능 개선", FIX:"버그 수정"};
export type UpdateQuery = {page:number;type?:UpdateType};
export type UpdateSummary = {id:string;title:string;summary:string;type:UpdateType;version:string|null;publishedAt:string;updatedAt:string};
export type UpdateDetail = UpdateSummary & {body:string};
export type UpdatePage = {items:UpdateSummary[];page:number;size:number;totalElements:number;totalPages:number};
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const count=(v:unknown):v is number=>typeof v==="number"&&Number.isSafeInteger(v)&&v>=0;
const text=(v:unknown,max:number):v is string=>typeof v==="string"&&Array.from(v).length<=max;
const timestamp=(v:unknown):v is string=>typeof v==="string"&&/^\d{4}-\d{2}-\d{2}T/.test(v)&&Number.isFinite(Date.parse(v));
const type=(v:unknown):v is UpdateType=>UPDATE_TYPES.includes(v as UpdateType);
function summary(v:unknown):UpdateSummary {
  if(!record(v)||typeof v.id!=="string"||!validId(v.id)||!text(v.title,160)||!v.title.trim()||!text(v.summary,300)||!type(v.type)||(v.version!==null&&!text(v.version,40))||!timestamp(v.publishedAt)||!timestamp(v.updatedAt))throw new GuestApiError("response");
  return {id:v.id,title:v.title,summary:v.summary,type:v.type,version:v.version,publishedAt:v.publishedAt,updatedAt:v.updatedAt};
}
export function parseUpdateQuery(params:Record<string,string|string[]|undefined>):UpdateQuery|null {
  if(Object.keys(params).some(key=>!["page","type"].includes(key)))return null;
  const page=parsePage(params.page);
  if(page===null||page>100000||(params.type!==undefined&&!type(params.type)))return null;
  return {page,...(params.type?{type:params.type as UpdateType}:{})};
}
export function updatesHref(query:UpdateQuery={page:0}):string {
  const params=new URLSearchParams();
  if(query.type)params.set("type",query.type);
  if(query.page>0)params.set("page",String(query.page));
  return `/updates${params.size?`?${params}`:""}`;
}
export function parseUpdatePage(value:unknown,page:number):UpdatePage {
  if(!record(value)||!record(value.data))throw new GuestApiError("response");
  const d=value.data;
  if(!Array.isArray(d.items)||d.items.length>10||d.page!==page||d.size!==10||!count(d.totalElements)||!count(d.totalPages)||d.totalPages!==Math.ceil(d.totalElements/10)||d.items.length>Math.max(0,Math.min(10,d.totalElements-page*10)))throw new GuestApiError("response");
  const items=d.items.map(summary);
  if(new Set(items.map(item=>item.id)).size!==items.length)throw new GuestApiError("response");
  return {items,page,size:10,totalElements:d.totalElements,totalPages:d.totalPages};
}
export function parseUpdateDetail(value:unknown):UpdateDetail {
  if(!record(value)||!record(value.data)||!text(value.data.body,20000)||!value.data.body.trim())throw new GuestApiError("response");
  return {...summary(value.data),body:value.data.body};
}
export async function getPublicUpdates(query:UpdateQuery,baseUrl=process.env.NEXT_PUBLIC_API_BASE_URL,request:typeof fetch=fetch):Promise<UpdatePage> {
  if(!parseUpdateQuery({...query,page:String(query.page)}))throw new GuestApiError("response");
  const params=new URLSearchParams({page:String(query.page),size:"10"});
  if(query.type)params.set("type",query.type);
  const result=parseUpdatePage(await guestJson("updates",params,baseUrl,request),query.page);
  if(query.type&&result.items.some(item=>item.type!==query.type))throw new GuestApiError("response");
  return result;
}
export async function getPublicUpdate(id:string,baseUrl=process.env.NEXT_PUBLIC_API_BASE_URL,request:typeof fetch=fetch):Promise<UpdateDetail> {
  if(!validId(id))throw new GuestApiError("not-found");
  const result=parseUpdateDetail(await guestJson(`updates/${id}`,new URLSearchParams(),baseUrl,request));
  if(result.id!==id)throw new GuestApiError("response");
  return result;
}
export function updateDate(value:string):string {
  return new Intl.DateTimeFormat("ko-KR",{year:"numeric",month:"long",day:"numeric",timeZone:"Asia/Seoul"}).format(new Date(value));
}
