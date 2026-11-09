import {MemberApiError,responseData} from "../../../lib/member-api.ts";

export type FollowState={following:boolean;followerCount:number};
export type FollowIdentity={handle:string;nickname:string;profileImageUrl:string|null};
export type FollowPage={content:FollowIdentity[];page:number;size:number;totalElements:number;totalPages:number;first:boolean;last:boolean};
const invalid=()=>new MemberApiError(0,"INVALID_RESPONSE","구독 정보를 확인하지 못했습니다.");
const record=(value:unknown):value is Record<string,unknown>=>typeof value==="object"&&value!==null&&!Array.isArray(value);
const validHandle=(value:unknown):value is string=>typeof value==="string"&&/^[a-z][a-z0-9_-]{1,28}[a-z0-9_]$/.test(value);
export function parseFollowState(value:unknown):FollowState{
 const data=responseData(value);
 if(typeof data.following!=="boolean"||typeof data.followerCount!=="number"||!Number.isSafeInteger(data.followerCount)||data.followerCount<0)throw invalid();
 return {following:data.following,followerCount:data.followerCount};
}
export function parseFollowPage(value:unknown,expectedPage:number):FollowPage{
 const data=responseData(value);
 if(!Array.isArray(data.content)||data.page!==expectedPage||data.size!==20||typeof data.totalElements!=="number"||!Number.isSafeInteger(data.totalElements)||data.totalElements<0||typeof data.totalPages!=="number"||!Number.isSafeInteger(data.totalPages)||data.totalPages<0||typeof data.first!=="boolean"||typeof data.last!=="boolean")throw invalid();
 const content=data.content.map(row=>{
  if(!record(row)||!validHandle(row.handle)||typeof row.nickname!=="string"||!row.nickname.trim()||!(row.profileImageUrl===null||typeof row.profileImageUrl==="string"))throw invalid();
  return {handle:row.handle,nickname:row.nickname,profileImageUrl:row.profileImageUrl};
 });
 return {content,page:data.page,size:data.size,totalElements:data.totalElements,totalPages:data.totalPages,first:data.first,last:data.last};
}
export function followPath(handle:string){if(!validHandle(handle))throw invalid();return `/members/me/blogs/${encodeURIComponent(handle)}/follow`;}
export function followsPath(direction:"followers"|"following",page:number){if(!["followers","following"].includes(direction)||!Number.isSafeInteger(page)||page<0)throw invalid();return `/members/me/blog-follows?direction=${direction}&page=${page}&size=20`;}
