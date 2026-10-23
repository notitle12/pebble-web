'use client';
import {useEffect,useId,useRef,useState,type KeyboardEvent,type PointerEvent} from 'react';
import {userSession} from '@/features/auth/user-session';
import {MemberApiError} from '@/lib/member-api';
import {getProjectOrderSnapshot,saveProjectPostOrder,sameProjectOrder,reorderProjectPosts,projectPostDropTarget,type ProjectOrderPost} from '../api/project-post-order';
import s from './project-post-order.module.css';
type Drag={index:number;source:number;insertion:number;mode:'pointer'|'keyboard';x:number;y:number;startY:number;active:boolean;touch?:boolean};
export type ProjectOrderPreviewState={posts:ProjectOrderPost[]|null;loading:boolean;error:string};
type Props={projectId:string;memberId:string;disabled?:boolean;onSaved?:()=>void;onBusyChange?:(busy:boolean)=>void;onDirtyChange?:(dirty:boolean)=>void;onPreviewChange?:(state:ProjectOrderPreviewState)=>void};
export function ProjectPostOrder({projectId,memberId,disabled=false,onSaved,onBusyChange,onDirtyChange,onPreviewChange}:Props){
 const help=useId(),root=useRef<HTMLDivElement>(null);
 const [rows,setRows]=useState<ProjectOrderPost[]|null>(null),[baseline,setBaseline]=useState<string[]>([]),[visibleCount,setVisibleCount]=useState(10),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[uncertain,setUncertain]=useState(false),[attempt,setAttempt]=useState(0);
 const [dragging,setDragging]=useState<{source:number;insertion:number}|null>(null);
 const drag=useRef<Drag|null>(null),frame=useRef<number|null>(null),hold=useRef<ReturnType<typeof setTimeout>|null>(null);
 const dirty=rows!==null&&!sameProjectOrder(baseline,rows.map(row=>row.id));
 useEffect(()=>{onPreviewChange?.({posts:rows,loading,error});},[rows,loading,error,onPreviewChange]);
 const total=rows?.length??0;
 const data=rows?{content:rows.slice(0,visibleCount),totalElements:total}:null;
 useEffect(()=>{onDirtyChange?.(dirty);return()=>onDirtyChange?.(false);},[dirty,onDirtyChange]);
 useEffect(()=>{const warn=(event:BeforeUnloadEvent)=>{if(dirty){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
 const mounted=useRef(false),lock=useRef(false),generation=useRef(0);
 const current=()=>mounted.current&&userSession.snapshot().phase==='ready'&&userSession.snapshot().member?.id===memberId;
 function cancelDrag(){if(hold.current)clearTimeout(hold.current);hold.current=null;drag.current=null;if(frame.current!==null)cancelAnimationFrame(frame.current);frame.current=null;setDragging(null);}
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;generation.current++;if(hold.current)clearTimeout(hold.current);if(frame.current!==null)cancelAnimationFrame(frame.current);};},[]);
 useEffect(()=>{if(disabled)cancelDrag();},[disabled]);
 useEffect(()=>{const preventScroll=(event:TouchEvent)=>{if(drag.current?.touch&&drag.current.active)event.preventDefault();};window.addEventListener('touchmove',preventScroll,{passive:false});return()=>window.removeEventListener('touchmove',preventScroll);},[]);
 const interacting=busy||dragging!==null;
 useEffect(()=>{onBusyChange?.(interacting);return()=>onBusyChange?.(false);},[interacting,onBusyChange]);
 async function load(){
  const epoch=++generation.current;setLoading(true);setError('');
  try{
   const result=await getProjectOrderSnapshot(projectId,memberId,(path,options)=>userSession.request(path,options));
   if(!current()||epoch!==generation.current)return;
   setRows(result);setBaseline(result.map(row=>row.id));setVisibleCount(10);setUncertain(false);
  }catch(e){if(current()&&epoch===generation.current){setError(e instanceof MemberApiError&&e.status===404?'프로젝트가 없거나 본인 프로젝트가 아니에요.':'관련 게시글을 불러오지 못했어요. 다시 불러와 주세요.');setUncertain(true);}}
  finally{if(mounted.current&&epoch===generation.current)setLoading(false);}
 }
 useEffect(()=>{cancelDrag();void load();return()=>{generation.current++;};},[projectId,memberId,attempt]); // eslint-disable-line react-hooks/exhaustive-deps
 function reload(){if(dirty&&!window.confirm('저장하지 않은 순서 변경을 버리고 다시 불러올까요?'))return;setAttempt(n=>n+1);}
 function move(source:number,target:number){
  if(!rows||disabled||loading||lock.current||uncertain||!current())return;
  setRows(reorderProjectPosts(rows,source,target));
 }
 async function save(){
  if(!rows||!dirty||disabled||loading||lock.current||uncertain||dragging||!current())return;
  lock.current=true;setBusy(true);setError('');
  const desired=rows.map(row=>row.id);
  try{
   await saveProjectPostOrder(projectId,baseline,desired,(path,options)=>userSession.request(path,options));
   if(!current())return;
   setBaseline(desired);onSaved?.();
  }catch(e){if(current()){
   const reloadRequired=!(e instanceof MemberApiError)||e.status===0||e.status>=500||e.status===409;
   setUncertain(reloadRequired);
   setError(e instanceof MemberApiError&&e.code==='POST_ORDER_CONFLICT'?'관련 게시글이 변경되었어요. 목록을 다시 불러와 주세요.':reloadRequired?'저장 결과를 확인하려면 목록을 다시 불러와 주세요.':e instanceof Error?e.message:'순서를 저장하지 못했어요.');
  }}finally{lock.current=false;if(mounted.current)setBusy(false);}
 }
 function commitDrag(){const d=drag.current;cancelDrag();if(!d?.active||!data)return;const target=projectPostDropTarget(d.source,d.insertion,data.totalElements);if(target!==null)move(d.source,target);}
 function showDrag(d:Drag){setDragging(previous=>previous?.source===d.source&&previous.insertion===d.insertion?previous:{source:d.source,insertion:d.insertion});}
 function hitTest(d:Drag){
  const element=document.elementFromPoint(d.x,d.y)?.closest<HTMLElement>('[data-order-index],[data-order-gap]');
  if(!element||!root.current?.contains(element))return false;
  if(element.dataset.orderGap!==undefined)d.insertion=Number(element.dataset.orderGap);
  else{const rect=element.getBoundingClientRect();d.insertion=Number(element.dataset.orderIndex)+(d.y>rect.top+rect.height/2?1:0);}
  showDrag(d);return true;
 }
 function tick(){
  const d=drag.current;if(!d||d.mode!=='pointer'||!d.active)return;
  let container:HTMLElement|null=root.current?.parentElement??null;
  while(container&&!(container.scrollHeight>container.clientHeight&&/auto|scroll/.test(getComputedStyle(container).overflowY)))container=container.parentElement;
  const top=container?.getBoundingClientRect().top??0,bottom=container?.getBoundingClientRect().bottom??window.innerHeight;
  const delta=d.y<top+64?-12:d.y>bottom-64?12:0;
  if(delta){if(container)container.scrollBy(0,delta);else window.scrollBy(0,delta);}
  hitTest(d);frame.current=requestAnimationFrame(tick);
 }
 function pointerDown(event:PointerEvent<HTMLLIElement>,index:number){
  if(blocked||event.button!==0||drag.current||!data)return;
  if(event.pointerType!=='touch')event.preventDefault();event.currentTarget.focus({preventScroll:true});event.currentTarget.setPointerCapture(event.pointerId);
  const source=index;drag.current={index,source,insertion:source,mode:'pointer',x:event.clientX,y:event.clientY,startY:event.clientY,active:false,touch:event.pointerType==='touch'};
  if(event.pointerType==='touch')hold.current=setTimeout(()=>{const d=drag.current;if(d){d.active=true;showDrag(d);frame.current=requestAnimationFrame(tick);}},350);
 }
 function pointerMove(event:PointerEvent<HTMLLIElement>){
  const d=drag.current;if(!d||d.mode!=='pointer')return;if(!d.touch||d.active)event.preventDefault();d.x=event.clientX;d.y=event.clientY;
  if(d.touch&&!d.active){if(Math.abs(d.y-d.startY)>8)cancelDrag();return;}
  if(!d.active&&Math.abs(d.y-d.startY)>=4){d.active=true;showDrag(d);frame.current=requestAnimationFrame(tick);}
  if(d.active)hitTest(d);
 }
 function keyDown(event:KeyboardEvent<HTMLLIElement>,index:number){
  if(blocked||!data)return;
  if(event.key==='Escape'&&drag.current){event.preventDefault();event.stopPropagation();cancelDrag();return;}
  const source=index;
  if(event.key===' '||event.key==='Enter'){
   event.preventDefault();event.stopPropagation();
   if(drag.current?.mode==='keyboard'){commitDrag();return;}
   drag.current={index,source,insertion:source,mode:'keyboard',x:0,y:0,startY:0,active:true};showDrag(drag.current);
  }else if(drag.current?.mode==='keyboard'&&['ArrowUp','ArrowDown'].includes(event.key)){
   event.preventDefault();const d=drag.current;const target=projectPostDropTarget(d.source,d.insertion,data.totalElements)??d.source;
   const next=Math.max(0,Math.min(data.totalElements-1,target+(event.key==='ArrowUp'?-1:1)));
   if(next>=visibleCount)setVisibleCount(Math.min(total,Math.ceil((next+1)/10)*10));d.insertion=next>d.source?next+1:next;showDrag(d);
  }else if(event.key==='Tab'&&drag.current?.mode==='keyboard')cancelDrag();
 }
 const blocked=disabled||busy||loading||uncertain;
 return <div ref={root} className={s.section} aria-busy={loading||busy} onKeyDown={event=>{if(event.key==='Escape'&&drag.current){event.preventDefault();event.stopPropagation();cancelDrag();}}}>
  <p id={help} className={s.srOnly}>행을 드래그하거나 터치로 길게 눌러 순서를 변경하세요. 키보드는 Space, 방향키, Enter로 이동하고 Esc로 취소하세요. 변경 후 저장 버튼을 눌러 주세요.</p>
  {error&&<p className={s.message} role="alert">{error}</p>}
  {(error||uncertain)&&<button type="button" className="button" disabled={disabled||busy||loading} onClick={reload}>목록 다시 불러오기</button>}
  <span className={s.srOnly} role="status">{busy?'순서를 저장하고 있어요.':dragging?`${(projectPostDropTarget(dragging.source,dragging.insertion,total)??dragging.source)+1}번째 위치`:''}</span>
  {loading?<p role="status">관련 게시글을 불러오고 있어요.</p>:data&&!data.content.length?<p>아직 연결된 게시글이 없어요. 게시글 발행 설정에서 이 프로젝트를 연결할 수 있어요.</p>:data&&<>
   <ol className={s.list} start={1} aria-label="관련 게시글 표시 순서">{data.content.map((post,index)=>{
    const position=index;
    return <li key={post.id} role="button" tabIndex={blocked?-1:0} aria-disabled={blocked} aria-label={`${post.title}: 순서 이동`} aria-describedby={help} aria-pressed={dragging?.source===position} data-order-index={position} className={`${s.row} ${dragging?.source===position?s.dragging:''} ${dragging?.insertion===position?s.dropBefore:''} ${dragging?.insertion===position+1&&index===data.content.length-1?s.dropAfter:''}`} onKeyDown={event=>keyDown(event,index)} onPointerDown={event=>pointerDown(event,index)} onPointerMove={pointerMove} onPointerUp={event=>{if(drag.current?.mode!=='pointer')return;pointerMove(event);if(drag.current?.active&&hitTest(drag.current))commitDrag();else cancelDrag();if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}} onPointerCancel={cancelDrag} onLostPointerCapture={()=>{if(drag.current?.mode==='pointer')cancelDrag();}} onDragStart={event=>event.preventDefault()}>
     <span className={s.number} aria-hidden="true">{position+1}</span><div className={s.content}><span className={s.title}>{post.title}</span><span className={s.status}>{post.visibilityStatus==='HIDDEN'?'비공개':'공개'}{post.isBlocked?' · 차단':''}{post.draft?' · 임시 글':''}</span></div>
    </li>;
   })}</ol>
  </>}
  {rows&&<div className={s.footer}>
  <div className={s.loadMore}>
   {visibleCount<total&&<button type="button" className="button" disabled={blocked||dragging!==null} onClick={()=>setVisibleCount(count=>Math.min(total,count+10))}>더 불러오기</button>}
   {visibleCount>10&&<button type="button" className="button" disabled={blocked||dragging!==null} onClick={()=>{setVisibleCount(10);requestAnimationFrame(()=>{const first=root.current?.querySelector<HTMLElement>('[data-order-index="0"]');first?.scrollIntoView({block:'nearest'});first?.focus({preventScroll:true});});}}>접기</button>}
  </div>
  <div className={s.actions}><button type="button" className="button" disabled={blocked||!!dragging||!dirty} onClick={()=>{const byId=new Map(rows.map(row=>[row.id,row]));setRows(baseline.map(id=>byId.get(id)!));setError('');}}>되돌리기</button><button type="button" className="button" disabled={blocked||!!dragging||!dirty} onClick={()=>void save()}>{busy?'저장 중…':'저장'}</button></div>
  </div>}
 </div>;
}
