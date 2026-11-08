"use client";
import {useEffect,useId,useRef,useState,type KeyboardEvent,type PointerEvent} from "react";
import Link from "next/link";
import type {OwnPostPage} from "../api/member-posts";
import {seriesPostDropOrder} from "../series-post-order";
import s from "./my-series.module.css";

type Drag={source:number;insertion:number;rank:number|null;x:number;y:number;startY:number;mode:"pointer"|"keyboard";active:boolean;valid:boolean};
type Props={posts:OwnPostPage;disabled:boolean;membershipDisabled?:boolean;onMove:(id:string,rank:number)=>void;onRelease:(id:string)=>void};
export function SeriesPostList({posts,disabled,membershipDisabled=disabled,onMove,onRelease}:Props){
 const root=useRef<HTMLDivElement>(null),drag=useRef<Drag|null>(null),frame=useRef<number|null>(null),restoreFocus=useRef<string|null>(null),help=useId();
 const [preview,setPreview]=useState<{source:number;insertion:number;rank:number|null}|null>(null);
 const offset=posts.page*20;
 function cancel(){drag.current=null;if(frame.current!==null)cancelAnimationFrame(frame.current);frame.current=null;setPreview(null);}
 useEffect(()=>{if(disabled)cancel();},[disabled]);
 useEffect(()=>{if(!disabled&&restoreFocus.current){root.current?.querySelector<HTMLButtonElement>(`[data-series-post-id="${restoreFocus.current}"] [data-series-handle]`)?.focus({preventScroll:true});restoreFocus.current=null;}},[disabled,posts]);
 useEffect(()=>()=>{if(frame.current!==null)cancelAnimationFrame(frame.current);},[]);
 function show(d:Drag){setPreview(old=>old?.source===d.source&&old.insertion===d.insertion&&old.rank===d.rank?old:{source:d.source,insertion:d.insertion,rank:d.rank});}
 function hit(d:Drag){
  const node=document.elementFromPoint(d.x,d.y)?.closest<HTMLElement>("[data-series-index],[data-series-rank]");
  d.valid=!!node&&!!root.current?.contains(node);
  if(!d.valid||!node){setPreview(null);return;}
  if(node.dataset.seriesRank!==undefined){d.insertion=-1;d.rank=Number(node.dataset.seriesRank);}
  else{const rect=node.getBoundingClientRect();d.insertion=Number(node.dataset.seriesIndex)+(d.y>rect.top+rect.height/2?1:0);d.rank=seriesPostDropOrder(d.source,d.insertion,posts.page,posts.content.length,posts.totalElements);}
  show(d);
 }
 function tick(){const d=drag.current;if(!d?.active||d.mode!=="pointer")return;const delta=d.y<64?-10:d.y>window.innerHeight-64?10:0;if(delta)window.scrollBy(0,delta);hit(d);frame.current=requestAnimationFrame(tick);}
 function start(event:PointerEvent<HTMLLIElement>,source:number){
  if(disabled||event.button!==0||drag.current)return;
  const handle=(event.target as Element).closest("[data-series-handle]");
  if(!handle&&((event.target as Element).closest("button,a,input")||event.pointerType==="touch"))return;
  event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);
  drag.current={source,insertion:source,rank:null,x:event.clientX,y:event.clientY,startY:event.clientY,mode:"pointer",active:false,valid:false};
 }
 function move(event:PointerEvent<HTMLLIElement>){const d=drag.current;if(!d||d.mode!=="pointer")return;d.x=event.clientX;d.y=event.clientY;if(!d.active&&Math.abs(d.y-d.startY)>=4){d.active=true;frame.current=requestAnimationFrame(tick);}if(d.active){event.preventDefault();hit(d);}}
 function commit(){const d=drag.current;cancel();if(d?.active&&d.valid&&d.rank!==null&&d.rank!==offset+d.source&&d.rank>=0&&d.rank<posts.totalElements){if(d.mode==="keyboard")restoreFocus.current=posts.content[d.source].id;onMove(posts.content[d.source].id,d.rank);}}
 function key(event:KeyboardEvent<HTMLButtonElement>,source:number){
  if(disabled)return;
  if(event.key==="Escape"){if(drag.current){event.preventDefault();event.stopPropagation();cancel();}return;}
  if(event.key===" "||event.key==="Enter"){
   event.preventDefault();if(drag.current?.mode==="keyboard"){commit();return;}
   drag.current={source,insertion:source,rank:offset+source,x:0,y:0,startY:0,mode:"keyboard",active:true,valid:true};show(drag.current);
  }else if(drag.current?.mode==="keyboard"&&["ArrowUp","ArrowDown"].includes(event.key)){
   event.preventDefault();const d=drag.current;d.rank=Math.max(0,Math.min(posts.totalElements-1,(d.rank??offset+source)+(event.key==="ArrowUp"?-1:1)));const local=d.rank-offset;d.insertion=local<0||local>=posts.content.length?-1:local>d.source?local+1:local;show(d);
  }else if(event.key==="Tab")cancel();
 }
 return <div ref={root} onKeyDown={event=>{if(event.key==="Escape"&&drag.current){event.preventDefault();cancel();}}}>
  <p id={help} className={s.srOnly}>손잡이를 드래그해 순서를 편집한 뒤 상단 저장 버튼을 누르세요. 키보드는 Space로 잡고 방향키로 이동한 뒤 Enter로 놓습니다. Escape는 취소합니다.</p>
  <span role="status" className={s.srOnly}>{preview?`${(preview.rank??offset+preview.source)+1}번째 위치`:""}</span>
  {posts.hasPrevious&&<div className={s.pageDrop} data-series-rank={offset-1} data-active={preview?.rank===offset-1}>이전 페이지 끝에 놓기</div>}
  <ol className={s.postList} aria-label="시리즈 글 순서" start={offset+1} aria-busy={disabled}>{posts.content.map((post,index)=><li key={post.id} className={s.postRow} data-series-index={index} data-series-post-id={post.id} data-dragging={preview?.source===index} data-drop={preview?.insertion===index?"before":preview?.insertion===posts.content.length&&index===posts.content.length-1?"after":undefined}
   onPointerDown={event=>start(event,index)} onPointerMove={move} onPointerUp={event=>{if(drag.current?.mode!=="pointer")return;move(event);commit();if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}} onPointerCancel={cancel} onLostPointerCapture={()=>{if(drag.current?.mode==="pointer")cancel();}} onDragStart={event=>event.preventDefault()}>
   <button type="button" data-series-handle className={s.dragHandle} disabled={disabled} aria-label={`${post.title} 순서 이동`} aria-describedby={help} aria-pressed={preview?.source===index} onKeyDown={event=>key(event,index)} onBlur={()=>{if(drag.current?.mode==="keyboard")cancel();}}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5h.01M13 5h.01M7 10h.01M13 10h.01M7 15h.01M13 15h.01"/></svg></button>
   <span className={s.order} aria-hidden="true">{offset+index+1}</span><div className={s.postContent}><Link className={s.postTitle} href={post.visibilityStatus==="PUBLIC"&&!post.isBlocked&&!post.draft?`/blogs/${post.author.handle}/posts/${post.urlKey}`:`/posts/${post.id}/view`}>{post.title}</Link><span className={s.postMeta}>{post.draft?"임시저장":post.visibilityStatus==="HIDDEN"?"비공개":"공개"}{post.isBlocked?" · 차단됨":""}</span></div>
   <button type="button" className={s.removeButton} disabled={membershipDisabled} title="시리즈에서 빼기" aria-label={`${post.title} 시리즈에서 해제`} onClick={()=>onRelease(post.id)}><svg aria-hidden="true" viewBox="0 0 20 20"><path d="m6 6 8 8m0-8-8 8"/></svg></button>
  </li>)}</ol>
  {posts.hasNext&&<div className={s.pageDrop} data-series-rank={offset+posts.content.length} data-active={preview?.rank===offset+posts.content.length}>다음 페이지 처음에 놓기</div>}
 </div>;
}
