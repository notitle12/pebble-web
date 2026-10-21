"use client";
import {useEffect,useId,useState} from "react";
import Link from "next/link";
import {userSession} from "@/features/auth/user-session";
import {parseBoards,flattenBoards,type Board} from "../api/boards";
export function BoardPicker({boardId,onChange,label="글 폴더"}:{boardId:string|null;onChange:(id:string|null)=>void;label?:string}){
 const id=useId(),[boards,setBoards]=useState<Board[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[attempt,setAttempt]=useState(0);
 useEffect(()=>{let live=true;setLoading(true);setError("");void userSession.request("/members/me/boards").then(value=>{if(live)setBoards(parseBoards(value,true));}).catch(e=>{if(live)setError(e instanceof Error?e.message:"폴더를 불러오지 못했습니다.");}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[attempt]);
 const rows=flattenBoards(boards);
 const unavailableBoardLabel=loading?"기존 폴더 불러오는 중…":error?"기존 폴더 이름을 불러오지 못했습니다":"기존 폴더 (이름을 확인할 수 없음)";
 return <section className="post-classification" aria-label={label}><div className="post-classification-field"><label htmlFor={id}>{label}</label><select id={id} value={boardId??""} aria-busy={loading} onChange={e=>onChange(e.target.value||null)}><option value="">게시판 기본 (미지정)</option>{boardId&&!rows.some(row=>row.id===boardId)&&<option value={boardId}>{unavailableBoardLabel}</option>}{rows.map(row=><option key={row.id} value={row.id}>{"　".repeat(row.depth)}{row.name}</option>)}</select>
 {loading&&<p role="status">폴더를 불러오는 중…</p>}{error&&<p role="alert">{error} 기존 연결은 유지됩니다. <button type="button" onClick={()=>setAttempt(n=>n+1)}>폴더 다시 불러오기</button></p>}{!loading&&!error&&!rows.length&&<p>게시판을 선택하지 않으면 게시판 전체에 기본으로 표시됩니다.</p>}<p className="post-classification-help">게시판을 선택하지 않아도 블로그 게시판 목록에서 모든 글과 함께 표시됩니다.</p><Link href="/me/boards" target="_blank" rel="noopener noreferrer">폴더 관리 열기</Link></div></section>;
}
