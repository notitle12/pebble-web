import { validTagId } from "../../../lib/list-query.ts";
import {MemberApiError,responseData} from "../../../lib/member-api.ts";
import {parsePostDetail,parsePostPage,type PostDetail,type PostPage} from "./post-list.ts";
export type Classification={id:string;name:string;status:"ACTIVE"|"INACTIVE"};
export type OwnPost=PostDetail & {boardId:string|null;projectId:string|null;category:Classification|null;tags:Classification[];visibilityStatus:"PUBLIC"|"HIDDEN";isBlocked:boolean;draft:boolean};
export type OwnPostPage=Omit<PostPage,"content"> & {content:(PostPage["content"][number]&{visibilityStatus:"PUBLIC"|"HIDDEN";isBlocked:boolean;displayOrder:number})[]};
export function parseOwnPost(value:unknown):OwnPost{
  const post=parsePostDetail(value),d=responseData(value);
  if(!["PUBLIC","HIDDEN"].includes(String(d.visibilityStatus))||typeof d.isBlocked!=="boolean"||(d.draft!==undefined&&typeof d.draft!=="boolean"))throw new MemberApiError(0,"INVALID_RESPONSE","본인 글 응답을 확인하지 못했습니다.");
  if(d.projectId!==null && (typeof d.projectId!=="string" || !validTagId(d.projectId)))throw new MemberApiError(0,"INVALID_RESPONSE","글의 프로젝트 연결을 확인하지 못했습니다.");
  if(d.boardId!==null && (typeof d.boardId!=="string" || !validTagId(d.boardId)))throw new MemberApiError(0,"INVALID_RESPONSE","글 폴더 연결을 확인하지 못했습니다.");
  const validClassification=(value:unknown):value is Classification => typeof value==="object" && value!==null && "id" in value && typeof value.id==="string" && validTagId(value.id) && "name" in value && typeof value.name==="string" && "status" in value && ["ACTIVE","INACTIVE"].includes(String(value.status));
  if((d.category!==null && !validClassification(d.category)) || !Array.isArray(d.tags) || !d.tags.every(validClassification) || new Set(d.tags.map(tag=>tag.id)).size!==d.tags.length)throw new MemberApiError(0,"INVALID_RESPONSE","글의 분류 정보를 확인하지 못했습니다.");
  return {...post,boardId:d.boardId as string|null,projectId:d.projectId as string|null,category:d.category as Classification|null,tags:d.tags as Classification[],visibilityStatus:d.visibilityStatus as OwnPost["visibilityStatus"],isBlocked:d.isBlocked,draft:d.draft===true};
}
export function parseOwnPosts(value:unknown,page:number,memberId?:string):OwnPostPage{
  const parsed=parsePostPage(value,page);
  for(const post of parsed.content){const d=post as unknown as Record<string,unknown>;if(!["PUBLIC","HIDDEN"].includes(String(d.visibilityStatus))||typeof d.isBlocked!=="boolean"||typeof d.displayOrder!=="number"||!Number.isInteger(d.displayOrder)||d.displayOrder<0||d.displayOrder>2147483647||memberId!==undefined&&post.author.id!==memberId)throw new MemberApiError(0,"INVALID_RESPONSE","내 글 목록을 확인하지 못했습니다.");}
  return parsed as OwnPostPage;
}
export function postId(value:string):string {if(!/^[1-9]\d{0,18}$/.test(value)||BigInt(value)>9223372036854775807n)throw new MemberApiError(400,"INVALID_REQUEST","글 주소를 확인해 주세요.");return value;}
