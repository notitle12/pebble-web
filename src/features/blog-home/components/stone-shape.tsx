import {useId} from "react";
export function StoneShape({seed}:{seed:string;count?:number}){
 const id=useId().replace(/:/g,"");let hash=2166136261;for(const char of seed)hash=Math.imul(hash^char.charCodeAt(0),16777619)>>>0;
 let random=hash;const next=()=>{random=(Math.imul(random,1664525)+1013904223)>>>0;return random/4294967296;};
 const top=10+next()*12,left=7+next()*9,right=146+next()*8,peak=60+next()*35,base=85+next()*7;
 const path=`M ${left} 59 C ${left-5} ${31+next()*10} ${peak-28} ${top-2} ${peak} ${top} C ${peak+34} ${top-3} ${right-9} ${23+next()*14} ${right} 51 C ${right+6} 76 126 ${base+3} 83 ${base} C 47 ${base+2} ${left-5} 82 ${left} 59 Z`;
 const palette=[{h:119,s:13,l:61},{h:94,s:12,l:58},{h:38,s:20,l:68},{h:29,s:16,l:58},{h:45,s:12,l:73},{h:24,s:11,l:64},{h:110,s:8,l:68},{h:43,s:17,l:57}];
 const tone=palette[hash%palette.length],hue=tone.h+(hash>>>8)%7-3,saturation=tone.s,lightness=tone.l+(hash>>>16)%7-3;
 const specks=Array.from({length:20},(_,i)=>({x:20+next()*120,y:24+next()*56,r:.35+next()*.6,light:i%3===0}));
 return <svg viewBox={`0 ${top-1} 160 ${base-top+4}`} preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true" pointerEvents="none"><defs>
  <linearGradient id={`${id}-body`} x1=".25" y1="0" x2=".6" y2="1"><stop stopColor={`hsl(${hue} ${saturation}% ${lightness+13}%)`}/><stop offset=".52" stopColor={`hsl(${hue} ${saturation}% ${lightness}%)`}/><stop offset="1" stopColor={`hsl(${hue} ${saturation+3}% ${lightness-15}%)`}/></linearGradient>
  <radialGradient id={`${id}-light`} cx=".35" cy=".23" r=".65"><stop stopColor="#fff" stopOpacity=".3"/><stop offset="1" stopColor="#fff" stopOpacity="0"/></radialGradient>
  <clipPath id={`${id}-clip`}><path d={path}/></clipPath>
 </defs><ellipse cx="82" cy={base+1} rx="65" ry="4" fill="#2033230d"/><path d={path} fill={`url(#${id}-body)`}/><path d={path} fill={`url(#${id}-light)`}/><g clipPath={`url(#${id}-clip)`}>{specks.map((dot,index)=><circle key={index} cx={dot.x} cy={dot.y} r={dot.r} fill={dot.light?"#fff":"#233c2b"} opacity={dot.light?.16:.08}/>)}</g><path d={`M ${left+18} 68 C 52 ${base-5} 112 ${base-5} ${right-16} 65`} fill="none" stroke="#233c2b" strokeOpacity=".08" strokeWidth="1.5" strokeLinecap="round"/></svg>;
}
