"use client";
import {useRef,useState} from "react";
import Link from "next/link";
import {MemberGate} from "@/features/auth/components/member-gate";
import {userSession,type Member} from "@/features/auth/user-session";
function Withdrawal({member,onComplete}:{member:Member;onComplete:(date:string)=>void}) {
 const [confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");const lock=useRef(false);
 return <section className="list-state"><h2>계정 관리</h2><Link href="/withdrawal/cancel">탈퇴 예약 취소 안내</Link>{!confirm?<button className="button" onClick={()=>setConfirm(true)}>탈퇴 예약</button>:<div role="group" aria-label="회원 탈퇴 예약 확인"><p>탈퇴를 예약하면 즉시 로그아웃되며 블로그와 콘텐츠가 숨겨집니다. 7일 이내에 같은 네이버 계정으로 재인증하여 취소할 수 있고, 7일 이후에는 계정과 콘텐츠가 영구 삭제됩니다.</p><button className="button" disabled={busy} onClick={async()=>{
  if(lock.current||userSession.snapshot().phase!=="ready"||userSession.snapshot().member?.id!==member.id)return;lock.current=true;setBusy(true);setError("");
  try{onComplete(await userSession.withdraw());}catch(error){setError(error instanceof Error?error.message:"탈퇴 예약 결과를 확인하지 못했습니다.");}finally{lock.current=false;setBusy(false);}
 }}>{busy?"예약 중…":"탈퇴 예약 확정"}</button><button className="button" disabled={busy} onClick={()=>setConfirm(false)}>돌아가기</button>{error&&<p role="alert">{error}</p>}</div>}</section>;
}
export function AccountSettings(){const [date,setDate]=useState("");if(date)return <section className="list-state"><h2>탈퇴를 예약했어요</h2><p>삭제 예정: {new Date(date).toLocaleString("ko-KR")}</p><Link className="button" href="/withdrawal/cancel">탈퇴 예약 취소</Link></section>;return <MemberGate>{member=><Withdrawal key={member.id} member={member} onComplete={setDate}/>}</MemberGate>;}
