"use client";
import {useEffect,useId,useMemo,useRef,useState} from "react";
import Link from "next/link";
import {userSession,type Member} from "@/features/auth/user-session";
import {MemberGate} from "@/features/auth/components/member-gate";
import {MemberApiError} from "@/lib/member-api";
import {parseOwnPost,type OwnPostPage} from "../api/member-posts";
import {getSeriesPostOrderSnapshot,getSeriesCandidatePosts,parseMemberPostSeries,parseMemberPostSeriesList,saveSeriesOrders,validatePostSeriesInput,publicPostSeriesHref,type PostSeries} from "../api/post-series";
import {filterSeriesCandidates,type SeriesPostState} from "../series-post-filter";
import {SeriesPostList} from "./series-post-list";
import {SeriesList} from "./series-list";
import {reorderSeriesRows,sameSeriesOrder} from "../series-post-order";
import {parseBoards,flattenBoards,type Board} from "@/features/board/api/boards";
import s from "./my-series.module.css";

function Save(){return <svg aria-hidden="true" viewBox="0 0 20 20"><path d="M4 3h10l3 3v11H3V3h1Zm2 0v5h7V3M6 17v-6h8v6"/></svg>;}
function Plus(){return <svg aria-hidden="true" viewBox="0 0 20 20"><path d="M10 4v12M4 10h12"/></svg>;}
function Manager({member}:{member:Member}){
 const [series,setSeries]=useState<PostSeries[]>([]),[selectedId,setSelectedId]=useState<string|null>(null),[seriesLoading,setSeriesLoading]=useState(true),[seriesError,setSeriesError]=useState(""),[seriesAttempt,setSeriesAttempt]=useState(0);
 const [seriesBaseline,setSeriesBaseline]=useState<string[]>([]),[screen,setScreen]=useState<"list"|"edit"|"create">("list");
 const [tab,setTab]=useState<"info"|"posts">("posts"),[name,setName]=useState(""),[description,setDescription]=useState("");
 const [page,setPage]=useState(0),[postRows,setPostRows]=useState<OwnPostPage["content"]|null>(null),[postBaseline,setPostBaseline]=useState<string[]>([]),[postsError,setPostsError]=useState(""),[postsAttempt,setPostsAttempt]=useState(0),[uncertain,setUncertain]=useState(false);
 const [addOpen,setAddOpen]=useState(false),[candidates,setCandidates]=useState<OwnPostPage["content"]|null>(null),[candidateError,setCandidateError]=useState(""),[candidateAttempt,setCandidateAttempt]=useState(0);
 const [query,setQuery]=useState(""),[state,setState]=useState<SeriesPostState>("all"),[connection,setConnection]=useState("all"),[visible,setVisible]=useState(20),[checked,setChecked]=useState<string[]>([]);
 const [board,setBoard]=useState("all"),[boards,setBoards]=useState<Board[]|null>(null),[boardsError,setBoardsError]=useState(""),[boardsAttempt,setBoardsAttempt]=useState(0);
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[error,setError]=useState("");
 const lock=useRef(false),mounted=useRef(false),dialog=useRef<HTMLDialogElement>(null),selectVisible=useRef<HTMLInputElement>(null);
 const tabsId=useId(),dialogTitle=useId(),formId=useId(),selected=series.find(row=>row.id===selectedId)??null;
 const current=()=>mounted.current&&userSession.snapshot().member?.id===member.id&&userSession.snapshot().phase==="ready";
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{let live=true;setSeriesLoading(true);setSeriesError("");void userSession.request("/members/me/series").then(value=>{if(!live)return;const next=parseMemberPostSeriesList(value);setSeries(next);setSeriesBaseline(next.map(row=>row.id));if(!selectedId)setUncertain(false);setSelectedId(id=>id&&next.some(row=>row.id===id)?id:null);}).catch(e=>{if(live)setSeriesError(e instanceof Error?e.message:"시리즈를 불러오지 못했습니다.");}).finally(()=>{if(live)setSeriesLoading(false);});return()=>{live=false;};},[member.id,seriesAttempt]);
 useEffect(()=>{setName(selected?.name??"");setDescription(selected?.description??"");setPage(0);setPostRows(null);setPostBaseline([]);setPostsError("");setUncertain(false);setError("");setNotice("");},[selected?.id]);
 useEffect(()=>{if(!seriesLoading&&screen==="edit"&&!selectedId)setScreen("list");},[seriesLoading,screen,selectedId]);
 useEffect(()=>{
  if(!selectedId){setPostRows(null);setPostBaseline([]);return;}
  let live=true;setPostRows(null);setPostsError("");void getSeriesPostOrderSnapshot(path=>userSession.request(path),selectedId,member.id).then(rows=>{if(live){setPostRows(rows);setPostBaseline(rows.map(row=>row.id));setUncertain(false);}}).catch(e=>{if(live)setPostsError(e instanceof Error?e.message:"시리즈 글을 불러오지 못했습니다.");});return()=>{live=false;};
 },[selectedId,member.id,postsAttempt]);
 useEffect(()=>{if(!addOpen)return;let live=true;setCandidates(null);setCandidateError("");void getSeriesCandidatePosts(path=>userSession.request(path),member.id).then(value=>{if(live)setCandidates(value);}).catch(e=>{if(live)setCandidateError(e instanceof Error?e.message:"내 글을 불러오지 못했습니다.");});return()=>{live=false;};},[addOpen,candidateAttempt,member.id]);
 useEffect(()=>{const node=dialog.current;if(addOpen&&!node?.open)node?.showModal();else if(!addOpen&&node?.open)node.close();},[addOpen]);
 useEffect(()=>{if(!addOpen)return;let live=true;setBoards(null);setBoardsError("");void userSession.request("/members/me/boards").then(value=>{if(live)setBoards(parseBoards(value,true));}).catch(e=>{if(live)setBoardsError(e instanceof Error?e.message:"게시판을 불러오지 못했습니다.");});return()=>{live=false;};},[addOpen,boardsAttempt,member.id]);
 const flatBoards=flattenBoards(boards??[]);
 const filtered=filterSeriesCandidates(candidates??[],selectedId??"",query,state,connection,board),visibleRows=filtered.slice(0,visible);
 useEffect(()=>{if(selectVisible.current)selectVisible.current.indeterminate=visibleRows.some(post=>checked.includes(post.id))&&!visibleRows.every(post=>checked.includes(post.id));},[checked,visibleRows]);
 const posts=useMemo<OwnPostPage|null>(()=>{if(!postRows)return null;const total=postRows.length,pages=Math.ceil(total/20);return {content:postRows.slice(page*20,page*20+20),page,size:20,totalElements:total,totalPages:pages,hasPrevious:page>0,hasNext:page+1<pages};},[postRows,page]);
 const seriesDirty=!sameSeriesOrder(seriesBaseline,series.map(row=>row.id)),postDirty=postRows!==null&&!sameSeriesOrder(postBaseline,postRows.map(row=>row.id)),orderDirty=seriesDirty||postDirty;
 const blocked=busy||uncertain,structureBlocked=blocked||orderDirty;
 useEffect(()=>{
  if(!orderDirty)return;
  const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};
  const link=(event:MouseEvent)=>{if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;const anchor=(event.target as Element).closest?.("a");if(!anchor||anchor.target==="_blank"||anchor.hasAttribute("download"))return;const url=new URL(anchor.href,location.href);if(url.origin===location.origin&&(url.pathname!==location.pathname||url.search!==location.search)&&!window.confirm("저장하지 않은 순서 변경이 있습니다. 이 페이지를 나갈까요?")){event.preventDefault();event.stopImmediatePropagation();}};
  window.addEventListener("beforeunload",warn);document.addEventListener("click",link,true);return()=>{window.removeEventListener("beforeunload",warn);document.removeEventListener("click",link,true);};
 },[orderDirty]);
 async function run(action:()=>Promise<void>,message:string){if(lock.current||!current())return false;lock.current=true;setBusy(true);setError("");setNotice("");try{await action();if(current())setNotice(message);return true;}catch(e){if(current())setError(e instanceof Error?e.message:"요청을 처리하지 못했습니다.");return false;}finally{lock.current=false;if(mounted.current)setBusy(false);}}
 function refresh(){setPostsAttempt(n=>n+1);setSeriesAttempt(n=>n+1);}
 function moveSeries(id:string,position:number){if(blocked||seriesLoading||seriesError||lock.current||!current())return;setSeries(rows=>reorderSeriesRows(rows,id,position));setNotice("");}
 function resetOrders(){if(blocked)return;const byId=new Map(series.map(row=>[row.id,row]));setSeries(seriesBaseline.map(id=>byId.get(id)!));if(postRows){const byPost=new Map(postRows.map(row=>[row.id,row]));setPostRows(postBaseline.map(id=>byPost.get(id)!));}setError("");setNotice("");}
 function reloadOrders(){if(orderDirty&&!window.confirm("저장하지 않은 순서 변경을 버리고 목록을 다시 불러올까요?"))return;setError("");setNotice("");refresh();}
 async function saveOrders(){if(blocked||!orderDirty||seriesLoading||seriesError||lock.current||!current())return;const nextSeries=series.map(row=>row.id),nextPosts=postRows?.map(row=>row.id)??[];
  const ok=await run(async()=>{await saveSeriesOrders((path,options)=>userSession.request(path,options),{...(seriesDirty?{seriesOrder:{expectedIds:seriesBaseline,ids:nextSeries}}:{}),...(postDirty&&selectedId?{postOrder:{seriesId:selectedId,expectedIds:postBaseline,ids:nextPosts}}:{})});if(current()){if(seriesDirty)setSeriesBaseline(nextSeries);if(postDirty)setPostBaseline(nextPosts);}},"순서를 저장했습니다.");if(!ok&&current())setUncertain(true);
 }
 function choose(id:string|null,nextScreen:"list"|"edit"|"create"=id?"edit":"create"){if(busy)return;const dirty=postDirty||name!==(selected?.name??"")||description!==(selected?.description??"");if(dirty&&!window.confirm("저장하지 않은 변경 사항이 있습니다. 다른 시리즈로 이동할까요?"))return;setSelectedId(id);setScreen(nextScreen);setTab(id?"posts":"info");setName("");setDescription("");setError("");setNotice("");}
 async function saveSeries(event:React.FormEvent){event.preventDefault();if(blocked||!selected&&orderDirty)return;const validation=validatePostSeriesInput(name.trim(),description);if(validation){setError(validation);return;}
  await run(async()=>{const body={name:name.trim(),description};const next=parseMemberPostSeries(await userSession.request(selected?`/series/${selected.id}`:"/series",{method:selected?"PATCH":"POST",body}));if(selected&&next.id!==selected.id)throw new MemberApiError(0,"INVALID_RESPONSE","시리즈 저장 결과를 확인하지 못했습니다.");if(!current())return;setSeries(rows=>selected?rows.map(row=>row.id===next.id?next:row):[next,...rows]);if(!selected)setSeriesBaseline(ids=>[next.id,...ids]);setName(next.name);setDescription(next.description);setSelectedId(next.id);if(!selected){setScreen("edit");setTab("posts");}},selected?"기본 정보를 저장했습니다.":"시리즈를 만들었습니다. 글을 추가해 보세요.");
 }
 async function deleteSeries(){if(!selected||structureBlocked||!window.confirm("시리즈만 삭제합니다. 연결된 글은 그대로 유지됩니다."))return;
  await run(async()=>{await userSession.request(`/series/${selected.id}`,{method:"DELETE"});if(!current())return;const remaining=series.filter(row=>row.id!==selected.id);setSeries(remaining);setSeriesBaseline(remaining.map(row=>row.id));setSelectedId(null);setScreen("list");setTab("posts");setPostRows(null);setPostBaseline([]);},"시리즈를 삭제했습니다. 연결된 글은 유지됩니다.");
 }
 async function releasePost(postId:string){if(!selected||structureBlocked)return;const ok=await run(async()=>{const result=parseOwnPost(await userSession.request(`/posts/${postId}`,{method:"PATCH",body:{seriesId:null}}));if(result.id!==postId||result.author.id!==member.id||result.seriesId!==null)throw new MemberApiError(0,"INVALID_RESPONSE","시리즈 해제 결과를 확인하지 못했습니다.");const target=posts?.content.length===1&&page>0?page-1:page;if(current()){if(target!==page)setPage(target);refresh();}},"글을 시리즈에서 뺐습니다.");if(!ok&&current())setUncertain(true);}
 function movePost(postId:string,order:number){if(!selected||!postRows||blocked||lock.current||!current())return;setPostRows(rows=>rows?reorderSeriesRows(rows,postId,order):rows);setPage(Math.floor(order/20));setNotice("");}
 function openAdd(){setQuery("");setState("all");setConnection("all");setBoard("all");setVisible(20);setChecked([]);setError("");setAddOpen(true);}
 async function addSelected(){if(!selected||!candidates||!checked.length||structureBlocked)return;let added=0;
  const ids=candidates.filter(post=>post.seriesId!==selected.id&&checked.includes(post.id)).map(post=>post.id);if(!ids.length)return;
  const ok=await run(async()=>{for(const id of ids){if(!current())return;const result=parseOwnPost(await userSession.request(`/posts/${id}`,{method:"PATCH",body:{seriesId:selected.id}}));if(result.id!==id||result.author.id!==member.id||result.seriesId!==selected.id)throw new MemberApiError(0,"INVALID_RESPONSE","글 연결 결과를 확인하지 못했습니다.");added++;}if(current()){refresh();setAddOpen(false);}},`${ids.length}개 글을 추가했습니다.`);
  if(!ok&&current()){setError(`${added}개 글의 추가를 확인했습니다. 나머지 결과를 확인하려면 목록을 다시 불러와 주세요.`);setChecked([]);setUncertain(true);refresh();setCandidateAttempt(n=>n+1);}
 }
 function changeTab(next:"info"|"posts"){setTab(next);if(!uncertain)setError("");setNotice("");}
 return <section className={s.manager}>
  <header className={s.pageHeading}>
   <div>{screen==="list"?<Link href="/me/posts" className={s.backLink}>← 게시글 관리</Link>:<button className={s.backLink} type="button" disabled={busy} onClick={()=>choose(null,"list")}>← 시리즈 목록</button>}<h1>{screen==="list"?"시리즈 관리":screen==="create"?"시리즈 추가":selected?.name??"시리즈 관리"}</h1></div>
   <div className={s.headingActions}>
    {(screen==="list"||screen==="edit"&&tab==="posts")&&<>
     {orderDirty&&<button className={s.button} type="button" disabled={blocked} onClick={resetOrders}>되돌리기</button>}
     {screen==="list"?<button className={s.button} type="button" disabled={structureBlocked||seriesLoading} onClick={()=>choose(null)}><Plus/>시리즈 추가</button>:<button className={s.button} type="button" disabled={structureBlocked||!selected} onClick={openAdd}><Plus/>글 추가</button>}
     <button className={`${s.button} ${s.primary}`} type="button" disabled={blocked||!orderDirty||seriesLoading||!!seriesError} onClick={()=>void saveOrders()}><Save/>{busy?"저장 중…":"저장"}</button>
    </>}
    {(screen==="create"||screen==="edit"&&tab==="info")&&<button className={`${s.button} ${s.primary}`} type="submit" form={formId} disabled={blocked||seriesLoading||!selected&&orderDirty}><Save/>{busy?"저장 중…":"저장"}</button>}
   </div>
  </header>
  <div className={s.feedback}>{!addOpen&&error&&<p role="alert" className={s.error}>{error}</p>}{notice&&<p role="status">{notice}</p>}{uncertain&&!addOpen&&<button className={s.button} disabled={busy} onClick={reloadOrders}>목록 다시 불러오기</button>}</div>
  {screen==="list"?<section aria-label="내 시리즈">
   <div className={s.listHeading}><p>손잡이를 드래그해 순서를 바꾸고, 시리즈를 선택해 관리하세요.</p><span className={s.listCount}>{series.length}개 시리즈</span></div>
   {seriesLoading?<p className={s.empty} role="status">불러오는 중…</p>:seriesError?<div className={s.empty}><p className={s.error} role="alert">{seriesError}</p><button className={s.button} onClick={reloadOrders}>다시 불러오기</button></div>:!series.length?<div className={s.empty}><h3>아직 시리즈가 없어요</h3><p>시리즈 추가에서 함께 읽을 글을 묶어 보세요.</p></div>:<SeriesList rows={series} disabled={blocked||seriesLoading} onSelect={choose} onMove={moveSeries}/>}
   {seriesDirty&&<p className={s.orderHint} role="status">저장하지 않은 순서 변경이 있습니다.</p>}
  </section>:<div className={s.content}>
   {screen==="edit"&&<>
    <div className={s.seriesHeading}>{selected?.description&&<p>{selected.description}</p>}{selected&&<Link className={s.previewLink} href={publicPostSeriesHref(member.handle!,selected.id)} target="_blank" rel="noopener noreferrer">블로그에서 보기 ↗</Link>}</div>
    <div role="tablist" aria-label="시리즈 관리 항목" className={s.tabs} onKeyDown={event=>{if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key)||!selected)return;event.preventDefault();const next=event.key==="Home"?"info":event.key==="End"?"posts":tab==="info"?"posts":"info";changeTab(next);document.getElementById(`${tabsId}-${next}-tab`)?.focus();}}><button type="button" role="tab" id={`${tabsId}-info-tab`} aria-controls={`${tabsId}-info-panel`} aria-selected={tab==="info"} tabIndex={tab==="info"?0:-1} onClick={()=>changeTab("info")}>기본 정보</button><button type="button" role="tab" id={`${tabsId}-posts-tab`} aria-controls={`${tabsId}-posts-panel`} aria-selected={tab==="posts"} tabIndex={tab==="posts"?0:-1} disabled={!selected} onClick={()=>changeTab("posts")}>시리즈 글 {selected&&<span>{selected.postCount}</span>}</button></div>
   </>}
   <section role={screen==="edit"?"tabpanel":undefined} id={`${tabsId}-info-panel`} aria-labelledby={screen==="edit"?`${tabsId}-info-tab`:undefined} hidden={screen==="edit"&&tab!=="info"}>
    <form id={formId} className={s.form} onSubmit={event=>void saveSeries(event)}><label className={s.field}>시리즈 이름<input value={name} maxLength={200} required disabled={blocked||seriesLoading} placeholder="예: AI 사용법" onChange={event=>setName(event.target.value)}/></label><label className={s.field}>소개<textarea value={description} maxLength={2000} disabled={blocked||seriesLoading} placeholder="어떤 글을 모은 시리즈인지 소개해 주세요." onChange={event=>setDescription(event.target.value)}/></label>{selected&&<div className={s.formFooter}><button className={s.deleteButton} type="button" disabled={structureBlocked} onClick={()=>void deleteSeries()}>시리즈 삭제</button><p className={s.footnote}>시리즈를 삭제해도 연결된 글은 남습니다.</p></div>}</form>
   </section>
   {screen==="edit"&&<section role="tabpanel" id={`${tabsId}-posts-panel`} aria-labelledby={`${tabsId}-posts-tab`} hidden={tab!=="posts"}>
    <div className={s.listHeading}><p>손잡이를 드래그해 순서를 바꾼 뒤 상단에서 저장하세요.</p></div>
    {postsError?<div className={s.empty}><p role="alert">{postsError}</p><button className={s.button} onClick={()=>setPostsAttempt(n=>n+1)}>다시 불러오기</button></div>:!posts?<p className={s.empty} role="status">글을 불러오는 중…</p>:!posts.content.length?<div className={s.empty}><h3>아직 연결된 글이 없어요</h3><p>글 추가에서 이 시리즈에 담을 글을 골라 보세요.</p></div>:<SeriesPostList key={selectedId} posts={posts} disabled={blocked} membershipDisabled={structureBlocked} onMove={movePost} onRelease={id=>void releasePost(id)}/>}
    {posts&&posts.totalPages>1&&<nav className={s.pagination} aria-label="시리즈 글 페이지"><button className={s.button} disabled={blocked||!posts.hasPrevious} onClick={()=>setPage(n=>n-1)}>이전</button><span>{page+1} / {posts.totalPages}</span><button className={s.button} disabled={blocked||!posts.hasNext} onClick={()=>setPage(n=>n+1)}>다음</button></nav>}
    {orderDirty&&<p className={s.orderHint} role="status">저장하지 않은 순서 변경이 있습니다. 글 추가·해제는 저장하거나 되돌린 후 사용할 수 있어요.</p>}
   </section>}
  </div>}
  <dialog ref={dialog} className={s.dialog} aria-labelledby={dialogTitle} onCancel={event=>{if(busy)event.preventDefault();else setAddOpen(false);}} onClose={()=>setAddOpen(false)}>
   <header className={s.dialogHeading}><h2 id={dialogTitle}>시리즈에 글 추가</h2><p>{selected?.name}</p></header>
   <div className={s.filters}><label className={s.searchField}><svg aria-hidden="true" viewBox="0 0 20 20"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4 4"/></svg><input autoFocus aria-label="추가할 글 검색" type="search" placeholder="글 제목으로 검색" value={query} disabled={busy} onChange={event=>{setQuery(event.target.value);setVisible(20);}}/></label><div className={s.filterRow}><label>게시판<select value={board} disabled={busy||boards===null} onChange={event=>{setBoard(event.target.value);setVisible(20);}}><option value="all">전체 게시판</option><option value="none">게시판 미지정</option>{flatBoards.map(row=><option key={row.id} value={row.id}>{`${"　".repeat(row.depth)}${row.depth?"└ ":""}${row.name}`}</option>)}</select></label><label>공개 상태<select value={state} disabled={busy} onChange={event=>{setState(event.target.value as SeriesPostState);setVisible(20);}}><option value="all">전체 상태</option><option value="public">공개</option><option value="hidden">비공개</option><option value="draft">임시저장</option><option value="blocked">차단됨</option></select></label><label>시리즈 연결<select value={connection} disabled={busy} onChange={event=>{setConnection(event.target.value);setVisible(20);}}><option value="all">전체 글</option><option value="none">연결되지 않은 글</option>{series.filter(row=>row.id!==selectedId).map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label></div></div>
   {boardsError&&<p className={s.dialogError} role="alert">{boardsError} <button className={s.button} type="button" onClick={()=>setBoardsAttempt(n=>n+1)}>게시판 다시 불러오기</button></p>}
   <div className={s.candidateToolbar}><label><input ref={selectVisible} type="checkbox" aria-label="보이는 글 전체 선택" disabled={busy||!visibleRows.length} checked={visibleRows.length>0&&visibleRows.every(post=>checked.includes(post.id))} onChange={event=>setChecked(ids=>event.target.checked?[...new Set([...ids,...visibleRows.map(post=>post.id)])]:ids.filter(id=>!visibleRows.some(post=>post.id===id)))}/>전체 선택</label><span>{candidates?`${filtered.length}개 글`:""}</span></div>
   <div className={s.candidateBody}>{candidateError?<div className={s.empty}><p role="alert">{candidateError}</p><button className={s.button} onClick={()=>setCandidateAttempt(n=>n+1)}>다시 불러오기</button></div>:!candidates?<p className={s.empty} role="status">글을 불러오는 중…</p>:!filtered.length?<p className={s.empty}>조건에 맞는 글이 없습니다.</p>:<><ul className={s.candidateList}>{visibleRows.map(post=><li key={post.id}><label className={s.candidateRow}><input type="checkbox" checked={checked.includes(post.id)} disabled={busy} aria-label={`${post.title} 추가 선택`} onChange={event=>setChecked(ids=>event.target.checked?[...ids,post.id]:ids.filter(id=>id!==post.id))}/><span><strong>{post.title}</strong><small>{post.draft?"임시저장":post.visibilityStatus==="PUBLIC"?"공개":"비공개"}{post.isBlocked?" · 차단됨":""} · {post.seriesId?series.find(row=>row.id===post.seriesId)?.name??"다른 시리즈":"연결된 시리즈 없음"} · {post.boardId===null?"게시판 미지정":flatBoards.find(row=>row.id===post.boardId)?.name??"게시판 확인 중"}</small></span></label></li>)}</ul>{filtered.length>visible&&<button className={`${s.button} ${s.loadMore}`} disabled={busy} onClick={()=>setVisible(n=>n+20)}>더 보기</button>}</>}</div>
   {error&&addOpen&&<p className={s.dialogError} role="alert">{error}</p>}{uncertain&&addOpen&&<button className={s.button} disabled={busy} onClick={()=>{refresh();setCandidateAttempt(n=>n+1);}}>목록 다시 불러오기</button>}
   <footer className={s.dialogFooter}><span>{checked.length}개 선택</span><div><button type="button" className={s.button} disabled={busy} onClick={()=>{setAddOpen(false);setError("");}}>취소</button><button type="button" className={`${s.button} ${s.primary}`} disabled={blocked||!candidates||!checked.length} onClick={()=>void addSelected()}>{busy?"추가 중…":`${checked.length?`${checked.length}개 `:""}추가`}</button></div></footer>
  </dialog>
 </section>;
}
export function MySeries(){return <MemberGate profile preserveOnRefresh>{member=><Manager key={member.id} member={member}/>}</MemberGate>;}
