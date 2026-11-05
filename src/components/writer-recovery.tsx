"use client";
import {useEffect,useId,useRef,useState} from 'react';
import type {WriterDraft} from '../lib/writer-drafts';
export function WriterRecovery<T>({records,onRestore,onFresh,error}:{records:WriterDraft<T>[];onRestore:(record:WriterDraft<T>)=>Promise<void>;onFresh:()=>Promise<void>;error:string}){
 const dialog=useRef<HTMLDialogElement>(null),loadAction=useRef<HTMLButtonElement>(null),titleId=useId();
 const [busy,setBusy]=useState(false);const record=records[0];
 useEffect(()=>{const node=dialog.current;if(node&&!node.open){node.showModal();loadAction.current?.focus();}return()=>{if(node?.open)node.close();};},[]);
 const cancel=()=>{if(busy)return;setBusy(true);void onFresh().catch(()=>{}).finally(()=>setBusy(false));};
 if(!record)return null;
 return <dialog ref={dialog} className="writer-recovery-dialog" aria-labelledby={titleId} onCancel={event=>{event.preventDefault();cancel();}}>
  <h2 id={titleId}>작성 중이던 내용이 있어요</h2><p>브라우저를 닫거나 페이지를 나가기 전의 최근 작업을 불러올 수 있습니다. 취소하면 이 자동저장본은 삭제됩니다.</p>
  <div className="writer-recovery-record"><strong>{String((record.value as Record<string,unknown>).title||(record.value as Record<string,unknown>).name||'제목 없는 작성본')}</strong><small>{record.savedAt?new Intl.DateTimeFormat('ko-KR',{dateStyle:'short',timeStyle:'short'}).format(record.savedAt):'이전 자동저장본'}{record.images.length?` · 이미지 ${record.images.length}개`:''}</small></div>
  {error&&<p role="alert">{error}</p>}
  <footer><button type="button" className="editor-action" disabled={busy} onClick={cancel}>취소</button><button type="button" ref={loadAction} className="editor-action writer-recovery-load" disabled={busy} autoFocus onClick={()=>{setBusy(true);void onRestore(record).catch(()=>{}).finally(()=>setBusy(false));}}>불러오기</button></footer>
 </dialog>;
}
