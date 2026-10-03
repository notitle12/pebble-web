import {MemberApiError,responseData} from "../../../lib/member-api.ts";
import {parsePostDetail,parsePostPage,type PostDetail,type PostPage} from "./post-list.ts";
export type OwnPost=PostDetail & {visibilityStatus:"PUBLIC"|"HIDDEN";isBlocked:boolean};
export type OwnPostPage=Omit<PostPage,"content"> & {content:(PostPage["content"][number]&{visibilityStatus:"PUBLIC"|"HIDDEN";isBlocked:boolean})[]};
export function parseOwnPost(value:unknown):OwnPost{
  const post=parsePostDetail(value),d=responseData(value);
  if(!["PUBLIC","HIDDEN"].includes(String(d.visibilityStatus))||typeof d.isBlocked!=="boolean")throw new MemberApiError(0,"INVALID_RESPONSE","본인 글 응답을 확인하지 못했습니다.");
  return {...post,visibilityStatus:d.visibilityStatus as OwnPost["visibilityStatus"],isBlocked:d.isBlocked};
}
export function parseOwnPosts(value:unknown,page:number):OwnPostPage{
  const parsed=parsePostPage(value,page);
  for(const post of parsed.content){const d=post as unknown as Record<string,unknown>;if(!["PUBLIC","HIDDEN"].includes(String(d.visibilityStatus))||typeof d.isBlocked!=="boolean")throw new MemberApiError(0,"INVALID_RESPONSE","내 글 목록을 확인하지 못했습니다.");}
  return parsed as OwnPostPage;
}
export function postId(value:string):string {if(!/^[1-9]\d{0,18}$/.test(value)||BigInt(value)>9223372036854775807n)throw new MemberApiError(400,"INVALID_REQUEST","글 주소를 확인해 주세요.");return value;}
