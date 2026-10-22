'use client';
import {useEffect,useId,useRef,useState,type KeyboardEvent,type PointerEvent} from 'react';
import {userSession} from '@/features/auth/user-session';
import {MemberApiError} from '@/lib/member-api';
import {getProjectOrderPosts,moveProjectPost,projectPostDropTarget,type ProjectOrderPage} from '../api/project-post-order';
import s from './project-post-order.module.css';
type Drag={index:number;source:number;insertion:number;mode:'pointer'|'keyboard';x:number;y:number;startY:number;active:boolean};
type Props={projectId:string;memberId:string;disabled?:boolean;onSaved?:()=>void;onBusyChange?:(busy:boolean)=>void};
export function ProjectPostOrder({projectId,memberId,disabled=false,onSaved,onBusyChange}:Props){
 const help=useId(),root=useRef<HTMLDivElement>(null);
 const [data,setData]=useState<ProjectOrderPage|null>(null),[page,setPage]=useState(0),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[uncertain,setUncertain]=useState(false),[attempt,setAttempt]=useState(0);
 const [dragging,setDragging]=useState<{source:number;insertion:number}|null>(null);
 const drag=useRef<Drag|null>(null),frame=useRef<number|null>(null);
 const mounted=useRef(false),lock=useRef(false),generation=useRef(0);
 const current=()=>mounted.current&&userSession.snapshot().phase==='ready'&&userSession.snapshot().member?.id===memberId;
 function cancelDrag(){drag.current=null;if(frame.current!==null)cancelAnimationFrame(frame.current);frame.current=null;setDragging(null);}
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;generation.current++;if(frame.current!==null)cancelAnimationFrame(frame.current);};},[]);
 useEffect(()=>{if(disabled)cancelDrag();},[disabled]);
 const interacting=busy||dragging!==null;
 useEffect(()=>{onBusyChange?.(interacting);return()=>onBusyChange?.(false);},[interacting,onBusyChange]);
 async function load(target:number){
  const epoch=++generation.current;setLoading(true);setError('');
  try{
   let result=await getProjectOrderPosts(projectId,target,memberId,(path,options)=>userSession.request(path,options));
   if(!current()||epoch!==generation.current)return;
   if(!result.content.length&&target>0){target=Math.max(0,result.totalPages-1);result=await getProjectOrderPosts(projectId,target,memberId,(path,options)=>userSession.request(path,options));}
   if(!current()||epoch!==generation.current)return;
   setData(result);setPage(target);setUncertain(false);return result;
  }catch(e){if(current()&&epoch===generation.current){setData(null);setError(e instanceof MemberApiError&&e.status===404?'프로젝트가 없거나 본인 프로젝트가 아니에요.':'관련 게시글을 불러오지 못했어요. 다시 불러와 주세요.');}throw e;}
  finally{if(mounted.current&&epoch===generation.current)setLoading(false);}
 }
 useEffect(()=>{cancelDrag();void load(page).catch(()=>{});return()=>{generation.current++;};},[projectId,memberId,page,attempt]); // eslint-disable-line react-hooks/exhaustive-deps
 async function move(index:number,target:number){
  if(!data||disabled||loading||lock.current||uncertain||!current())return;
  const post=data.content[index];if(!post)return;
  lock.current=true;setBusy(true);setError('');setNotice('');let saved=false;
  try{
   await moveProjectPost(projectId,post.id,target,(path,options)=>userSession.request(path,options));saved=true;
   if(!current())return;
   onSaved?.();
   await load(page);
   if(current())setNotice(`‘${post.title}’을 ${target+1}번째로 옮겼어요.`);
  }catch(e){if(current()){
   const unknown=saved||!(e instanceof MemberApiError)||e.status===0||e.status>=500;setUncertain(unknown);
   setError(unknown?'저장 결과를 확인하려면 목록을 다시 불러와 주세요.':e instanceof Error?e.message:'순서를 변경하지 못했어요.');
  }}finally{lock.current=false;if(mounted.current)setBusy(false);}
 }
 function commitDrag(){const d=drag.current;cancelDrag();if(!d?.active||!data)return;const target=projectPostDropTarget(d.source,d.insertion,data.totalElements);if(target!==null)void move(d.index,target);}
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
 function pointerDown(event:PointerEvent<HTMLButtonElement>,index:number){
  if(blocked||event.button!==0||drag.current||!data)return;
  event.preventDefault();event.currentTarget.focus({preventScroll:true});event.currentTarget.setPointerCapture(event.pointerId);
  const source=page*data.size+index;drag.current={index,source,insertion:source,mode:'pointer',x:event.clientX,y:event.clientY,startY:event.clientY,active:false};
 }
 function pointerMove(event:PointerEvent<HTMLButtonElement>){
  const d=drag.current;if(!d||d.mode!=='pointer')return;event.preventDefault();d.x=event.clientX;d.y=event.clientY;
  if(!d.active&&Math.abs(d.y-d.startY)>=4){d.active=true;setNotice('');showDrag(d);frame.current=requestAnimationFrame(tick);}
  if(d.active)hitTest(d);
 }
 function keyDown(event:KeyboardEvent<HTMLButtonElement>,index:number){
  if(blocked||!data)return;
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();cancelDrag();return;}
  const source=page*data.size+index;
  if(event.key===' '||event.key==='Enter'){
   event.preventDefault();event.stopPropagation();
   if(drag.current?.mode==='keyboard'){commitDrag();return;}
   drag.current={index,source,insertion:source,mode:'keyboard',x:0,y:0,startY:0,active:true};showDrag(drag.current);setNotice('방향키로 이동한 뒤 Enter로 저장하거나 Esc로 취소하세요.');
  }else if(drag.current?.mode==='keyboard'&&['ArrowUp','ArrowDown'].includes(event.key)){
   event.preventDefault();const d=drag.current;const target=projectPostDropTarget(d.source,d.insertion,data.totalElements)??d.source;
   const next=Math.max(0,Math.min(data.totalElements-1,target+(event.key==='ArrowUp'?-1:1)));
   d.insertion=next>d.source?next+1:next;showDrag(d);setNotice(`${next+1}번째 위치. Enter로 저장하거나 Esc로 취소하세요.`);
  }else if(event.key==='Tab'&&drag.current?.mode==='keyboard')cancelDrag();
 }
 const blocked=disabled||busy||loading||uncertain;
 return <div ref={root} className={s.section} aria-busy={loading||busy} onKeyDown={event=>{if(event.key==='Escape'&&drag.current){event.preventDefault();event.stopPropagation();cancelDrag();}}}>
  <p id={help} className={s.help}>왼쪽 손잡이를 드래그해 읽을 순서를 정해 주세요. 놓으면 바로 저장됩니다. 키보드는 손잡이에서 Space → 방향키 → Enter로 이동할 수 있어요.</p>
  <p className={s.meta}>{data?`총 ${data.totalElements}개 · `:''}비공개·차단 글은 공개 목록에 표시되지 않습니다.</p>
  {error&&<p className={s.message} role="alert">{error}</p>}
  {(error||uncertain)&&<button type="button" className="button" disabled={disabled||busy||loading} onClick={()=>{setNotice('');setAttempt(n=>n+1);}}>목록 다시 불러오기</button>}
  <p className={s.message} role="status">{busy?'순서를 저장하고 있어요.':notice}</p>
  {loading?<p role="status">관련 게시글을 불러오고 있어요.</p>:data&&!data.content.length?<p>아직 연결된 게시글이 없어요. 게시글 발행 설정에서 이 프로젝트를 연결할 수 있어요.</p>:data&&<>
   {data.hasPrevious&&<div data-order-gap={page*data.size-1} className={`${s.pageDrop} ${dragging?.insertion===page*data.size-1?s.dropBefore:''}`}>이전 페이지 마지막으로 옮기려면 여기에 놓으세요</div>}
   <ol className={s.list} start={page*data.size+1} aria-label="관련 게시글 표시 순서">{data.content.map((post,index)=>{
    const position=page*data.size+index;
    return <li key={post.id} data-order-index={position} className={`${s.row} ${dragging?.source===position?s.dragging:''} ${dragging?.insertion===position?s.dropBefore:''} ${dragging?.insertion===position+1&&index===data.content.length-1?s.dropAfter:''}`}>
     <button type="button" className={s.handle} disabled={blocked} aria-label={`${post.title}: 순서 이동`} aria-describedby={help} aria-pressed={dragging?.source===position} onKeyDown={event=>keyDown(event,index)} onPointerDown={event=>pointerDown(event,index)} onPointerMove={pointerMove} onPointerUp={event=>{if(drag.current?.mode!=='pointer')return;pointerMove(event);if(drag.current?.active&&hitTest(drag.current))commitDrag();else cancelDrag();if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}} onPointerCancel={cancelDrag} onLostPointerCapture={()=>{if(drag.current?.mode==='pointer')cancelDrag();}} onDragStart={event=>event.preventDefault()}><span aria-hidden="true">⠿</span></button>
     <span className={s.number} aria-hidden="true">{position+1}</span><div className={s.content}><span className={s.title}>{post.title}</span><span className={s.status}>{post.visibilityStatus==='HIDDEN'?'비공개':'공개'}{post.isBlocked?' · 차단':''}{post.draft?' · 임시 글':''}</span></div>
    </li>;
   })}</ol>
   {data.hasNext&&<div data-order-gap={(page+1)*data.size+1} className={`${s.pageDrop} ${dragging?.insertion===(page+1)*data.size+1?s.dropBefore:''}`}>다음 페이지 처음으로 옮기려면 여기에 놓으세요</div>}
  </>}
  {data&&data.totalPages>1&&<nav className={s.pagination} aria-label="관련 게시글 순서 페이지"><button type="button" className="button" disabled={blocked||dragging!==null||!data.hasPrevious} onClick={()=>{setData(null);setNotice('');setPage(n=>n-1);}}>이전</button><span>{page+1} / {data.totalPages}</span><button type="button" className="button" disabled={blocked||dragging!==null||!data.hasNext} onClick={()=>{setData(null);setNotice('');setPage(n=>n+1);}}>다음</button></nav>}
 </div>;
}
