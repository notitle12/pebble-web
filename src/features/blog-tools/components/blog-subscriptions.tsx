"use client";
import Link from "next/link";
import {createContext,useContext,useEffect,useId,useRef,useState,type ReactNode} from "react";
import {safeMediaUrl} from "@/features/media/model";
import {useUserSession} from "@/features/auth/components/member-gate";
import {openLoginDialog} from "@/features/auth/components/login-dialog";
import {userSession} from "@/features/auth/user-session";
import type {PublicBlogProfile} from "@/features/post/api/public-blog";
import {followPath,parseFollowPage,parseFollowState,followsPath,type FollowIdentity,type FollowPage} from "../api/blog-follows";
import styles from "./blog-subscriptions.module.css";

type FollowCountsContext = {profile:PublicBlogProfile;count:number;setCount:(value:number)=>void};
const FollowCounts = createContext<FollowCountsContext | null>(null);

export function BlogFollowCountsProvider({profile,children}:{profile:PublicBlogProfile;children:ReactNode}){
 const [count,setCount]=useState<number|null>(null);
 return <FollowCounts.Provider value={{profile,count:count??profile.followerCount,setCount}}>{children}</FollowCounts.Provider>;
}

function useFollowCounts(){
 const value=useContext(FollowCounts);
 if(!value)throw new Error("BlogFollowCountsProvider is missing");
 return value;
}

export function BlogSubscriptionButton(){
 const {profile,setCount}=useFollowCounts();
 const session=useUserSession();
 if(session.phase==="ready"&&session.member?.id===profile.id)return null;
 return <SubscriptionButton key={`${profile.handle}:${session.member?.id??session.phase}`} handle={profile.handle} setCount={setCount} session={session}/>;
}

function SubscriptionButton({handle,setCount,session}:{handle:string;setCount:(value:number)=>void;session:ReturnType<typeof useUserSession>}){
 const [state,setState]=useState<boolean|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const [statusAttempt,setStatusAttempt]=useState(0);
 const writing=useRef(false);
 useEffect(()=>{
  if(session.phase!=="ready")return;
  let live=true;setState(null);setError("");
  void userSession.request(followPath(handle)).then(raw=>{const next=parseFollowState(raw);if(live){setState(next.following);setCount(next.followerCount);}}).catch(e=>{if(live){setState(null);setError(e instanceof Error?e.message:"구독 상태를 불러오지 못했습니다.");}});
  return()=>{live=false;};
 },[handle,session.phase,setCount,statusAttempt]);
 function currentMember(id:string){const current=userSession.snapshot();return current.phase==="ready"&&current.member?.id===id;}
 async function toggle(){
  if(session.phase!=="ready"||!session.member)return;
  if(writing.current||state===null)return;
  const memberId=session.member.id,nextFollowing=!state;writing.current=true;setBusy(true);setError("");
  try{
   const raw=await userSession.request(followPath(handle),{method:nextFollowing?"PUT":"DELETE"});
   const next=parseFollowState(raw);if(currentMember(memberId)){setState(next.following);setCount(next.followerCount);}
  }catch(e){if(currentMember(memberId)){setError(e instanceof Error?e.message:"구독 상태를 저장하지 못했습니다.");}}
  finally{writing.current=false;setBusy(false);}
 }
 const following=session.phase==="ready"&&state===true;
 const label=following?"블로그 구독 취소":"블로그 구독하기";
 return <>
  <button type="button" className={styles.followButton} aria-label={label} title={label} aria-pressed={following}
   disabled={session.phase==="loading"||session.phase==="error"||session.phase==="ready"&&(busy||state===null)}
   onClick={()=>{if(session.phase!=="ready"){openLoginDialog();return;}void toggle();}}>
   <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 2.5h10a1 1 0 0 1 1 1v18l-6-3.75-6 3.75v-18a1 1 0 0 1 1-1Z" fill={following?"currentColor":"none"} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>
  </button>
  {session.phase==="ready"&&error&&<span className={styles.error} role="alert">{error}<button type="button" onClick={()=>setStatusAttempt(value=>value+1)}>다시 시도</button></span>}
 </>;
}

export function BlogFollowStats(){
 const {profile,count}=useFollowCounts();
 const session=useUserSession();
 const owner=session.phase==="ready"&&session.member?.id===profile.id;
 return <FollowCountsPanel key={owner?profile.id:"public"} owner={owner} count={count} followingCount={profile.followingCount}/>;
}

