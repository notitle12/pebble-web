"use client";
import {useEffect,useState,type ReactNode} from "react";
import {getPublicGarden} from '../api/stone-garden';
import type {Garden} from '../stone-garden';
import {StoneGarden} from './stone-garden';
function Stones({handle}:{handle:string}){
 const [garden,setGarden]=useState<Garden|null>(null),[error,setError]=useState(false),[attempt,setAttempt]=useState(0);
 useEffect(()=>{let live=true;setGarden(null);setError(false);getPublicGarden(handle).then(value=>{if(live)setGarden(value);}).catch(()=>{if(live)setError(true);});return()=>{live=false;};},[handle,attempt]);
 return <section className="blog-home-section blog-stones" aria-labelledby="blog-stones-title"><div className="blog-home-section-title"><h2 id="blog-stones-title">기록의 돌</h2>{garden&&<span>누적 글 {garden.publicationCount.toLocaleString()}개</span>}</div>{error?<p role="alert">기록의 돌을 불러오지 못했어요. <button type="button" onClick={()=>setAttempt(value=>value+1)}>다시 시도</button></p>:garden?<StoneGarden publicationCount={garden.publicationCount}/>:<p role="status">기록의 돌을 불러오고 있어요.</p>}</section>;
}
export function BlogActivityDisplay({handle,defaultDisplay="GRASS",grass}:{handle:string;defaultDisplay?:"GRASS"|"STONES";grass:ReactNode}){
 const [display,setDisplay]=useState(defaultDisplay);
 return <div><div className="blog-activity-switch" role="group" aria-label="블로그 활동 보기"><button type="button" aria-pressed={display==="GRASS"} onClick={()=>setDisplay("GRASS")}>잔디</button><button type="button" aria-pressed={display==="STONES"} onClick={()=>setDisplay("STONES")}>돌</button></div>{display==="GRASS"?grass:<Stones handle={handle}/>}</div>;
}
