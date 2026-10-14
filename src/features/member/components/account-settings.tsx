"use client";
import {useState} from "react";
import {MemberGate} from "@/features/auth/components/member-gate";
import {NaverLoginButton} from "@/features/auth/components/naver-login-button";
function Withdrawal() {
 const [confirm,setConfirm]=useState(false);
 return <section className="withdrawal-screen"><h1>설정</h1><h2>탈퇴하기</h2><p>탈퇴 인증을 완료하면 네이버 연결이 즉시 해제되고 로그아웃됩니다. 블로그와 콘텐츠는 바로 숨겨지며 7일 후 영구 삭제됩니다.</p><p>삭제 예정일 전에 같은 네이버 계정으로 다시 로그인하면 계정이 복구되고 탈퇴 예약이 자동으로 취소됩니다.</p>{!confirm?<div className="withdrawal-actions"><button className="button withdrawal-danger" onClick={()=>setConfirm(true)}>탈퇴하기</button></div>:<div role="group" aria-label="회원 탈퇴 예약 확인"><p>네이버 인증을 진행할까요? 인증을 완료한 뒤 7일이 지나면 계정과 콘텐츠를 복구할 수 없습니다.</p><div className="withdrawal-actions"><NaverLoginButton mode="withdrawal" label="네이버 인증 후 탈퇴" className="button withdrawal-danger"/><button className="button" onClick={()=>setConfirm(false)}>취소</button></div></div>}</section>;
}
export function AccountSettings(){return <MemberGate profile>{member=><Withdrawal key={member.id}/>}</MemberGate>;}
