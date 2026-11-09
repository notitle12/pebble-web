"use client";

import {useId,useRef,useState} from "react";
import {BlogFollowStats} from "./blog-subscriptions";
import {BlogVisitCount} from "./blog-visit-count";
import styles from "./blog-subscriptions.module.css";

const tabs = [{key:"visits",label:"방문자"},{key:"follows",label:"팔로우"}] as const;
type Tab = typeof tabs[number]["key"];

export function BlogSidebarStats({handle}:{handle:string}){
 const id=useId();
 const [active,setActive]=useState<Tab>("visits");
 const buttons=useRef<Partial<Record<Tab,HTMLButtonElement|null>>>({});
 return <>
  <div className={styles.sidebarTabs} role="tablist" aria-label="블로그 통계">
   {tabs.map(({key,label},index)=><button key={key} ref={node=>{buttons.current[key]=node;}} type="button" role="tab" id={`${id}-${key}`} aria-controls={`${id}-${key}-panel`} aria-selected={active===key} tabIndex={active===key?0:-1} onClick={()=>setActive(key)} onKeyDown={event=>{
    const next=event.key==="Home"?tabs[0]:event.key==="End"?tabs[1]:event.key==="ArrowLeft"||event.key==="ArrowRight"?tabs[1-index]:null;
    if(!next)return;
    event.preventDefault();setActive(next.key);buttons.current[next.key]?.focus();
   }}>{label}</button>)}
  </div>
  <div className={styles.sidebarPanel} role="tabpanel" id={`${id}-visits-panel`} aria-labelledby={`${id}-visits`} hidden={active!=="visits"} tabIndex={0}><BlogVisitCount handle={handle}/></div>
  <div className={styles.sidebarPanel} role="tabpanel" id={`${id}-follows-panel`} aria-labelledby={`${id}-follows`} hidden={active!=="follows"} tabIndex={0}><BlogFollowStats/></div>
 </>;
}
