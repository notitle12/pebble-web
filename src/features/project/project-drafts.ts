import type {ProjectEditorValue} from './project-editor-model.ts';
export type ProjectDraft={value:ProjectEditorValue;projectId?:string;cover:File|null;coverDeleted?:boolean;savedAt:number};
function openDrafts():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const request=indexedDB.open('pebble-project-drafts',1);request.onupgradeneeded=()=>request.result.createObjectStore('drafts');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(new Error('이 브라우저에서 임시저장 공간을 열지 못했어요.'));});}
export async function projectDraft(action:'read'|'write'|'remove',memberId:string,id:string|undefined,value?:ProjectDraft):Promise<ProjectDraft|undefined>{
 const db=await openDrafts();const key=`${memberId}:${id??'new'}`;
 try{return await new Promise((resolve,reject)=>{const tx=db.transaction('drafts',action==='read'?'readonly':'readwrite'),store=tx.objectStore('drafts');const req=action==='read'?store.get(key):action==='write'?store.put(value,key):store.delete(key);let result:ProjectDraft|undefined;req.onsuccess=()=>{if(action==='read')result=req.result as ProjectDraft|undefined;};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(new Error('임시저장에 실패했어요. 브라우저 저장 공간을 확인해 주세요.'));tx.onabort=()=>reject(new Error('임시저장이 취소됐어요.'));});}finally{db.close();}
}
