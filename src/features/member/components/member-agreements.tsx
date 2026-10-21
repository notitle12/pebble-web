"use client";
import { useEffect, useState, useRef, type ReactNode, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MemberApiError } from "@/lib/member-api";
import { openLoginDialog } from "@/features/auth/components/login-dialog";
import { loginDestination } from "@/features/auth/login-destination";
import { useUserSession } from "@/features/auth/components/member-gate";
import { userSession } from "@/features/auth/user-session";
import { AgeConfirmationControl } from "./age-confirmation-control";
import { isCurrentMemberAgreement, memberAgreementAcceptance, memberAgreementVersions, parseMemberAgreementState, type MemberAgreementState } from "../agreements-model";

export function MemberAgreements({ documentsReady = false, termsContent, privacyContent }: { documentsReady?: boolean; termsContent?: ReactNode; privacyContent?: ReactNode }) {
  const session = useUserSession();
  const params = useSearchParams();
  const router = useRouter();
  const memberId = session.phase === "ready" ? session.member?.id ?? null : null;
  const destination = loginDestination(params.get("returnTo"));
  const [state, setState] = useState<MemberAgreementState | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [document, setDocument] = useState<"terms" | "privacy" | null>(null);
  const documentDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = documentDialog.current;
    if (document && dialog && !dialog.open) { dialog.showModal(); dialog.querySelector(".agreement-document-scroll")?.scrollTo(0, 0); }
    else if (!document && dialog?.open) dialog.close();
  }, [document]);

  useEffect(() => {
    if (!memberId) return;
    let live = true;
    const id = memberId;
    setState(null); setError(""); setTermsAccepted(false); setPrivacyAccepted(false); setAgeConfirmed(false);
    void userSession.request("/members/me/agreements").then(value => {
      const parsed = parseMemberAgreementState(value);
      const current = userSession.snapshot();
      if (live && current.phase === "ready" && current.member?.id === id) setState(parsed);
    }).catch(e => {
      const current = userSession.snapshot();
      if (live && current.phase === "ready" && current.member?.id === id) setError(e instanceof Error ? e.message : "약관 상태를 불러오지 못했습니다.");
    });
    return () => { live = false; };
  }, [memberId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!memberId || !termsAccepted || !privacyAccepted || !ageConfirmed || busy) return;
    if (!documentsReady || !state?.available) { setError("현재 이용 동의 내용을 확인할 수 없습니다. 잠시 후 다시 방문해 주세요."); return; }
    const starting = userSession.snapshot();
    if (starting.phase !== "ready" || starting.member?.id !== memberId) { setError("로그인 상태가 변경되었습니다. 다시 확인해 주세요."); return; }
    setBusy(true); setError("");
    try {
      const result = parseMemberAgreementState(await userSession.request("/members/me/agreements", { method: "POST", body: memberAgreementAcceptance }));
      if (!result.available || !isCurrentMemberAgreement(result)) throw new MemberApiError(0, "INVALID_RESPONSE", "약관 동의 결과를 확인하지 못했습니다.");
      const beforeReload = userSession.snapshot();
      if (beforeReload.phase !== "ready" || beforeReload.member?.id !== memberId) return;
      await userSession.reloadMember();
      const latest = userSession.snapshot();
      if (latest.phase !== "ready" || latest.member?.id !== memberId) return;
      if (!latest.member.agreementsAccepted) { setError("현재 계정의 동의 상태를 확인하지 못했습니다. 다시 확인해 주세요."); return; }
      const next = latest.member.profileCompleted ? destination : `/settings/profile?returnTo=${encodeURIComponent(destination)}`;
      router.replace(next);
    } catch (e) {
      const current = userSession.snapshot();
      if (current.phase === "ready" && current.member?.id === memberId) setError(e instanceof Error ? e.message : "동의를 저장하지 못했습니다.");
    } finally { setBusy(false); }
  }

  if (session.phase === "loading") return <section className="list-state" role="status">로그인 상태를 확인하고 있어요.</section>;
  if (session.phase !== "ready" || !session.member) return <section className="list-state"><h1>로그인이 필요해요</h1><p>{session.message || "로그인 후 약관 동의를 진행할 수 있습니다."}</p><button type="button" className="button" onClick={() => openLoginDialog("/agreements")}>로그인</button></section>;
  if (session.member.agreementsAccepted && state && isCurrentMemberAgreement(state)) return <section className="list-state"><h1>동의가 완료되었습니다</h1><p>필요한 서비스 기능을 이용할 수 있습니다.</p><Link className="button" href={session.member.profileCompleted ? destination : `/settings/profile?returnTo=${encodeURIComponent(destination)}`}>계속</Link></section>;
  if (!documentsReady || (state && !state.available)) return <section className="list-state"><h1>서비스 이용 동의를 준비하고 있어요</h1><p>약관 확인을 마친 뒤 다시 방문해 주세요.</p><p className="agreement-withdrawal"><Link href="/settings/account">계정 설정에서 탈퇴</Link>하거나 <button type="button" className="agreement-text-button" onClick={() => void userSession.logout()}>로그아웃</button>할 수 있습니다.</p></section>;

  return <section className="member-agreements list-state" aria-labelledby="agreements-title">
    <h1 id="agreements-title">서비스 이용 동의</h1>
    <p>서비스를 이용하려면 이용약관과 개인정보 수집·이용에 각각 동의해 주세요.</p>
    <p className="agreement-versions">이용약관 {memberAgreementVersions.termsVersion} · 개인정보 수집·이용 {memberAgreementVersions.privacyVersion}</p>
    <div className="agreement-summary" aria-label="동의 전 확인할 내용"><h2>동의 전에 확인해 주세요</h2><ul><li>네이버가 제공한 출생연도와 생일로 만 14세 이상인지 확인합니다. 나이 확인에 사용한 생년 정보는 저장하지 않습니다.</li><li>네이버에서는 계정을 구분하는 회원번호와 닉네임을 받습니다. 프로필 사진은 원할 때 직접 등록할 수 있습니다.</li><li>계정 정보와 직접 작성한 글·프로젝트·사진 등은 서비스 제공에 사용됩니다.</li><li>탈퇴가 완료되면 회원 정보와 작성한 내용을 사용 중인 서비스에서 즉시 삭제합니다. 관련 사진 파일도 순차적으로 삭제합니다.</li><li>동의하지 않으면 회원 기능을 이용할 수 없지만 공개 콘텐츠는 계속 둘러볼 수 있습니다.</li></ul></div>
    {error && <p className="agreement-error" role="alert">{error}</p>}
    {state?.accepted && !isCurrentMemberAgreement(state) && <p role="status">현재 약관 버전의 동의가 필요합니다.</p>}
    {!state ? error ? <p><button type="button" className="button" onClick={() => window.location.reload()}>다시 불러오기</button></p> : <p role="status">약관 상태를 불러오고 있어요.</p> : <form onSubmit={submit} className="agreement-form">
      <label className="agreement-check"><input type="checkbox" required checked={termsAccepted} onChange={event => setTermsAccepted(event.target.checked)} /><span><button type="button" className="agreement-document-open" onClick={()=>setDocument("terms")}>이용약관</button>에 동의합니다. (필수)</span></label>
      <label className="agreement-check"><input type="checkbox" required checked={privacyAccepted} onChange={event => setPrivacyAccepted(event.target.checked)} /><span><button type="button" className="agreement-document-open" onClick={()=>setDocument("privacy")}>개인정보 수집·이용 안내</button>에 동의합니다. (필수)</span></label>
      <AgeConfirmationControl checked={ageConfirmed} onChange={setAgeConfirmed}/>
      <button className="button" type="submit" disabled={busy || !termsAccepted || !privacyAccepted || !ageConfirmed}>{busy ? "저장 중…" : "동의하고 계속"}</button>
    </form>}
    <dialog ref={documentDialog} className="agreement-document-dialog" aria-labelledby="agreement-document-title" onCancel={()=>setDocument(null)} onClose={()=>setDocument(null)}>
      <div className="agreement-document-scroll legal-document"><h2 id="agreement-document-title">{document==="terms"?"이용약관":"개인정보 수집·이용 안내"}</h2>{document==="terms"?termsContent:privacyContent}</div>
      <div className="agreement-document-actions"><button type="button" className="button" onClick={()=>setDocument(null)}>돌아가기</button><button type="button" className="button" disabled={busy} onClick={()=>{if(document==="terms")setTermsAccepted(true);if(document==="privacy")setPrivacyAccepted(true);setDocument(null);}}>동의하고 돌아가기</button></div>
    </dialog>
    <p className="agreement-withdrawal">동의하지 않으시면 <Link href="/settings/account">계정 설정에서 탈퇴</Link>하실 수 있습니다.</p>
  </section>;
}
