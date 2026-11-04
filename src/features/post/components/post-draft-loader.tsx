"use client";
import {useRef,useState} from 'react';
import {userSession} from '../../auth/user-session';
import {fetchSavedPostDrafts,localManualPostDrafts,type SavedPostChoice} from '../saved-post-drafts';
export function PostDraftLoader({memberId,disabled,onSelect}:{memberId:string;disabled:boolean;onSelect:(record:SavedPostChoice)=>Promise<void>}){
 const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null),loadId=useRef(0),requestedPage=useRef(0);
 const [rows,setRows]=useState<SavedPostChoice[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[page,setPage]=useState(0),[more,setMore]=useState(false);
 const load=async(nextPage:number)=>{
  requestedPage.current=nextPage;const generation=++loadId.current;setBusy(true);setError('');
  const results=await Promise.allSettled([fetchSavedPostDrafts(path=>userSession.request(path),memberId,nextPage),nextPage===0?localManualPostDrafts(memberId):Promise.resolve([])]);
  if(generation!==loadId.current)return;
  const server=results[0],local=results[1];
  if(server.status==='fulfilled'){setRows(previous=>[...(nextPage===0?(local.status==='fulfilled'?local.value:[]):previous),...server.value.records]);setMore(server.value.hasNext);setPage(nextPage);}
  else {if(nextPage===0&&local.status==='fulfilled')setRows(local.value);setError(server.reason instanceof Error?server.reason.message:'임시저장 글을 불러오지 못했습니다.');}
  if(local.status==='rejected')setError(local.reason instanceof Error?local.reason.message:'브라우저 임시저장을 읽지 못했습니다.');
  setBusy(false);
 };
 const close=()=>{++loadId.current;setBusy(false);dialog.current?.close();trigger.current?.focus();};
 return <><button ref={trigger} type="button" className="secondary writer-draft-load" aria-label="임시저장 불러오기" disabled={disabled} onClick={()=>{setRows([]);dialog.current?.showModal();void load(0);}}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10H3z"/><path d="M12 10v6m-3-3 3 3 3-3"/></svg><span>불러오기</span></button>
 <dialog ref={dialog} className="writer-draft-dialog" aria-labelledby="saved-drafts-title" onCancel={event=>{event.preventDefault();if(!busy)close();}}>
  <header><h2 id="saved-drafts-title">임시저장 불러오기</h2><p>직접 임시저장한 글을 이어서 작성하세요.</p></header>
  {rows.length>0?<ul>{rows.map(record=><li key={`${record.local?'local':'server'}:${record.id}`}><span><strong>{record.title||'제목 없는 글'}</strong><small>{new Intl.DateTimeFormat('ko-KR',{dateStyle:'short',timeStyle:'short'}).format(new Date(record.savedAt))}{record.local?' · 이 브라우저':''}</small></span><button type="button" className="editor-action" disabled={busy} onClick={()=>{setBusy(true);setError('');void onSelect(record).then(close).catch(error=>{setError(error instanceof Error?error.message:'글을 불러오지 못했습니다.');setBusy(false);});}}>불러오기</button></li>)}</ul>:!busy&&!error&&<p>임시저장한 글이 없습니다.</p>}
  {busy&&<p role="status">임시저장 글을 확인하는 중…</p>}{error&&<p role="alert">{error}</p>}
  <footer>{error&&<button type="button" className="editor-action" disabled={busy} onClick={()=>void load(requestedPage.current)}>다시 시도</button>}{more&&<button type="button" className="editor-action" disabled={busy} onClick={()=>void load(page+1)}>더 불러오기</button>}<button type="button" className="editor-action" disabled={busy} onClick={close}>취소</button></footer>
 </dialog></>;
}
