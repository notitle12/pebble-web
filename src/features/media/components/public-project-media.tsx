"use client";
import {safeMediaUrl,type ProjectMedia} from "../model";

export function PublicProjectMedia({id:_id,initial}:{id?:string;initial:ProjectMedia[]}){
  const media=initial.filter(item=>item.mediaRole==="SCREENSHOT");
  if(!media.length)return null;
  return (
    <section className="public-project-media" aria-label="프로젝트 이미지">
      <div className="public-project-media-list">
        {[...media]
          .sort((a,b)=>a.displayOrder-b.displayOrder||(BigInt(a.id)<BigInt(b.id)?-1:1))
          .map(item=>{
            const src=safeMediaUrl(item.url);
            return (
              <figure key={item.id}>
                {src?<img src={src} alt={item.altText??"프로젝트 스크린샷"} loading="lazy"/>:<p>이미지를 표시할 수 없습니다.</p>}
                {item.altText&&<figcaption>{item.altText}</figcaption>}
              </figure>
            );
          })}
      </div>
    </section>
  );
}
