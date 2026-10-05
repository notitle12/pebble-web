"use client";
import {useEffect,useRef,useState} from "react";
import {getPublicProject} from "@/features/project/api/project-list";
import {safeMediaUrl,type ProjectMedia} from "../model";
export function PublicProjectMedia({id,initial}:{id:string;initial:ProjectMedia[]}){
 const [media,setMedia]=useState(initial),[busy,setBusy]=useState(false),[error,setError]=useState("");const mounted=useRef(false),lock=useRef(false);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 if(!media.length)return null;
 return <section className="public-project-media" aria-label="프로젝트 이미지"><div className="public-project-media-list">{[...media].sort((a,b)=>a.displayOrder-b.displayOrder||(BigInt(a.id)<BigInt(b.id)?-1:1)).map(item=>{const src=safeMediaUrl(item.url);return <figure key={item.id}>{src?<img src={src} alt={item.altText??(item.mediaRole==="THUMBNAIL"?"프로젝트 대표 이미지":"프로젝트 스크린샷")} loading="lazy"/>:<p>이미지를 표시할 수 없습니다.</p>}{item.altText&&<figcaption>{item.altText}</figcaption>}</figure>;})}</div><button className="button" disabled={busy} onClick={async()=>{
 if(lock.current)return;lock.current=true;setBusy(true);setError("");try{const project=await getPublicProject(id);if(mounted.current)setMedia(project.media);}catch{if(mounted.current)setError("이미지를 다시 불러오지 못했습니다. 공개 상태를 확인하거나 잠시 후 다시 시도해 주세요.");}finally{lock.current=false;if(mounted.current)setBusy(false);}
 }}>이미지 다시 불러오기</button>{error&&<p role="alert">{error}</p>}</section>;
}
