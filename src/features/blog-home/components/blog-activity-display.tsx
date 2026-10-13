"use client";
import {useEffect,useRef,useState,type ReactNode} from "react";
import {getPublicStones} from "../api/blog-stones";
import type {StoneView} from "../stones";
import {StoneScene} from "./stone-scene";
function Stones({handle}:{handle:string}){
 const [view,setView]=useState<StoneView|null>(null),[error,setError]=useState(false),[attempt,setAttempt]=useState(0),[year,setYear]=useState("all"),[month,setMonth]=useState("all");const frame=useRef<HTMLDivElement>(null);
 useEffect(()=>{let live=true;setError(false);setView(null);getPublicStones(handle).then(value=>{if(live)setView(value);}).catch(()=>{if(live)setError(true);});return()=>{live=false;};},[handle,attempt]);
 useEffect(()=>{const element=frame.current;if(element)element.scrollLeft=(element.scrollWidth-element.clientWidth)/2;},[view]);
 const dates=(view?.posts??[]).map(post=>({post,date:new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit"}).format(new Date(post.publishedAt))}));
 const years=Array.from(new Set(dates.map(item=>item.date.slice(0,4)))).sort().reverse();const filtered=new Set(dates.filter(item=>(year==="all"||item.date.slice(0,4)===year)&&(month==="all"||item.date.slice(5,7)===month)).map(item=>item.post.id));
 return <section className="blog-home-section blog-stones" aria-labelledby="blog-stones-title"><div className="blog-home-section-title"><h2 id="blog-stones-title">기록의 돌</h2><div className="stone-date-filter"><select aria-label="돌 기록 연도" value={year} onChange={event=>setYear(event.target.value)}><option value="all">모든 연도</option>{years.map(y=><option key={y}>{y}</option>)}</select><select aria-label="돌 기록 월" value={month} onChange={event=>setMonth(event.target.value)}><option value="all">모든 달</option>{Array.from({length:12},(_,index)=><option key={index} value={String(index+1).padStart(2,"0")}>{index+1}월</option>)}</select></div></div>
  {error?<p role="alert">돌을 불러오지 못했어요. <button type="button" onClick={()=>setAttempt(value=>value+1)}>다시 시도</button></p>:view===null?<p role="status">돌을 불러오고 있어요.</p>:!view.stones.length?<p className="blog-home-empty">아직 쌓아둔 돌이 없어요.</p>:<><div ref={frame} className="stone-frame"><StoneScene stones={view.stones} highlight={year!=="all"||month!=="all"?filtered:undefined}/></div></>}
 </section>;
}
export function BlogActivityDisplay({handle,defaultDisplay="GRASS",grass}:{handle:string;defaultDisplay?:"GRASS"|"STONES";grass:ReactNode}){
 const [display,setDisplay]=useState(defaultDisplay);
 return <div><div className="blog-activity-switch" role="group" aria-label="블로그 활동 보기"><button type="button" aria-pressed={display==="GRASS"} onClick={()=>setDisplay("GRASS")}>잔디</button><button type="button" aria-pressed={display==="STONES"} onClick={()=>setDisplay("STONES")}>돌</button></div>{display==="GRASS"?grass:<Stones handle={handle}/>}</div>;
}
