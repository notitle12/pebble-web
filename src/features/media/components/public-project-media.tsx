"use client";
import {useRef,useState} from "react";
import {safeMediaUrl,type ProjectMedia} from "../model";
import {ProjectCoverImage} from "@/features/project/components/project-cover-image";

function orderedGallery(media:ProjectMedia[],coverId?:string|null){
  const rows=media.filter(item=>item.mediaRole==="THUMBNAIL"||item.mediaRole==="SCREENSHOT")
    .sort((a,b)=>a.displayOrder-b.displayOrder||(BigInt(a.id)<BigInt(b.id)?-1:1));
  const selected=coverId?rows.findIndex(item=>item.id===coverId):-1;
  const legacy=rows.findIndex(item=>item.mediaRole==="THUMBNAIL");
  return {rows,initial:selected>=0?selected:legacy>=0?legacy:0};
}

export function PublicProjectMedia({initial,coverId,fallbackUrl}:{id?:string;initial:ProjectMedia[];coverId?:string|null;fallbackUrl?:string|null}){
  const gallery=orderedGallery(initial,coverId);
  const [active,setActive]=useState(gallery.initial);
  const touchStart=useRef<{x:number;y:number}|null>(null);
  const rows=gallery.rows;
  if(!rows.length){const fallback=safeMediaUrl(fallbackUrl??null);return fallback?<section className="public-project-media" aria-label="프로젝트 이미지"><div className="public-project-media-viewer"><ProjectCoverImage src={fallback} alt="프로젝트 대표 이미지" className="public-project-media-image"/></div></section>:null;}
  const current=rows[Math.min(active,rows.length-1)];
  const src=safeMediaUrl(current.url)??(active===gallery.initial?safeMediaUrl(fallbackUrl??null):null);
  const move=(offset:number)=>setActive(index=>(index+offset+rows.length)%rows.length);
  return (
    <section className="public-project-media" aria-label="프로젝트 이미지">
      <div className="public-project-media-viewer" onTouchStart={event=>{const point=event.changedTouches[0];touchStart.current=point?{x:point.clientX,y:point.clientY}:null;}}
        onTouchCancel={()=>{touchStart.current=null;}}
        onTouchEnd={event=>{const start=touchStart.current,point=event.changedTouches[0];touchStart.current=null;if(!start||!point)return;const dx=point.clientX-start.x,dy=point.clientY-start.y;if(Math.abs(dx)>Math.max(40,Math.abs(dy)))move(dx<0?1:-1);}}>
        {src?<ProjectCoverImage src={src} alt={current.altText??"프로젝트 이미지"} className="public-project-media-image"/>:<p role="status">이미지를 표시할 수 없습니다.</p>}
        {rows.length>1&&<div className="public-project-media-controls">
          <button type="button" aria-label="이전 이미지" onClick={()=>move(-1)}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5 5.5 8l4.5 4.5"/></svg></button>
          <button type="button" aria-label="다음 이미지" onClick={()=>move(1)}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3.5 4.5 4.5L6 12.5"/></svg></button>
          <span aria-live="polite">{active+1} / {rows.length}</span>
        </div>}
      </div>
      {current.altText&&<p className="public-project-media-caption">{current.altText}</p>}
      {rows.length>1&&<div className="public-project-media-thumbnails" role="group" aria-label="이미지 선택">
        {rows.map((item,index)=>{const thumb=safeMediaUrl(item.thumbnailUrl??item.url);return <button key={item.id} type="button" aria-label={`이미지 ${index+1}`} aria-pressed={index===active} onClick={()=>setActive(index)}>
          {thumb?<img src={thumb} alt="" loading="lazy"/>:<span>{index+1}</span>}
        </button>;})}
      </div>}
    </section>
  );
}
