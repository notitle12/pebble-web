'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {userSession} from '@/features/auth/user-session';
import {MemberApiError} from '@/lib/member-api';
import {getProjectOrderPosts,moveProjectPost,projectPostMoveTarget,type ProjectOrderPage} from '../api/project-post-order';
import s from './project-post-order.module.css';
export function ProjectPostOrder({projectId,memberId,disabled=false}:{projectId:string;memberId:string;disabled?:boolean}){
 const heading=useId();
 const [data,setData]=useState<ProjectOrderPage|null>(null),[page,setPage]=useState(0),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[uncertain,setUncertain]=useState(false),[attempt,setAttempt]=useState(0);
 const mounted=useRef(false),lock=useRef(false),generation=useRef(0);
 const current=()=>mounted.current&&userSession.snapshot().phase==='ready'&&userSession.snapshot().member?.id===memberId;
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;generation.current++;};},[]);
 async function load(target:number){
  const epoch=++generation.current;setLoading(true);setError('');
  try{
   let result=await getProjectOrderPosts(projectId,target,memberId,(path,options)=>userSession.request(path,options));
   if(!current()||epoch!==generation.current)return;
   if(!result.content.length&&target>0){target=Math.max(0,result.totalPages-1);result=await getProjectOrderPosts(projectId,target,memberId,(path,options)=>userSession.request(path,options));}
   if(!current()||epoch!==generation.current)return;
   setData(result);setPage(target);setUncertain(false);return result;
  }catch(e){if(current()&&epoch===generation.current){setData(null);setError(e instanceof MemberApiError&&e.status===404?'프로젝트가 없거나 본인 프로젝트가 아니에요.':'관련 게시글을 불러오지 못했어요. 다시 불러와 주세요.');}throw e;}
  finally{if(mounted.current&&epoch===generation.current)setLoading(false);}
 }
 useEffect(()=>{void load(page).catch(()=>{});return()=>{generation.current++;};},[projectId,memberId,page,attempt]); // eslint-disable-line react-hooks/exhaustive-deps
 async function move(index:number,direction:-1|1){
  if(!data||disabled||loading||lock.current||uncertain||!current())return;
  const target=projectPostMoveTarget(data,index,direction);if(target===null)return;
  const post=data.content[index];lock.current=true;setBusy(true);setError('');setNotice('');let saved=false;
  try{
   await moveProjectPost(projectId,post.id,target,(path,options)=>userSession.request(path,options));saved=true;
   if(!current())return;
   await load(page);
   if(current())setNotice(`‘${post.title}’의 순서를 변경했어요.`);
  }catch(e){if(current()){
   const unknown=saved||!(e instanceof MemberApiError)||e.status===0||e.status>=500;setUncertain(unknown);
   setError(unknown?'저장 결과를 확인하려면 목록을 다시 불러와 주세요.':e instanceof Error?e.message:'순서를 변경하지 못했어요.');
  }}finally{lock.current=false;if(mounted.current)setBusy(false);}
 }
 const blocked=disabled||busy||loading||uncertain;
 return <section className={s.section} aria-labelledby={heading} aria-busy={loading||busy}>
  <div className={s.heading}><h2 id={heading}>관련 게시글 순서</h2>{data&&<span>총 {data.totalElements}개</span>}</div>
  <p className={s.help}>위·아래 버튼으로 독자가 읽을 순서를 정해 주세요. 순서 변경은 프로젝트 발행과 별도로 즉시 저장됩니다. 비공개·차단된 글도 포함되며, 공개 화면에는 공개 가능한 글만 이 순서대로 표시됩니다.</p>
  {error&&<p className={s.message} role="alert">{error}</p>}
  {(error||uncertain)&&<button type="button" className="button" disabled={disabled||busy||loading} onClick={()=>{setNotice('');setAttempt(n=>n+1);}}>목록 다시 불러오기</button>}
  {notice&&<p className={s.message} role="status">{notice}</p>}
  {loading?<p role="status">관련 게시글을 불러오고 있어요.</p>:data&&!data.content.length?<p>아직 연결된 게시글이 없어요. 게시글 발행 설정에서 이 프로젝트를 연결할 수 있어요.</p>:data&&<ol className={s.list} start={page*20+1} aria-label="관련 게시글 표시 순서">
   {data.content.map((post,index)=><li key={post.id} className={s.row}>
    <span className={s.number} aria-hidden="true">{page*20+index+1}</span><div className={s.content}><span className={s.title}>{post.title}</span><span className={s.status}>{post.visibilityStatus==='HIDDEN'?'비공개':'공개'}{post.isBlocked?' · 차단':''}{post.draft?' · 임시 글':''}</span></div>
    <div className={s.actions}><button type="button" disabled={blocked||projectPostMoveTarget(data,index,-1)===null} aria-label={`${post.title}: 위로 이동`} onClick={()=>void move(index,-1)}>↑ <span>위로</span></button><button type="button" disabled={blocked||projectPostMoveTarget(data,index,1)===null} aria-label={`${post.title}: 아래로 이동`} onClick={()=>void move(index,1)}>↓ <span>아래로</span></button></div>
   </li>)}
  </ol>}
  {data&&data.totalPages>1&&<nav className={s.pagination} aria-label="관련 게시글 순서 페이지"><button type="button" className="button" disabled={blocked||!data.hasPrevious} onClick={()=>{setData(null);setNotice('');setPage(n=>n-1);}}>이전</button><span>{page+1} / {data.totalPages}</span><button type="button" className="button" disabled={blocked||!data.hasNext} onClick={()=>{setData(null);setNotice('');setPage(n=>n+1);}}>다음</button></nav>}
 </section>;
}
