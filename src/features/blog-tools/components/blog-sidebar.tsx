"use client";
import {useEffect,useState,type CSSProperties,type ReactNode} from "react";

export function BlogSidebar({children,footer}:{children:ReactNode;footer:ReactNode}){
  const [headerHeight,setHeaderHeight]=useState(84);
  useEffect(()=>{
    const header=document.querySelector(".site-header");
    if(!header)return;
    const measure=()=>setHeaderHeight(Math.ceil(header.getBoundingClientRect().height));
    measure();
    const observer=new ResizeObserver(measure);
    observer.observe(header);
    return ()=>observer.disconnect();
  },[]);
  return <aside className="personal-blog-profile" aria-label="블로그 정보" style={{"--blog-header-height":`${headerHeight}px`} as CSSProperties}>
    <div className="blog-sidebar-content">{children}</div>
    {footer}
  </aside>;
}
