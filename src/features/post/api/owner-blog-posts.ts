import {parseOwnPosts,type OwnPostPage} from './member-posts.ts';
import {validId,parsePage} from '../../../lib/list-query.ts';
import {MemberApiError} from '../../../lib/member-api.ts';
import type {SessionState} from '../../auth/user-session.ts';
import {postHref,type PostSummary} from './post-list.ts';
export type BlogPostQuery={page:number;boardId?:string;q?:string;placement?:'boards'|'projects'};
export function ownBlogPostsPath({page,boardId,q,placement}:BlogPostQuery){
 if(parsePage(String(page))!==page||boardId!==undefined&&!validId(boardId)||q!==undefined&&(!q.trim()||Array.from(q).length>200)||placement!==undefined&&!['boards','projects'].includes(placement)||boardId&&(q||placement)||q&&placement)throw new MemberApiError(400,'INVALID_REQUEST','블로그 목록 주소를 확인해 주세요.');
 const params=new URLSearchParams({page:String(page),size:'20'});
 if(boardId)params.set('boardId',boardId);if(q)params.set('q',q);if(placement)params.set('placement',placement);
 return `/members/me/blog/posts?${params}`;
}
export function parseOwnerBlogPosts(value:unknown,query:BlogPostQuery,memberId:string,handle:string):OwnPostPage{
 const page=parseOwnPosts(value,query.page,memberId,query.boardId);
 if(page.content.some(post=>post.author.handle!==handle||post.draft!==false||post.isBlocked!==false))throw new MemberApiError(0,'INVALID_RESPONSE','내 블로그 글 목록을 확인하지 못했어요.');
 return page;
}
export type OwnerBlogSnapshot={session:SessionState;path:string;data:OwnPostPage|null;error:string};
export function matchesOwnerBlogSnapshot(snapshot:OwnerBlogSnapshot|null,session:SessionState,path:string,authorId:string,handle:string):boolean{
 return session.phase==='ready'&&session.member?.id===authorId&&session.member.handle===handle&&snapshot?.session===session&&snapshot.path===path;
}
export function blogPostHref(post:PostSummary){return post.visibilityStatus==='HIDDEN'?`/posts/${post.id}/view`:postHref(post.author.handle,post.urlKey)!;}