function FollowCountsPanel({owner,count,followingCount}:{owner:boolean;count:number;followingCount:number}){
 const [dialogOpen,setDialogOpen]=useState(false),[direction,setDirection]=useState<"followers"|"following">("followers");
 const [page,setPage]=useState<FollowPage|null>(null),[pageLoading,setPageLoading]=useState(false),[pageError,setPageError]=useState(""),[pageIndex,setPageIndex]=useState(0),[attempt,setAttempt]=useState(0);
 const dialog=useRef<HTMLDialogElement>(null),followersTab=useRef<HTMLButtonElement>(null),followingTab=useRef<HTMLButtonElement>(null),titleId=useId(),tabsId=useId();
 useEffect(()=>{const node=dialog.current;if(dialogOpen&&!node?.open)node?.showModal();else if(!dialogOpen&&node?.open)node.close();},[dialogOpen]);
 useEffect(()=>{
  if(!dialogOpen||!owner)return;
  let live=true;setPageLoading(true);setPageError("");setPage(null);
  void userSession.request(followsPath(direction,pageIndex)).then(raw=>{const next=parseFollowPage(raw,pageIndex);if(live)setPage(next);}).catch(e=>{if(live)setPageError(e instanceof Error?e.message:"목록을 불러오지 못했습니다.");}).finally(()=>{if(live)setPageLoading(false);});
  return()=>{live=false;};
 },[dialogOpen,owner,direction,pageIndex,attempt]);
 function selectList(next:"followers"|"following"){setDirection(next);setPageIndex(0);}
 function openList(next:"followers"|"following"){selectList(next);setAttempt(v=>v+1);setDialogOpen(true);}
 const rows:FollowIdentity[]=page?.content??[];
 return <>
  <dl className={styles.counts} aria-label="팔로우 통계">
   <div><dt>팔로워</dt><dd>{owner?<button type="button" aria-label={`팔로워 ${count}명 목록`} onClick={()=>openList("followers")}>{count.toLocaleString("ko-KR")}</button>:count.toLocaleString("ko-KR")}</dd></div>
   <div><dt>팔로잉</dt><dd>{owner?<button type="button" aria-label={`팔로잉 ${followingCount}명 목록`} onClick={()=>openList("following")}>{followingCount.toLocaleString("ko-KR")}</button>:followingCount.toLocaleString("ko-KR")}</dd></div>
  </dl>
  {owner&&<dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId} onCancel={event=>{event.preventDefault();setDialogOpen(false);}} onClose={()=>setDialogOpen(false)} onClick={event=>{if(event.target===event.currentTarget)setDialogOpen(false);}}>
   <header className={styles.dialogHeader}><h2 id={titleId}>내 블로그 구독</h2><button type="button" aria-label="구독 목록 닫기" onClick={()=>setDialogOpen(false)}>×</button></header>
   <div className={styles.tabs} role="tablist" aria-label="구독 목록 종류" id={tabsId}>
    <button ref={followersTab} type="button" role="tab" id={`${tabsId}-followers`} aria-selected={direction==="followers"} aria-controls={`${tabsId}-panel`} tabIndex={direction==="followers"?0:-1} onKeyDown={event=>{if(event.key==="ArrowRight"){event.preventDefault();selectList("following");followingTab.current?.focus();}}} onClick={()=>selectList("followers")}>팔로워 <span>{count}</span></button>
    <button ref={followingTab} type="button" role="tab" id={`${tabsId}-following`} aria-selected={direction==="following"} aria-controls={`${tabsId}-panel`} tabIndex={direction==="following"?0:-1} onKeyDown={event=>{if(event.key==="ArrowLeft"){event.preventDefault();selectList("followers");followersTab.current?.focus();}}} onClick={()=>selectList("following")}>팔로잉 <span>{followingCount}</span></button>
   </div>
   <section role="tabpanel" id={`${tabsId}-panel`} aria-labelledby={`${tabsId}-${direction}`} className={styles.list}>
    {direction==="followers"&&<p className={styles.listHint}>서로 구독하는 사람만 표시돼요.</p>}
    {pageLoading?<p className={styles.state} role="status">목록을 불러오는 중…</p>:pageError?<div className={styles.state} role="alert"><p>{pageError}</p><button type="button" onClick={()=>setAttempt(v=>v+1)}>다시 시도</button></div>:rows.length===0?<p className={styles.state}>{direction==="followers"?"아직 맞팔한 팔로워가 없어요.":"아직 구독한 블로그가 없어요."}</p>:<ul>{rows.map(person=>{const image=safeMediaUrl(person.profileImageUrl);return <li key={person.handle}><Link href={`/blogs/${encodeURIComponent(person.handle)}`} onClick={()=>setDialogOpen(false)}>{image?<img src={image} alt="" width={40} height={40}/>:<span className={styles.avatar} aria-hidden="true">{Array.from(person.nickname)[0]}</span>}<span>{person.nickname}<small>@{person.handle}</small></span></Link></li>;})}</ul>}
   </section>
   {!!page&&page.totalPages>1&&<nav className={styles.pagination} aria-label="구독 목록 페이지"><button type="button" disabled={page.first||pageLoading} onClick={()=>setPageIndex(v=>Math.max(0,v-1))}>이전</button><span>{page.page+1} / {page.totalPages}</span><button type="button" disabled={page.last||pageLoading} onClick={()=>setPageIndex(v=>v+1)}>다음</button></nav>}
  </dialog>}
 </>;
}
