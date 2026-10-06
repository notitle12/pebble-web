"use client";
import {useEffect,useId,useState} from "react";
import Link from "next/link";
import {userSession} from "@/features/auth/user-session";
import {parseBoards,flattenBoards,type Board} from "../api/boards";
export function BoardPicker({boardId,onChange,label="글 폴더"}:{boardId:string|null;onChange:(id:string|null)=>void;label?:string}){
 const id=useId(),[boards,setBoards]=useState<Board[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[attempt,setAttempt]=useState(0);
 useEffect(()=>{let live=true;setLoading(true);setError("");void userSession.request("/members/me/boards").then(value=>{if(live)setBoards(parseBoards(value,true));}).catch(e=>{if(live)setError(e instanceof Error?e.message:"폴더를 불러오지 못했습니다.");}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[attempt]);
 const rows=flattenBoards(boards);
 return <section className="post-classification" aria-label={label}><div className="post-classification-field"><label htmlFor={id}>{label}</label><select id={id} value={boardId??""} onChange={e=>onChange(e.target.value||null)}><option value="">미분류</option>{boardId&&!rows.some(row=>row.id===boardId)&&<option value={boardId}>기존 폴더 ({boardId})</option>}{rows.map(row=><option key={row.id} value={row.id}>{"　".repeat(row.depth)}{row.name}</option>)}</select>
 {loading&&<p role="status">폴더를 불러오는 중…</p>}{error&&<p role="alert">{error} 기존 연결은 유지됩니다. <button type="button" onClick={()=>setAttempt(n=>n+1)}>폴더 다시 불러오기</button></p>}{!loading&&!error&&!rows.length&&<p>아직 폴더가 없어요. 미분류로 저장할 수 있습니다.</p>}<Link href="/me/boards" target="_blank" rel="noopener noreferrer">폴더 관리 열기</Link></div></section>;
}
