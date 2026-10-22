import {parsePage,validId} from '../../../lib/list-query.ts';
import {MemberApiError} from '../../../lib/member-api.ts';
import {parsePostPage,type PostPage,type PostSummary} from '../../post/api/post-list.ts';
export type ProjectOrderPost=PostSummary&{visibilityStatus:'PUBLIC'|'HIDDEN';isBlocked:boolean;draft?:boolean};
export type ProjectOrderPage=Omit<PostPage,'content'>&{content:ProjectOrderPost[]};
export type ProjectOrderRequest=(path:string,options?:{method?:string;body?:unknown})=>Promise<unknown>;
const invalid=()=>new MemberApiError(0,'INVALID_RESPONSE','관련 게시글 목록을 확인하지 못했어요.');
function path(projectId:string){if(!validId(projectId))throw new MemberApiError(400,'INVALID_REQUEST','프로젝트 주소를 확인해 주세요.');return `/members/me/projects/${projectId}/posts`;}
export async function getProjectOrderPosts(projectId:string,page:number,memberId:string,request:ProjectOrderRequest):Promise<ProjectOrderPage>{
 const endpoint=path(projectId);
 if(parsePage(String(page))===null||!validId(memberId))throw new MemberApiError(400,'INVALID_REQUEST','관련 게시글 페이지를 확인해 주세요.');
 const result=parsePostPage(await request(`${endpoint}?page=${page}&size=20`),page);
 if(new Set(result.content.map(post=>post.id)).size!==result.content.length)throw invalid();
 for(const post of result.content){const row=post as ProjectOrderPost;if(row.author.id!==memberId||!['PUBLIC','HIDDEN'].includes(row.visibilityStatus)||typeof row.isBlocked!=='boolean'||row.draft!==undefined&&typeof row.draft!=='boolean')throw invalid();}
 return result as ProjectOrderPage;
}
export function projectPostMoveTarget(page:ProjectOrderPage,index:number,direction:-1|1):number|null{
 if(!Number.isInteger(index)||index<0||index>=page.content.length)return null;
 const target=page.page*page.size+index+direction;
 return target>=0&&target<page.totalElements?target:null;
}
export async function moveProjectPost(projectId:string,postId:string,displayOrder:number,request:ProjectOrderRequest):Promise<void>{
 const endpoint=path(projectId);
 if(!validId(postId)||!Number.isSafeInteger(displayOrder)||displayOrder<0||displayOrder>2147483647)throw new MemberApiError(400,'INVALID_REQUEST','게시글 순서를 확인해 주세요.');
 const result=await request(`${endpoint}/${postId}/order`,{method:'PATCH',body:{displayOrder}});
 if(result!==null)throw new MemberApiError(0,'INVALID_RESPONSE','순서 저장 결과를 확인하지 못했어요. 목록을 다시 불러와 주세요.');
}

/** Translate an insertion gap (before removing the dragged row) to the API position. */
export function projectPostDropTarget(source:number,insertion:number,total:number):number|null {
 if(!Number.isSafeInteger(total)||total<1||!Number.isSafeInteger(source)||source<0||source>=total||!Number.isSafeInteger(insertion)||insertion<0||insertion>total)return null;
 const target=insertion>source?insertion-1:insertion;
 return target===source?null:target;
}
