"use client";
import {useRef,useState} from "react";
import {LoadingIndicator} from "@/components/loading-state";
import {useRouter} from "next/navigation";
import {MemberGate} from "@/features/auth/components/member-gate";
import {userSession,type Member} from "@/features/auth/user-session";
import {withdrawalConfirmation} from "../withdrawal-confirmation";

function Withdrawal({member,onDeleted,onPending}:{member:Member;onDeleted:()=>void;onPending:(pending:boolean)=>void}) {
 const router=useRouter();
 const [confirmation,setConfirmation]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const submitting=useRef(false);
 const expected=withdrawalConfirmation(member.blogName);
 return <section className="withdrawal-screen"><h1>회원 탈퇴</h1>
  <p className="withdrawal-warning" id="withdrawal-warning">탈퇴하면 계정과 작성한 글·프로젝트·댓글 등 계정 데이터가 삭제되며 복구할 수 없습니다.</p>
  <form className="withdrawal-confirmation" aria-describedby="withdrawal-warning" aria-busy={busy} onSubmit={async event=>{
   event.preventDefault();if(submitting.current||confirmation!==expected)return;
   submitting.current=true;onPending(true);setBusy(true);setError("");
   try{await userSession.withdraw(confirmation,member.id);onDeleted();}
   catch(e){setError(e instanceof Error?e.message:"탈퇴 결과를 확인하지 못했습니다. 새로고침해 계정 상태를 확인해 주세요.");}
   finally{submitting.current=false;setBusy(false);onPending(false);}
  }}>
   <label htmlFor="withdrawal-confirmation">아래 문구를 그대로 입력해 주세요.</label>
   <p className="withdrawal-confirmation-phrase">{expected}</p>
   <input id="withdrawal-confirmation" aria-label="탈퇴 확인 문구" value={confirmation} onChange={event=>setConfirmation(event.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false} disabled={busy} maxLength={300}/>
   {error&&<p role="alert">{error}</p>}
   <div className="withdrawal-actions"><button className="button withdrawal-danger" disabled={busy||confirmation!==expected}>{busy?"탈퇴 처리 중…":"확인하고 탈퇴"}</button><button type="button" className="button" disabled={busy} onClick={()=>router.back()}>취소</button></div>
  </form>
 </section>;
}
export function AccountSettings(){
 const router=useRouter();
 const [pending,setPending]=useState(false),[deleted,setDeleted]=useState(false);
 if(deleted)return <LoadingIndicator section label="메인으로 이동하는 중"/>;
 // 탈퇴 성공 직후 guest 전환이 완료 콜백보다 먼저 전달되어도 로그인 창을 열지 않는다.
 return <MemberGate requireAgreements={false} fallback={pending?<LoadingIndicator section label="탈퇴 결과를 확인하는 중"/>:undefined}>{member=><Withdrawal key={member.id} member={member} onPending={setPending} onDeleted={()=>{setDeleted(true);router.replace("/");}}/>}</MemberGate>;
}
