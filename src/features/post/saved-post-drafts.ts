import {parseOwnPosts} from './api/member-posts.ts';
import {manualPostDraftStore,validDraftValue,type WriterDraft} from '../../lib/writer-drafts.ts';
import type {PostEditorValue} from './post-editor-model.ts';
export type SavedPostChoice={id:string;title:string;savedAt:string;local?:WriterDraft<PostEditorValue>};
export async function fetchSavedPostDrafts(request:(path:string)=>Promise<unknown>,memberId:string,page=0){
 const response=parseOwnPosts(await request(`/members/me/posts?page=${page}&size=20&visibilityStatus=HIDDEN&sort=createdAt,desc`),page,memberId);
 return {records:response.content.filter(post=>post.draft===true).map(post=>({id:post.id,title:post.title,savedAt:post.updatedAt??post.createdAt})),hasNext:response.hasNext};
}
export async function localManualPostDrafts(memberId:string):Promise<SavedPostChoice[]>{
 const scope={memberId,kind:'post' as const};
 const existing=await manualPostDraftStore.list<PostEditorValue>(scope,true);
 // Older explicit saves belong to the manual picker, never to crash recovery.
 const prefix=`pebble:post-edit:${memberId}:`;
 for(const key of Object.keys(localStorage)){
  if(!key.startsWith(prefix)||!/^[1-9]\d{0,18}$/.test(key.slice(prefix.length)))continue;
  const id=key.slice(prefix.length);
  if(existing.some(record=>record.contentId===id)){localStorage.removeItem(key);continue;}
  try{
   const value:unknown=JSON.parse(localStorage.getItem(key)??'null');
   if(!validDraftValue('post',value))continue;
   const record:WriterDraft<PostEditorValue>={...scope,targetId:id,contentId:id,value:value as PostEditorValue,images:[],version:1,key:`manual:${memberId}:${id}`,savedAt:Date.now()};
   await manualPostDraftStore.write(record);existing.push(record);localStorage.removeItem(key);
  }catch{/* Keep a legacy save if it cannot be migrated. */}
 }
 return existing.map(record=>({id:record.contentId??record.targetId!,title:record.value.title,savedAt:new Date(record.savedAt).toISOString(),local:record}));
}
