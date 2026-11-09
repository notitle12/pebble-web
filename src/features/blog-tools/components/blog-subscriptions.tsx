"use client";
import Link from "next/link";
import {useEffect,useId,useRef,useState} from "react";
import {safeMediaUrl} from "@/features/media/model";
import {useUserSession} from "@/features/auth/components/member-gate";
import {openLoginDialog} from "@/features/auth/components/login-dialog";
import {userSession} from "@/features/auth/user-session";
import type {PublicBlogProfile} from "@/features/post/api/public-blog";
import {followPath,parseFollowPage,parseFollowState,followsPath,type FollowIdentity,type FollowPage} from "../api/blog-follows";
import styles from "./blog-subscriptions.module.css";

export function BlogSubscriptions({profile}:{profile:PublicBlogProfile}){
 const session=useUserSession();
 const owner=session.phase==="ready"&&session.member?.id===profile.id;
 const scope=owner?`owner:${session.member!.id}`:session.phase==="ready"?`member:${session.member?.id}`:session.phase;
 return <SubscriptionControls key={`${profile.handle}:${scope}`} profile={profile} owner={owner} />;
}
function SubscriptionControls({profile,owner}:{profile:PublicBlogProfile;owner:boolean}){
 const session=useUserSession();
 const [state,setState]=useState<{following:boolean;followerCount:number}|null>(null);
 const [loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const [statusAttempt,setStatusAttempt]=useState(0);
 const [dialogOpen,setDialogOpen]=useState(false),[direction,setDirection]=useState<"followers"|"following">("followers");
 const [page,setPage]=useState<FollowPage|null>(null),[pageLoading,setPageLoading]=useState(false),[pageError,setPageError]=useState(""),[pageIndex,setPageIndex]=useState(0),[attempt,setAttempt]=useState(0);
 const dialog=useRef<HTMLDialogElement>(null),followersTab=useRef<HTMLButtonElement>(null),followingTab=useRef<HTMLButtonElement>(null),writing=useRef(false),titleId=useId(),tabsId=useId();
 const followingCount=profile.followingCount;
 useEffect(()=>{
  if(owner||session.phase!=="ready") {setState(null);return;}
  let live=true;setLoading(true);setError("");
  void userSession.request(followPath(profile.handle)).then(raw=>{const next=parseFollowState(raw);if(live)setState(next);}).catch(e=>{if(live){setState(null);setError(e instanceof Error?e.message:"구독 상태를 불러오지 못했습니다.");}}).finally(()=>{if(live)setLoading(false);});
  return()=>{live=false;};
 },[profile.handle,owner,session.phase,statusAttempt]);
 useEffect(()=>{const node=dialog.current;if(dialogOpen&&!node?.open)node?.showModal();else if(!dialogOpen&&node?.open)node.close();},[dialogOpen]);
 useEffect(()=>{
  if(!dialogOpen||!owner)return;
  let live=true;setPageLoading(true);setPageError("");setPage(null);
  void userSession.request(followsPath(direction,pageIndex)).then(raw=>{const next=parseFollowPage(raw,pageIndex);if(live)setPage(next);}).catch(e=>{if(live)setPageError(e instanceof Error?e.message:"목록을 불러오지 못했습니다.");}).finally(()=>{if(live)setPageLoading(false);});
  return()=>{live=false;};
 },[dialogOpen,owner,direction,pageIndex,attempt]);
 function currentMember(id:string){const current=userSession.snapshot();return current.phase==="ready"&&current.member?.id===id;}
 async function toggle(){
  if(session.phase!=="ready"||!session.member)return;
  if(writing.current||loading||!state)return;
  const memberId=session.member.id,before=state,nextFollowing=!state.following;writing.current=true;setBusy(true);setError("");
  try{
   const raw=await userSession.request(followPath(profile.handle),{method:nextFollowing?"PUT":"DELETE"});
   const next=parseFollowState(raw);if(currentMember(memberId))setState(next);
  }catch(e){if(currentMember(memberId)){setState(before);setError(e instanceof Error?e.message:"구독 상태를 저장하지 못했습니다.");}}
  finally{writing.current=false;setBusy(false);}
 }
 const count=state?.followerCount??profile.followerCount;
 function selectList(next:"followers"|"following"){setDirection(next);setPageIndex(0);}
 function openList(next:"followers"|"following"){selectList(next);setAttempt(v=>v+1);setDialogOpen(true);}
 const rows:FollowIdentity[]=page?.content??[];
 return <>
  <div className={styles.controls} aria-label="블로그 구독">
   <div className={styles.nicknameRow}>
   <p>{profile.nickname}<span aria-hidden="true"> · </span><span className="personal-blog-handle">@{profile.handle}</span></p>
   {!owner&&<button type="button" className={styles.followButton} aria-label={state?.following?"블로그 구독 취소":"블로그 구독하기"} aria-pressed={state?.following??false} disabled={session.phase==="loading"||session.phase==="error"||session.phase==="ready"&&(loading||busy||!state)} onClick={()=>{
    if(session.phase!=="ready"){openLoginDialog();return;}void toggle();
   }}><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 3.75h12a1 1 0 0 1 1 1v15.5l-7-4-7 4V4.75a1 1 0 0 1 1-1Z" fill={state?.following?"currentColor":"none"} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>{session.phase==="ready"&&state?.following?"구독 중":"구독"}</button>}
   </div>
   <div className={styles.counts}>
    {owner?<button type="button" onClick={()=>openList("followers")}><strong>{count.toLocaleString("ko-KR")}</strong><span>팔로워</span></button>:<span><strong>{count.toLocaleString("ko-KR")}</strong><span>팔로워</span></span>}
    {owner?<button type="button" onClick={()=>openList("following")}><strong>{followingCount.toLocaleString("ko-KR")}</strong><span>팔로잉</span></button>:<span><strong>{followingCount.toLocaleString("ko-KR")}</strong><span>팔로잉</span></span>}
   </div>
  </div>
  {error&&!owner&&<p className={styles.error} role="alert">{error}<button type="button" onClick={()=>setStatusAttempt(value=>value+1)}>다시 시도</button></p>}
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
