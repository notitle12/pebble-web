import {GuestApiError,guestJson} from "../../../lib/public-api.ts";
import {MemberApiError} from "../../../lib/member-api.ts";
import {parsePage,validId} from "../../../lib/list-query.ts";
import {PAGE_SIZE,parsePublicPostPage,type PostPage} from "./post-list.ts";
import {parseOwnPosts,type OwnPostPage} from "./member-posts.ts";

export type PostSeries={id:string;name:string;description:string;postCount:number;createdAt:string;updatedAt:string};
const record=(value:unknown):value is Record<string,unknown>=>typeof value==="object"&&value!==null&&!Array.isArray(value);
const time=(value:unknown):value is string=>typeof value==="string"&&Number.isFinite(Date.parse(value));
const textLength=(value:string)=>Array.from(value).length;
const safeText=(value:string)=>!/[\u0000]/u.test(value)&&!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value);
const validName=(value:unknown):value is string=>typeof value==="string"&&safeText(value)&&!/[\u0000-\u001F\u007F-\u009F]/u.test(value)&&textLength(value)>=1&&textLength(value)<=100&&!!value.trim();
const validDescription=(value:unknown):value is string=>typeof value==="string"&&safeText(value)&&textLength(value)<=1000;

export function parsePostSeries(value:unknown):PostSeries{
 const data=record(value)&&"data" in value?value.data:value;
 if(!record(data)||typeof data.id!=="string"||!validId(data.id)||!validName(data.name)||!validDescription(data.description)
  ||typeof data.postCount!=="number"||!Number.isSafeInteger(data.postCount)||data.postCount<0||!time(data.createdAt)||!time(data.updatedAt))throw new GuestApiError("response");
 return {id:data.id,name:data.name,description:data.description,postCount:data.postCount,createdAt:data.createdAt,updatedAt:data.updatedAt};
}
export function parsePostSeriesList(value:unknown):PostSeries[]{
 if(!record(value)||!Array.isArray(value.data))throw new GuestApiError("response");
 const rows=value.data.map(parsePostSeries);
 if(new Set(rows.map(row=>row.id)).size!==rows.length)throw new GuestApiError("response");
 return rows;
}
function validHandle(value:string){return /^[a-z][a-z0-9_-]{1,28}[a-z0-9_]$/.test(value);}
export function publicPostSeriesHref(handle:string,id?:string,page=0):string{
 if(id===undefined&&page!==0)throw new GuestApiError("response");
 checkPublicArgs(handle,id,page);
 const params=new URLSearchParams({view:"series"});if(id)params.set("seriesId",id);if(page>0)params.set("page",String(page));
 return `/blogs/${encodeURIComponent(handle)}?${params}`;
}
function checkPublicArgs(handle:string,id?:string,page?:number){
 if(!validHandle(handle)||id!==undefined&&!validId(id)||page!==undefined&&(!Number.isSafeInteger(page)||page<0||parsePage(String(page))!==page))throw new GuestApiError("response");
}
export async function getPublicPostSeries(handle:string,baseUrl=process.env.NEXT_PUBLIC_API_BASE_URL,request:typeof fetch=fetch):Promise<PostSeries[]>{
 checkPublicArgs(handle);
 return parsePostSeriesList(await guestJson(`blogs/${encodeURIComponent(handle)}/series`,new URLSearchParams(),baseUrl,request));
}
export async function getPublicPostSeriesDetail(handle:string,id:string,baseUrl=process.env.NEXT_PUBLIC_API_BASE_URL,request:typeof fetch=fetch):Promise<PostSeries>{
 checkPublicArgs(handle,id);
 const series=parsePostSeries(await guestJson(`blogs/${encodeURIComponent(handle)}/series/${encodeURIComponent(id)}`,new URLSearchParams(),baseUrl,request));
 if(series.id!==id)throw new GuestApiError("response");
 return series;
}
export async function getPublicPostSeriesPosts(handle:string,id:string,page:number,baseUrl=process.env.NEXT_PUBLIC_API_BASE_URL,request:typeof fetch=fetch):Promise<PostPage>{
 checkPublicArgs(handle,id,page);
 const posts=parsePublicPostPage(await guestJson(`blogs/${encodeURIComponent(handle)}/series/${encodeURIComponent(id)}/posts`,new URLSearchParams({page:String(page),size:String(PAGE_SIZE)}),baseUrl,request),page);
 if(posts.content.some(post=>post.author.handle!==handle||post.visibilityStatus==="HIDDEN"||post.seriesId!==id))throw new GuestApiError("response");
 return posts;
}

export function parseMemberPostSeries(value:unknown):PostSeries{
 try{return parsePostSeries(value);}catch{throw new MemberApiError(0,"INVALID_RESPONSE","시리즈 응답을 확인하지 못했습니다.");}
}
export function parseMemberPostSeriesList(value:unknown):PostSeries[]{
 try{return parsePostSeriesList(value);}catch{throw new MemberApiError(0,"INVALID_RESPONSE","시리즈 목록을 확인하지 못했습니다.");}
}
export async function getMemberPostSeriesPosts(request:(path:string)=>Promise<unknown>,id:string,page:number,memberId?:string):Promise<OwnPostPage>{
 if(!validId(id)||!Number.isSafeInteger(page)||page<0||parsePage(String(page))!==page)throw new MemberApiError(400,"INVALID_REQUEST","시리즈 글 목록 주소를 확인해 주세요.");
 const parsed=parseOwnPosts(await request(`/series/${encodeURIComponent(id)}/posts?page=${page}&size=${PAGE_SIZE}`),page,memberId,undefined,PAGE_SIZE);
 if(parsed.content.some(post=>post.seriesId!==id||typeof post.seriesDisplayOrder!=="number"))throw new MemberApiError(0,"INVALID_RESPONSE","시리즈 글 목록을 확인하지 못했습니다.");
 return parsed;
}

export const postSeriesNameError="시리즈 이름은 1~100자, 설명은 1,000자 이하여야 합니다.";
export function validatePostSeriesInput(name:string,description:string):string|null{
 return validName(name)&&validDescription(description)?null:postSeriesNameError;
}

/** Owner-only snapshot for filtering/search across all pages in the add-post dialog. */
export async function getSeriesCandidatePosts(request:(path:string)=>Promise<unknown>,memberId:string){
 const read=async(page:number)=>parseOwnPosts(await request(`/members/me/posts?page=${page}&size=100`),page,memberId,undefined,100);
 const first=await read(0);
 if(first.totalElements>10000)throw new MemberApiError(0,"INVALID_RESPONSE","글이 너무 많아 목록을 불러올 수 없습니다.");
 const rows=[...first.content];
 for(let page=1;page<first.totalPages;page++){
  const next=await read(page);
  if(next.totalElements!==first.totalElements||next.totalPages!==first.totalPages||rows.length!==page*100)throw new MemberApiError(0,"INVALID_RESPONSE","글 목록이 바뀌었습니다. 다시 불러와 주세요.");
  rows.push(...next.content);
 }
 if(rows.length!==first.totalElements||new Set(rows.map(row=>row.id)).size!==rows.length)throw new MemberApiError(0,"INVALID_RESPONSE","글 목록이 바뀌었습니다. 다시 불러와 주세요.");
 return rows;
}
