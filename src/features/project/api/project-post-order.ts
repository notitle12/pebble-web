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
export const MAX_PROJECT_ORDER_POSTS=10000;
export async function getProjectOrderSnapshot(projectId:string,memberId:string,request:ProjectOrderRequest):Promise<ProjectOrderPost[]>{
 const first=await getProjectOrderPosts(projectId,0,memberId,request);
 if(first.totalElements>MAX_PROJECT_ORDER_POSTS)throw invalid();
 const rows=[...first.content];
 for(let page=1;page<first.totalPages;page++){
  const next=await getProjectOrderPosts(projectId,page,memberId,request);
  if(next.totalElements!==first.totalElements||next.totalPages!==first.totalPages)throw invalid();
  if(rows.length!==page*20)throw invalid();
  rows.push(...next.content);
 }
 if(rows.length!==first.totalElements||new Set(rows.map(row=>row.id)).size!==rows.length)throw invalid();
 return rows;
}
export function sameProjectOrder(a:readonly string[],b:readonly string[]):boolean{return a.length===b.length&&a.every((id,index)=>id===b[index]);}
export function reorderProjectPosts<T>(rows:readonly T[],source:number,target:number):T[]{
 if(!Number.isInteger(source)||!Number.isInteger(target)||source<0||target<0||source>=rows.length||target>=rows.length)throw new Error('Invalid order position');
 const next=[...rows];const [post]=next.splice(source,1);next.splice(target,0,post);return next;
}
export async function saveProjectPostOrder(projectId:string,expectedPostIds:string[],postIds:string[],request:ProjectOrderRequest):Promise<boolean>{
 const endpoint=path(projectId),expectedSet=new Set(expectedPostIds);
 if(expectedPostIds.length>MAX_PROJECT_ORDER_POSTS||postIds.length!==expectedPostIds.length||!expectedPostIds.every(validId)||!postIds.every(validId)||new Set(expectedPostIds).size!==expectedPostIds.length||new Set(postIds).size!==postIds.length||postIds.some(id=>!expectedSet.has(id)))throw new MemberApiError(400,'INVALID_REQUEST','게시글 순서를 확인해 주세요.');
 if(sameProjectOrder(expectedPostIds,postIds))return false;
 const result=await request(`${endpoint}/order`,{method:'PUT',body:{expectedPostIds,postIds}});
 if(result!==null)throw new MemberApiError(0,'INVALID_RESPONSE','순서 저장 결과를 확인하지 못했어요. 목록을 다시 불러와 주세요.');
 return true;
}

/** Translate an insertion gap (before removing the dragged row) to the API position. */
export function projectPostDropTarget(source:number,insertion:number,total:number):number|null {
 if(!Number.isSafeInteger(total)||total<1||!Number.isSafeInteger(source)||source<0||source>=total||!Number.isSafeInteger(insertion)||insertion<0||insertion>total)return null;
 const target=insertion>source?insertion-1:insertion;
 return target===source?null:target;
}

/** 공개 상세와 같은 조건으로 숨김 글을 제외하며 편집 중 순서를 보존한다. */
export function projectOrderPreviewPosts(rows:readonly ProjectOrderPost[]):ProjectOrderPost[]{return rows.filter(post=>post.visibilityStatus==='PUBLIC'&&!post.isBlocked&&!post.draft);}
