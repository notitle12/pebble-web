"use client";
import "@/app/writer-draft-loader.css";
import {useCallback,useEffect,useRef,useState} from 'react';
import {userSession} from '../../auth/user-session';
import {fetchSavedPostDrafts,localManualPostDrafts,mergeSavedPostChoices,savedPostDraftCount,type SavedPostChoice} from '../saved-post-drafts';
export function PostDraftLoader({memberId,disabled,onSelect}:{memberId:string;disabled:boolean;onSelect:(record:SavedPostChoice)=>Promise<void>}){
 const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null),loadId=useRef(0),requestedPage=useRef(0);
 const localRows=useRef<SavedPostChoice[]>([]);
 const serverRows=useRef<SavedPostChoice[]>([]);
 const [rows,setRows]=useState<SavedPostChoice[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[page,setPage]=useState(0),[more,setMore]=useState(false);
 const [count,setCount]=useState<number|null>(null),[open,setOpen]=useState(false);
 const load=useCallback(async(nextPage:number)=>{
  requestedPage.current=nextPage;const generation=++loadId.current;setBusy(true);setError('');
  const results=await Promise.allSettled([fetchSavedPostDrafts(path=>userSession.request(path),memberId,nextPage),nextPage===0?localManualPostDrafts(memberId):Promise.resolve([])]);
  if(generation!==loadId.current)return;
  const server=results[0],local=results[1];
  if(nextPage===0&&local.status==='fulfilled')localRows.current=local.value;
  if(server.status==='fulfilled'){
   serverRows.current=mergeSavedPostChoices(nextPage===0?[]:serverRows.current,server.value.records);
   setRows(previous=>mergeSavedPostChoices(nextPage===0?localRows.current:previous,server.value.records));setMore(server.value.hasNext);setPage(nextPage);
   if(local.status==='fulfilled')setCount(savedPostDraftCount(server.value.total,serverRows.current,localRows.current));
  }
  else {setCount(null);if(nextPage===0&&local.status==='fulfilled')setRows(local.value);setMore(false);setError(server.reason instanceof Error?server.reason.message:'임시저장 글을 불러오지 못했습니다.');}
  if(local.status==='rejected'){setCount(null);setError(local.reason instanceof Error?local.reason.message:'브라우저 임시저장을 읽지 못했습니다.');}
  setBusy(false);
 },[memberId]);
 useEffect(()=>{
  if(!disabled)void load(0);
  const refresh=()=>{if(!disabled&&!dialog.current?.open)void load(0);};
  window.addEventListener('focus',refresh);
  return()=>{++loadId.current;window.removeEventListener('focus',refresh);};
 },[disabled,load]);
 const close=()=>{++loadId.current;setOpen(false);setBusy(false);dialog.current?.close();trigger.current?.focus({preventScroll:true});};
 const countLabel=count===null?(error?'개수 확인 실패':'개수 확인 중'):`${count}개`;
 return <><button ref={trigger} type="button" className="writer-draft-count" aria-label={`임시저장 불러오기, ${countLabel}`} aria-haspopup="dialog" aria-expanded={open} title={`임시저장 불러오기 · ${countLabel}`} disabled={disabled} onClick={()=>{setOpen(true);dialog.current?.showModal();void load(0);}}>{count===null?(error?'—':'…'):new Intl.NumberFormat('ko-KR').format(count)}</button>
 <dialog ref={dialog} className="writer-draft-dialog" aria-labelledby="saved-drafts-title" onCancel={event=>{event.preventDefault();if(!busy)close();}}>
  <header><h2 id="saved-drafts-title">임시저장 불러오기</h2><p>직접 임시저장한 글을 이어서 작성하세요.</p></header>
  {rows.length>0?<ul>{rows.map(record=><li key={`${record.local?'local':'server'}:${record.id}`}><span><strong>{record.title||'제목 없는 글'}</strong><small>{new Intl.DateTimeFormat('ko-KR',{dateStyle:'short',timeStyle:'short'}).format(new Date(record.savedAt))}{record.local?' · 이 브라우저':''}</small></span><button type="button" className="editor-action" disabled={busy} onClick={()=>{setBusy(true);setError('');void onSelect(record).then(close).catch(error=>{setError(error instanceof Error?error.message:'글을 불러오지 못했습니다.');setBusy(false);});}}>불러오기</button></li>)}</ul>:!busy&&!error&&<p>임시저장한 글이 없습니다.</p>}
  {busy&&<p role="status">임시저장 글을 확인하는 중…</p>}{error&&<p role="alert">{error}</p>}
  <footer>{error&&<button type="button" className="editor-action" disabled={busy} onClick={()=>void load(requestedPage.current)}>다시 시도</button>}{more&&<button type="button" className="editor-action" disabled={busy} onClick={()=>void load(page+1)}>더 불러오기</button>}<button type="button" className="editor-action" disabled={busy} onClick={close}>취소</button></footer>
 </dialog></>;
}
