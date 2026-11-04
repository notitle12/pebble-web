"use client";
import {useState} from 'react';
import type {WriterDraft} from '../lib/writer-drafts';
export function WriterRecovery<T>({records,onRestore,onFresh,error}:{records:WriterDraft<T>[];onRestore:(record:WriterDraft<T>)=>Promise<void>;onFresh:()=>Promise<void>;error:string}){
 const [busy,setBusy]=useState(false);
 return <section className="writer-recovery" aria-label="자동저장 복구"><h2>작성 중이던 내용이 있어요</h2><p>브라우저를 닫거나 페이지를 나가기 전의 최근 작업을 복구할 수 있습니다. 복구하지 않으면 이 자동저장본은 삭제됩니다.</p>{records.slice(0,5).map(record=><div key={record.key}><span><strong>{String((record.value as Record<string,unknown>).title||(record.value as Record<string,unknown>).name||'제목 없는 작성본')}</strong><small>{record.savedAt?new Intl.DateTimeFormat('ko-KR',{dateStyle:'short',timeStyle:'short'}).format(record.savedAt):'이전 임시저장본'}{records.length>1?' · 별도 작성본':''}{record.images.length?` · 이미지 ${record.images.length}개`:''}</small></span><button type="button" disabled={busy} onClick={()=>{setBusy(true);void onRestore(record).catch(()=>{}).finally(()=>setBusy(false));}}>복구하기</button></div>)}{error&&<p role="alert">{error}</p>}<button type="button" disabled={busy} onClick={()=>{setBusy(true);void onFresh().catch(()=>{}).finally(()=>setBusy(false));}}>복구하지 않고 시작</button></section>;
}
