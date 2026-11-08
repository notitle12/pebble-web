"use client";
import {useEffect,useRef,useState} from "react";
import {userSession,type Member} from "@/features/auth/user-session";
import {MemberGate} from "@/features/auth/components/member-gate";
import {MemberApiError} from "@/lib/member-api";
import {parseOwnPost,parseOwnPosts} from "../api/member-posts";
import {getMemberPostSeriesPosts,parseMemberPostSeries,parseMemberPostSeriesList,validatePostSeriesInput,type PostSeries} from "../api/post-series";
import styles from "./my-series.module.css";

function Manager({member}:{member:Member}){
 const [series,setSeries]=useState<PostSeries[]>([]),[selectedId,setSelectedId]=useState<string|null>(null),[seriesLoading,setSeriesLoading]=useState(true),[seriesError,setSeriesError]=useState(""),[seriesAttempt,setSeriesAttempt]=useState(0);
 const [name,setName]=useState(""),[description,setDescription]=useState(""),[page,setPage]=useState(0),[posts,setPosts]=useState<Awaited<ReturnType<typeof getMemberPostSeriesPosts>>|null>(null),[postsError,setPostsError]=useState(""),[postsAttempt,setPostsAttempt]=useState(0);
 const [candidatePage,setCandidatePage]=useState(0),[candidates,setCandidates]=useState<ReturnType<typeof parseOwnPosts>|null>(null),[candidateError,setCandidateError]=useState(""),[candidateAttempt,setCandidateAttempt]=useState(0);
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[error,setError]=useState("");
 const lock=useRef(false),selected=series.find(row=>row.id===selectedId)??null;
 useEffect(()=>{let live=true;setSeriesLoading(true);setSeriesError("");void userSession.request("/members/me/series").then(value=>{if(!live)return;const next=parseMemberPostSeriesList(value);setSeries(next);setSelectedId(current=>current&&next.some(row=>row.id===current)?current:next[0]?.id??null);}).catch(e=>{if(live)setSeriesError(e instanceof Error?e.message:"시리즈를 불러오지 못했습니다.");}).finally(()=>{if(live)setSeriesLoading(false);});return()=>{live=false;};},[member.id,seriesAttempt]);
 useEffect(()=>{setName(selected?.name??"");setDescription(selected?.description??"");setPage(0);setPosts(null);setError("");setNotice("");},[selected?.id]);
 useEffect(()=>{if(!selected){setPosts(null);setPostsError("");return;}let live=true;setPosts(null);setPostsError("");void getMemberPostSeriesPosts(path=>userSession.request(path),selected.id,page,member.id).then(value=>{if(live)setPosts(value);}).catch(e=>{if(live)setPostsError(e instanceof Error?e.message:"시리즈 글을 불러오지 못했습니다.");});return()=>{live=false;};},[selected?.id,page,member.id,postsAttempt]);
 useEffect(()=>{let live=true;setCandidates(null);setCandidateError("");void userSession.request(`/members/me/posts?page=${candidatePage}&size=20`).then(value=>{if(live)setCandidates(parseOwnPosts(value,candidatePage,member.id));}).catch(e=>{if(live)setCandidateError(e instanceof Error?e.message:"내 글을 불러오지 못했습니다.");});return()=>{live=false;};},[candidatePage,candidateAttempt,member.id]);

 async function run(action:()=>Promise<void>,message:string){if(lock.current)return;lock.current=true;setBusy(true);setError("");setNotice("");try{await action();setNotice(message);}catch(e){setError(e instanceof Error?e.message:"요청을 처리하지 못했습니다.");}finally{lock.current=false;setBusy(false);}}
 function refresh(){setPostsAttempt(value=>value+1);setCandidateAttempt(value=>value+1);setSeriesAttempt(value=>value+1);}
 async function saveSeries(event:React.FormEvent){event.preventDefault();const validation=validatePostSeriesInput(name,description);if(validation){setError(validation);return;}
  await run(async()=>{const body={name:name.trim(),description};if(selected){const next=parseMemberPostSeries(await userSession.request(`/series/${selected.id}`,{method:"PATCH",body}));if(next.id!==selected.id)throw new MemberApiError(0,"INVALID_RESPONSE","시리즈 저장 결과를 확인하지 못했습니다.");setSeries(rows=>rows.map(row=>row.id===next.id?next:row));}
   else{const next=parseMemberPostSeries(await userSession.request("/series",{method:"POST",body}));setSeries(rows=>[next,...rows]);setSelectedId(next.id);setPage(0);setPostsAttempt(value=>value+1);}
  },selected?"시리즈를 저장했습니다.":"시리즈를 만들었습니다.");
 }
 async function deleteSeries(){if(!selected||busy||!window.confirm("시리즈만 삭제합니다. 연결된 글은 그대로 유지됩니다."))return;
  await run(async()=>{await userSession.request(`/series/${selected.id}`,{method:"DELETE"});const remaining=series.filter(row=>row.id!==selected.id);setSeries(remaining);setSelectedId(remaining[0]?.id??null);setPosts(null);setSeriesAttempt(value=>value+1);},"시리즈를 삭제했습니다. 연결된 글은 유지됩니다.");
 }
 async function addPost(postId:string){if(!selected)return;const moving=candidates?.content.find(post=>post.id===postId)?.seriesId!=null;await run(async()=>{const result=parseOwnPost(await userSession.request(`/posts/${postId}`,{method:"PATCH",body:{seriesId:selected.id}}));if(result.id!==postId||result.seriesId!==selected.id)throw new MemberApiError(0,"INVALID_RESPONSE","시리즈 연결 결과를 확인하지 못했습니다.");refresh();},moving?"글을 현재 시리즈로 이동했습니다.":"글을 시리즈에 추가했습니다.");}
 async function releasePost(postId:string){if(!selected)return;await run(async()=>{const result=parseOwnPost(await userSession.request(`/posts/${postId}`,{method:"PATCH",body:{seriesId:null}}));if(result.id!==postId||result.seriesId!==null)throw new MemberApiError(0,"INVALID_RESPONSE","시리즈 해제 결과를 확인하지 못했습니다.");refresh();},"글을 시리즈에서 해제했습니다.");}
 async function movePost(postId:string,order:number){await run(async()=>{const result=parseOwnPost(await userSession.request(`/posts/${postId}`,{method:"PATCH",body:{seriesDisplayOrder:order}}));if(result.id!==postId||result.seriesDisplayOrder!==order)throw new MemberApiError(0,"INVALID_RESPONSE","시리즈 순서 저장 결과를 확인하지 못했습니다.");setPostsAttempt(value=>value+1);},"시리즈 순서를 바꿨습니다.");}
 const eligible=(candidates?.content??[]).filter(post=>post.seriesId!==selected?.id);

 return <section>
  <div className={styles.heading}><h1>시리즈 관리</h1><button className="button" type="button" disabled={busy} onClick={()=>{setSelectedId(null);setName("");setDescription("");setError("");setNotice("");}}>새 시리즈</button></div>
  <p className={styles.notice}>한 글은 시리즈 하나에만 연결됩니다. 시리즈를 삭제해도 글은 삭제되지 않습니다.</p>
  {error&&<p className={styles.error} role="alert">{error}</p>}{notice&&<p className={styles.notice} role="status">{notice}</p>}
  <div className={styles.shell}>
   <aside className={styles.panel} aria-label="내 시리즈"><div className={styles.heading}><h2>내 시리즈</h2></div>
    {seriesLoading?<p role="status">시리즈를 불러오는 중…</p>:seriesError?<p className={styles.error} role="alert">{seriesError} <button type="button" className="button" onClick={()=>setSeriesAttempt(value=>value+1)}>다시 불러오기</button></p>:!series.length?<p className={styles.empty}>아직 시리즈가 없습니다.</p>:<ul className={styles.seriesList}>{series.map(row=><li key={row.id}><button type="button" className={styles.seriesButton} data-selected={selectedId===row.id} aria-pressed={selectedId===row.id} disabled={busy} onClick={()=>setSelectedId(row.id)}><span>{row.name}</span><span className={styles.count}>{row.postCount}개</span></button></li>)}</ul>}
   </aside>
   <div className={styles.panel}>
    <form className={styles.form} onSubmit={event=>void saveSeries(event)}>
     <div className={styles.heading}><h2>{selected?"시리즈 편집":"시리즈 만들기"}</h2>{selected&&<button type="button" className={`button secondary ${styles.danger}`} disabled={busy} onClick={()=>void deleteSeries()}>시리즈 삭제</button>}</div>
     <label className={styles.field}>이름<input value={name} maxLength={100} required onChange={event=>setName(event.target.value)}/></label>
     <label className={styles.field}>설명<textarea value={description} maxLength={1000} onChange={event=>setDescription(event.target.value)}/></label>
     <div className={styles.actions}><button type="submit" className="button" disabled={busy}>{busy?"저장 중…":selected?"변경 저장":"시리즈 만들기"}</button></div>
    </form>
    {selected&&<>
     <section aria-labelledby="series-post-heading"><div className={styles.heading}><h2 id="series-post-heading">시리즈 글</h2><span className={styles.count}>{selected.postCount}개</span></div>
      {postsError?<p className={styles.error} role="alert">{postsError} <button type="button" className="button" onClick={()=>setPostsAttempt(value=>value+1)}>다시 불러오기</button></p>:!posts?<p role="status">글을 불러오는 중…</p>:!posts.content.length?<p className={styles.empty}>연결된 글이 없습니다.</p>:<ul className={styles.postList}>{posts.content.map((post,index)=><li className={styles.postRow} key={post.id}><div className={styles.postTitle}>{post.title}<span className={styles.postMeta}>{post.draft?"임시저장 · ":post.visibilityStatus==="HIDDEN"?"비공개 · ":""}{post.isBlocked?"차단됨 · ":""}{index+1+page*20}번째</span></div><div className={styles.rowActions}><button type="button" aria-label={`${post.title} 위로 이동`} title="위로 이동" disabled={busy||index===0&&page===0} onClick={()=>void movePost(post.id,page*20+index-1)}><svg aria-hidden="true" viewBox="0 0 20 20"><path d="m5 11 5-5 5 5M10 6v10"/></svg></button><button type="button" aria-label={`${post.title} 아래로 이동`} title="아래로 이동" disabled={busy||!posts.hasNext&&index===posts.content.length-1} onClick={()=>void movePost(post.id,page*20+index+1)}><svg aria-hidden="true" viewBox="0 0 20 20"><path d="m5 9 5 5 5-5M10 14V4"/></svg></button><button type="button" className={styles.danger} aria-label={`${post.title} 시리즈에서 해제`} disabled={busy} onClick={()=>void releasePost(post.id)}><svg aria-hidden="true" viewBox="0 0 20 20"><path d="m6 6 8 8m0-8-8 8"/></svg></button></div></li>)}</ul>}
      {posts&&posts.totalPages>0&&<nav className={styles.actions} aria-label="시리즈 글 페이지"><button type="button" disabled={busy||!posts.hasPrevious} onClick={()=>setPage(value=>value-1)}>이전</button><span>{page+1} / {Math.max(1,posts.totalPages)}</span><button type="button" disabled={busy||!posts.hasNext} onClick={()=>setPage(value=>value+1)}>다음</button></nav>}
     </section>
     <section className={styles.candidate} aria-labelledby="add-series-post-heading"><h3 id="add-series-post-heading">기존 글 추가</h3>
      {candidateError?<p className={styles.error} role="alert">{candidateError} <button type="button" className="button" onClick={()=>setCandidateAttempt(value=>value+1)}>다시 불러오기</button></p>:!candidates?<p role="status">내 글을 불러오는 중…</p>:!eligible.length?<p className={styles.notice}>이 페이지에는 추가할 수 있는 글이 없습니다.</p>:<ul className={styles.postList}>{eligible.map(post=><li className={styles.candidateRow} key={post.id}><span className={styles.candidateTitle}>{post.title}<span className={styles.postMeta}>{post.draft?"임시저장 · ":post.visibilityStatus==="HIDDEN"?"비공개 · ":""}{post.isBlocked?"차단됨 · ":""}{post.seriesId?"다른 시리즈에 연결됨":""}</span></span><button className="button" type="button" disabled={busy} onClick={()=>void addPost(post.id)}>{post.seriesId?"이동":"추가"}</button></li>)}</ul>}
      {candidates&&candidates.totalPages>0&&<nav className={styles.actions} aria-label="추가할 글 페이지"><button type="button" disabled={busy||!candidates.hasPrevious} onClick={()=>setCandidatePage(value=>value-1)}>이전</button><span>{candidatePage+1} / {Math.max(1,candidates.totalPages)}</span><button type="button" disabled={busy||!candidates.hasNext} onClick={()=>setCandidatePage(value=>value+1)}>다음</button></nav>}
     </section>
    </>}
   </div>
  </div>
 </section>;
}
export function MySeries(){return <MemberGate preserveOnRefresh>{member=><Manager key={member.id} member={member}/>}</MemberGate>;}
