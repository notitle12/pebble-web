"use client";
import {useState} from "react";
import {MemberGate} from "@/features/auth/components/member-gate";
import {NaverLoginButton} from "@/features/auth/components/naver-login-button";
function Withdrawal() {
 const [confirm,setConfirm]=useState(false);
 return <section className="withdrawal-screen"><h1>설정</h1><h2>탈퇴하기</h2><p>네이버 본인 재인증을 마치면 회원 정보와 콘텐츠가 운영 데이터베이스에서 즉시 삭제되고 로그아웃됩니다. 관련 이미지 파일은 삭제 작업으로 회수됩니다. 탈퇴 후에는 계정이나 콘텐츠를 복구할 수 없습니다.</p>{!confirm?<div className="withdrawal-actions"><button className="button withdrawal-danger" onClick={()=>setConfirm(true)}>탈퇴하기</button></div>:<div role="group" aria-label="회원 탈퇴 최종 확인"><p>네이버 본인 재인증 후 계정과 콘텐츠를 즉시 삭제합니다. 이 작업은 취소하거나 되돌릴 수 없습니다. 계속 진행할까요?</p><div className="withdrawal-actions"><NaverLoginButton mode="withdrawal" label="재인증 후 즉시 탈퇴" className="button withdrawal-danger"/><button className="button" onClick={()=>setConfirm(false)}>취소</button></div></div>}</section>;
}
export function AccountSettings(){return <MemberGate requireAgreements={false}>{member=><Withdrawal key={member.id}/>}</MemberGate>;}
