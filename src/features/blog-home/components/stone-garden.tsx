"use client";
import {useId,useState} from 'react';
import {gardenScene,type GardenStone,type GardenPlant} from '../stone-garden';
const atlas='/images/stone-garden/natural-parts.png';
const regions=['31 208 502 235','582 140 410 304','1070 292 434 141','88 782 399 103','543 495 490 465','1103 579 378 352','23 200 495 218','544 167 456 253','1029 278 485 133','34 624 449 260','525 668 481 212','1046 672 462 206'];
function Sprite({item,filter}:{item:GardenStone|GardenPlant;filter:string}){
 const flip=('flip' in item&&item.flip),y='count' in item?item.y-item.height/2:item.y-item.height;
 return <g transform={flip?`translate(${item.x*2} 0) scale(-1 1)`:undefined}><svg x={item.x-item.width/2} y={y} width={item.width} height={item.height} viewBox={regions[item.shape]} preserveAspectRatio="none" style={{width:item.width,height:item.height,overflow:"hidden"}}><image href={item.shape>=6?"/images/stone-garden/stone-varieties.png":atlas} width="1536" height="1024" filter={`url(#${filter})`}/></svg></g>;
}
export function StoneGarden({publicationCount}:{publicationCount:number}){
 const id=useId().replace(/:/g,''),scene=gardenScene(publicationCount),[hover,setHover]=useState<{text:string;x:number;y:number}|null>(null);
 function show(stone:GardenStone,x:number,y:number){setHover({text:`글 ${stone.count.toLocaleString()}개`,x,y});}
 return <div className="growing-garden natural-garden"><svg viewBox="180 0 640 245" role="group" aria-label={`누적 글 ${publicationCount}개로 자란 기록의 돌 정원`}>
 <defs><filter id={`${id}-cutout`} colorInterpolationFilters="sRGB"><feComponentTransfer><feFuncA type="linear" slope="1.4" intercept="-.4"/></feComponentTransfer></filter></defs>
 {publicationCount>0&&<g opacity=".75"><ellipse cx="498" cy="227" rx={scene.groundWidth/2} ry={Math.min(13,3+scene.groundWidth*.025)} fill="#ece1c6"/><ellipse cx="510" cy="230" rx={scene.groundWidth*.42} ry={Math.min(8,2+scene.groundWidth*.015)} fill="#f3ead5"/></g>}
 {scene.plants.filter(p=>p.shape===4).map(plant=><g key={plant.id} className="garden-foliage"><Sprite item={plant} filter={`${id}-cutout`}/></g>)}
 {scene.stones.map(stone=><g key={stone.id} role="img" tabIndex={0} className="garden-natural-stone" aria-label={`글 ${stone.count}개의 기록`} onPointerEnter={event=>show(stone,event.clientX,event.clientY)} onPointerMove={event=>show(stone,event.clientX,event.clientY)} onPointerLeave={()=>setHover(null)} onFocus={event=>{const b=event.currentTarget.getBoundingClientRect();show(stone,b.x+b.width/2,b.y+b.height/2);}} onBlur={()=>setHover(null)}><Sprite item={stone} filter={`${id}-cutout`}/></g>)}
 {scene.plants.filter(p=>p.shape===5).map(plant=><g key={plant.id} className="garden-foliage"><Sprite item={plant} filter={`${id}-cutout`}/></g>)}
 {publicationCount===0&&<text x="500" y="152" textAnchor="middle" fill="var(--muted)" fontSize="13">첫 글이 작은 풍경의 시작이 돼요.</text>}
 </svg>{hover&&<div className="stone-view-tooltip" role="tooltip" style={{left:Math.max(8,Math.min(window.innerWidth-140,hover.x+12)),top:Math.max(8,Math.min(window.innerHeight-40,hover.y+14))}}>{hover.text}</div>}</div>;
}
