import {MemberApiError, memberJson, responseData} from "../../../lib/member-api.ts";
export type CommentTarget = "posts" | "projects";
export type CommentVisibility = "PUBLIC" | "SECRET";
export type Comment = {id:string;author:{id:string|null;nickname:string;handle:string|null;blogName:string|null;profileImageUrl:string|null};body:string;visibility:CommentVisibility;createdAt:string;updatedAt:string};
export type CommentPage = {content:Comment[];page:number;size:number;totalElements:number;totalPages:number;hasNext:boolean;hasPrevious:boolean};
const invalid = () => new MemberApiError(0,"INVALID_RESPONSE","댓글 응답을 확인하지 못했습니다.");
function id(value:unknown):value is string {return typeof value === "string" && /^[1-9]\d{0,18}$/.test(value) && BigInt(value)<=9223372036854775807n;}
export function commentPath(target:CommentTarget,contentId:string,commentId?:string) {
  if(!["posts","projects"].includes(target)||!id(contentId)||(commentId!==undefined&&!id(commentId)))throw new MemberApiError(400,"INVALID_REQUEST","댓글 주소를 확인해 주세요.");
  return `/${target}/${contentId}/comments${commentId===undefined?"":`/${commentId}`}`;
}
export function commentInput(body:string,visibility:CommentVisibility) {
  if(!body.trim() || Array.from(body).length>2000 || /\u0000|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(body))throw new MemberApiError(400,"VALIDATION_ERROR","댓글은 빈 내용 없이 2,000자까지 입력해 주세요.");
  if(!["PUBLIC","SECRET"].includes(visibility))throw new MemberApiError(400,"VALIDATION_ERROR","댓글 공개 범위를 확인해 주세요.");
  return {body,visibility};
}
function object(value:unknown):Record<string,unknown> {if(typeof value!=="object"||value===null||Array.isArray(value))throw invalid();return value as Record<string,unknown>;}
function parseItem(value:unknown):Comment {
  const d=object(value),a=object(d.author);
  if(!id(d.id)||!(a.id===null||id(a.id))||typeof a.nickname!=="string"||!a.nickname.trim()||!(a.handle===null||typeof a.handle==="string")||!(a.blogName===null||typeof a.blogName==="string")||!(a.profileImageUrl===undefined||a.profileImageUrl===null||typeof a.profileImageUrl==="string")||typeof d.body!=="string"||!Array.from(d.body).length||Array.from(d.body).length>2000||!["PUBLIC","SECRET"].includes(String(d.visibility))||(a.id===null&&(d.visibility!=="PUBLIC"||a.handle!==null||a.blogName!==null||a.profileImageUrl!=null))||typeof d.createdAt!=="string"||!Number.isFinite(Date.parse(d.createdAt))||typeof d.updatedAt!=="string"||!Number.isFinite(Date.parse(d.updatedAt)))throw invalid();
  return {id:d.id,author:{id:a.id,nickname:a.nickname,handle:a.handle,blogName:a.blogName,profileImageUrl:typeof a.profileImageUrl==="string"?a.profileImageUrl:null},body:d.body,visibility:d.visibility as CommentVisibility,createdAt:d.createdAt,updatedAt:d.updatedAt};
}
export function parseComment(value:unknown):Comment {return parseItem(responseData(value));}
export function parseCommentPage(value:unknown,page:number,guest=false):CommentPage {
  const d=responseData(value);
  if(!Array.isArray(d.content)||d.page!==page||d.size!==20||!Number.isSafeInteger(d.totalElements)||Number(d.totalElements)<0||!Number.isSafeInteger(d.totalPages)||Number(d.totalPages)<0||typeof d.hasNext!=="boolean"||typeof d.hasPrevious!=="boolean")throw invalid();
  const content=d.content.map(parseItem),total=Number(d.totalElements),pages=Number(d.totalPages);
  if(content.length>20||new Set(content.map(c=>c.id)).size!==content.length||total<content.length||pages!==Math.ceil(total/20)||d.hasPrevious!==(page>0)||d.hasNext!==(page+1<pages)||(guest&&content.some(c=>c.visibility!=="PUBLIC")))throw invalid();
  return {content,page,size:20,totalElements:total,totalPages:pages,hasNext:d.hasNext,hasPrevious:d.hasPrevious};
}
export function guestCommentInput(nickname:string,password:string,body:string) {
  const cleanNickname=nickname.trim() || "조약돌";
  const points=Array.from(password).length;
  if(!cleanNickname||Array.from(cleanNickname).length>30||/[\p{Cc}]/u.test(cleanNickname))throw new MemberApiError(400,"VALIDATION_ERROR","닉네임은 공백을 제외하고 1~30자로 입력해 주세요.");
  if(points<4||points>10||new TextEncoder().encode(password).length>256||/[\p{Cc}]/u.test(password)||/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(password))throw new MemberApiError(400,"VALIDATION_ERROR","비밀번호는 제어 문자가 없는 4~10자로 입력해 주세요.");
  const content=commentInput(body,"PUBLIC");
  return {nickname:cleanNickname,password,body:content.body};
}
export async function createGuestComment(target:CommentTarget,contentId:string,input:{nickname:string;password:string;body:string},request:typeof fetch=fetch,base?:string) {
  return parseComment(await memberJson(`${commentPath(target,contentId)}/guest`,{method:"POST",body:input},request,base));
}
export async function updateGuestComment(target:CommentTarget,contentId:string,commentId:string,input:{password:string;body:string},request:typeof fetch=fetch,base?:string) {
  const body=commentInput(input.body,"PUBLIC").body;
  return parseComment(await memberJson(`${commentPath(target,contentId,commentId)}/guest/update`,{method:"POST",body:{password:input.password,body}},request,base));
}
export async function deleteGuestComment(target:CommentTarget,contentId:string,commentId:string,password:string,request:typeof fetch=fetch,base?:string) {
  await memberJson(`${commentPath(target,contentId,commentId)}/guest/delete`,{method:"POST",body:{password}},request,base);
}
export async function readComments(target:CommentTarget,contentId:string,page:number,request:(path:string)=>Promise<unknown>=memberJson,guest=false) {
  if(!Number.isSafeInteger(page)||page<0||page*20>2147483647)throw new MemberApiError(400,"INVALID_REQUEST","댓글 페이지를 확인해 주세요.");
  return parseCommentPage(await request(`${commentPath(target,contentId)}?page=${page}&size=20&sort=createdAt,asc`),page,guest);
}
export function commentFailure(error:unknown):string {
  if(error instanceof MemberApiError){
    if(error.status===0)return "서버 응답을 확인하지 못했습니다. 댓글을 다시 불러와 처리 여부를 확인해 주세요. 입력은 유지됩니다.";
    if(error.status===401)return "로그인이 필요합니다. 입력은 유지됩니다. 다시 로그인해 주세요.";
    if(error.code==="INVALID_COMMENT_PASSWORD")return "비밀번호가 맞지 않습니다. 댓글 비밀번호를 다시 확인해 주세요.";
    if(error.code==="COMMENT_RATE_LIMITED")return "요청이 잠시 많습니다. 잠시 후 다시 시도해 주세요.";
    if(error.status===403)return "현재 계정으로 댓글을 처리할 수 없습니다.";
    if(error.status===404)return "댓글 또는 콘텐츠가 없거나 접근 권한이 없습니다. 목록을 다시 불러와 주세요.";
  }
  return error instanceof Error?error.message:"댓글을 처리하지 못했습니다.";
}
