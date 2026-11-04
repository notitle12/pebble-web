"use client";
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createAutosaveQueue,type AutosaveState} from './autosave-queue';
import {cleanDraftValue,draftKey,writerDraftStore,type DraftPayload,type DraftScope,type WriterDraft} from './writer-drafts';

type Checkpoint<T>={payload:DraftPayload<T>;capturedAt:number};
type Options<T>={scope:DraftScope;enabled:boolean;dirty:boolean;signature:string;snapshot:()=>DraftPayload<T>;onRestore:(draft:DraftPayload<T>)=>void|Promise<void>;legacy?:()=>Promise<DraftPayload<T>|undefined>};
export function useWriterAutosave<T>(options:Options<T>){
 const latest=useRef(options);latest.current=options;
 const scope=useRef(options.scope),session=useRef(''),source=useRef<WriterDraft<T>|null>(null),mounted=useRef(false),started=useRef(false);
 const [ready,setReady]=useState(false),[recovery,setRecovery]=useState<WriterDraft<T>[]>([]),[state,setState]=useState<AutosaveState>({phase:'idle'}),[loadError,setLoadError]=useState('');
 const key=()=>draftKey(scope.current,session.current);
 const controller=useRef<ReturnType<typeof createAutosaveQueue<Checkpoint<T>>> | null>(null);
 if(!controller.current)controller.current=createAutosaveQueue({
  write:async checkpoint=>{
   const payload=checkpoint.payload;
   await writerDraftStore.write({...scope.current,...payload,value:cleanDraftValue(payload.value),version:1,key:key(),savedAt:checkpoint.capturedAt,revision:crypto.randomUUID()});
   if(source.current){const old=source.current;await writerDraftStore.remove(old.key,old.revision??old.savedAt);source.current=null;}
  },
  clear:async()=>{await writerDraftStore.remove(key());if(source.current){const old=source.current;await writerDraftStore.remove(old.key,old.revision??old.savedAt);source.current=null;}},
  onState:next=>{if(mounted.current){setState(next);if(next.phase==='saved')setLoadError('');}},
 });
 useEffect(()=>{mounted.current=true;session.current||=crypto.randomUUID();return()=>{void controller.current?.flush().catch(()=>{});controller.current?.stop();mounted.current=false;};},[]);
 useEffect(()=>{
  if(!options.enabled||started.current)return;
  started.current=true;
  void writerDraftStore.list<T>(scope.current).then(async records=>{
   if(!records.length&&latest.current.legacy){const legacy=await latest.current.legacy();if(legacy)records=[{...scope.current,...legacy,version:1,key:'legacy',savedAt:0}];}
   if(mounted.current){setRecovery(records);setReady(records.length===0);}
  }).catch(error=>{if(mounted.current){setLoadError(error instanceof Error?error.message:'자동저장본을 읽지 못했어요.');setReady(true);}});
 },[options.enabled]);
 useLayoutEffect(()=>{
  if(ready&&options.enabled&&options.dirty)controller.current?.schedule({payload:options.snapshot(),capturedAt:Date.now()});
 },[ready,options.enabled,options.dirty,options.signature]);
 useEffect(()=>{
  const flush=()=>{void controller.current?.flush().catch(()=>{});};
  const hidden=()=>{if(document.visibilityState==='hidden')flush();};
  window.addEventListener('pagehide',flush);document.addEventListener('visibilitychange',hidden);
  return()=>{window.removeEventListener('pagehide',flush);document.removeEventListener('visibilitychange',hidden);};
 },[]);
 const restore=async(record:WriterDraft<T>)=>{
  try{await latest.current.onRestore(record);if(record.key!=='legacy')source.current=record;setRecovery([]);setReady(true);setLoadError('');}
  catch(error){setLoadError(error instanceof Error?error.message:'자동저장본을 복구하지 못했어요. 저장본은 유지했습니다.');}
 };
 const fresh=()=>{setRecovery([]);setReady(true);};
 const saveNow=async()=>{controller.current!.schedule({payload:latest.current.snapshot(),capturedAt:Date.now()});await controller.current!.flush();};
 const status=state.phase==='pending'?'자동저장 대기 중…':state.phase==='saving'?'자동저장 중…':state.phase==='saved'?`이 브라우저에 자동저장 · ${new Intl.DateTimeFormat('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false}).format(state.savedAt)}`:'';
 return{ready,recovery,restore,fresh,status,error:loadError||state.error||'',saveNow,flush:()=>controller.current!.flush(),clear:async()=>{try{await controller.current!.clear();}catch(error){setLoadError('서버에는 저장됐지만 이전 자동저장본을 정리하지 못했어요.');throw error;}}};
}
