"use client";
import {useRef,useState} from "react";
import Link from "next/link";
import {MemberGate} from "@/features/auth/components/member-gate";
import {userSession,type Member} from "@/features/auth/user-session";
import {formatSeoulDateTime} from "@/lib/date-time";
function Withdrawal({member,onComplete}:{member:Member;onComplete:(date:string)=>void}) {
 const [confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");const lock=useRef(false);
 return <section className="withdrawal-screen"><h1>설정</h1><h2>탈퇴하기</h2><p>탈퇴를 예약하면 즉시 로그아웃되며 블로그와 콘텐츠가 숨겨집니다. 7일 이내에 같은 네이버 계정으로 재인증해 취소할 수 있습니다. 7일이 지나면 계정과 콘텐츠가 영구 삭제됩니다.</p>{!confirm?<div className="withdrawal-actions"><button className="button withdrawal-danger" onClick={()=>setConfirm(true)}>탈퇴하기</button></div>:<div role="group" aria-label="회원 탈퇴 예약 확인"><p>탈퇴 예약을 진행할까요? 예약 후 7일이 지나면 계정과 콘텐츠를 복구할 수 없습니다.</p><div className="withdrawal-actions"><button className="button withdrawal-danger" disabled={busy} onClick={async()=>{
  if(lock.current||userSession.snapshot().phase!=="ready"||userSession.snapshot().member?.id!==member.id)return;lock.current=true;setBusy(true);setError("");
  try{onComplete(await userSession.withdraw());}catch(error){setError(error instanceof Error?error.message:"탈퇴 예약 결과를 확인하지 못했습니다.");}finally{lock.current=false;setBusy(false);}
 }}>{busy?"처리 중…":"탈퇴"}</button><button className="button" disabled={busy} onClick={()=>setConfirm(false)}>취소</button></div>{error&&<p role="alert">{error}</p>}</div>}</section>;
}
export function AccountSettings(){const [date,setDate]=useState("");if(date)return <section className="withdrawal-screen"><h1>탈퇴를 예약했어요</h1><p>삭제 예정: {formatSeoulDateTime(date)}</p><Link className="button" href="/withdrawal/cancel">탈퇴 예약 취소</Link></section>;return <MemberGate profile>{member=><Withdrawal key={member.id} member={member} onComplete={setDate}/>}</MemberGate>;}
