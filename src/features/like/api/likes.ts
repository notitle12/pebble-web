import {MemberApiError,responseData} from "../../../lib/member-api.ts";
import {guestJson} from "../../../lib/public-api.ts";
import {validTagId} from "../../../lib/list-query.ts";
export type LikeTarget="posts"|"projects";
export type LikeState={likeCount:number;likedByMe:boolean};
export type LikeRequest=(path:string,options?:{method?:string})=>Promise<unknown>;
export function likePath(target:LikeTarget,id:string,write=false){
  if(!["posts","projects"].includes(target)||typeof id!=="string"||!validTagId(id))throw new MemberApiError(400,"INVALID_REQUEST","좋아요 대상 주소를 확인해 주세요.");
  return `/${target}/${id}${write?"/like":""}`;
}
export function parseLikeState(value:unknown,expectedId:string,guest=false):LikeState{
  const d=responseData(value);
  if(d.id!==expectedId||typeof d.likeCount!=="number"||!Number.isSafeInteger(d.likeCount)||d.likeCount<0||typeof d.likedByMe!=="boolean"||(guest&&d.likedByMe))throw new MemberApiError(0,"INVALID_RESPONSE","좋아요 상태를 확인하지 못했습니다.");
  return {likeCount:d.likeCount,likedByMe:d.likedByMe};
}
export async function readLikes(target:LikeTarget,id:string,request?:LikeRequest,baseUrl=process.env.NEXT_PUBLIC_API_BASE_URL,fetcher:typeof fetch=fetch){
  const path=likePath(target,id);
  return parseLikeState(request?await request(path):await guestJson(path.slice(1),new URLSearchParams(),baseUrl,fetcher),id,!request);
}
export async function writeLike(target:LikeTarget,id:string,liked:boolean,request:LikeRequest){
  if(typeof liked!=="boolean")throw new MemberApiError(400,"INVALID_REQUEST","좋아요 상태를 확인해 주세요.");
  const result=await request(likePath(target,id,true),{method:liked?"PUT":"DELETE"});
  if(result!==null)throw new MemberApiError(0,"INVALID_RESPONSE","좋아요 저장 결과를 확인하지 못했습니다.");
}
export function likeFailure(error:unknown){
  if(error instanceof MemberApiError&&error.status===404)return "콘텐츠를 찾을 수 없거나 좋아요를 사용할 수 없는 상태입니다.";
  if(error instanceof MemberApiError&&error.status===403)return "현재 회원 상태에서는 좋아요를 사용할 수 없습니다.";
  return "좋아요 상태를 확인하지 못했습니다. 상태를 다시 불러온 후 시도해 주세요.";
}
