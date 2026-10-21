"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useUserSession } from "@/features/auth/components/member-gate";
import { openLoginDialog } from "@/features/auth/components/login-dialog";
import { memberRequiresAgreement, userSession, type SessionState } from "@/features/auth/user-session";
import { MemberApiError } from "@/lib/member-api";
import { reportReasons, reportContent, reportTargetLabels, type ReportReason, type ReportSubject } from "../api";
import styles from "./report-button.module.css";

export function ReportButton(props: ReportSubject) {
  const session = useUserSession();
  const scope = session.phase === "ready" ? session.member?.id : session.phase;
  return <ReportForm key={`${props.target}:${props.contentId}:${props.targetId ?? ""}:${scope}`} {...props} session={session}/>;
}
function ReportForm({ target, contentId, targetId, session }: ReportSubject & { session: SessionState }) {
  const path = usePathname();
  const titleId = useId(), helpId = useId();
  const dialog = useRef<HTMLDialogElement>(null), writing = useRef(false), mounted = useRef(false);
  const [reason, setReason] = useState<ReportReason>("PRIVACY"), [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [success, setSuccess] = useState(false), [needsAgreement, setNeedsAgreement] = useState(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; dialog.current?.close(); }; }, []);
  function open() {
    const current = userSession.snapshot();
    if (current.phase !== "ready" || !current.member) { openLoginDialog(path); return; }
    if (memberRequiresAgreement(current.member)) { setNeedsAgreement(true); return; }
    setError(""); setSuccess(false); dialog.current?.showModal();
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (writing.current) return;
    const current = userSession.snapshot();
    if (current.phase !== "ready" || !current.member) { dialog.current?.close(); openLoginDialog(path); return; }
    if (memberRequiresAgreement(current.member)) { dialog.current?.close(); setNeedsAgreement(true); return; }
    writing.current = true; setBusy(true); setError("");
    try {
      await reportContent({ target, contentId, targetId }, reason, detail, (url, options) => userSession.request(url, options));
      if (mounted.current) { setSuccess(true); setDetail(""); }
    } catch (error) {
      if (mounted.current) setError(error instanceof MemberApiError && error.status > 0 ? error.message : "신고 결과를 확인하지 못했어요. 다시 제출해도 중복 접수되지 않습니다.");
    } finally { writing.current = false; if (mounted.current) setBusy(false); }
  }
  return <div className={styles.action}>
    <button type="button" className={styles.trigger} aria-haspopup="dialog" disabled={session.phase === "loading"} onClick={open}>신고</button>
    {needsAgreement && <p role="status">신고하려면 <Link href={`/agreements?returnTo=${encodeURIComponent(path)}`}>서비스 이용 동의</Link>가 필요해요.</p>}
    <dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId} aria-describedby={helpId} onCancel={event => { if (writing.current) event.preventDefault(); }}>
      <h2 id={titleId}>{reportTargetLabels[target]} 신고</h2>
      <p id={helpId}>신고 사유를 알려 주세요. 같은 콘텐츠를 다시 신고해도 중복 접수되지 않습니다.</p>
      {success ? <><p role="status">신고가 접수되었습니다.</p><div className={styles.actions}><button type="button" className="button" onClick={() => dialog.current?.close()}>닫기</button></div></> : <form className={styles.form} onSubmit={submit} aria-busy={busy}>
        <label>신고 사유<select value={reason} disabled={busy} onChange={event => setReason(event.target.value as ReportReason)}>{reportReasons.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label>상세 내용 {reason === "OTHER" ? "(필수)" : "(선택)"}<textarea value={detail} disabled={busy} required={reason === "OTHER"} onChange={event => setDetail(event.target.value)} aria-describedby={`${helpId}-count`}/></label>
        <span id={`${helpId}-count`} className={styles.counter}>{Array.from(detail).length.toLocaleString("ko-KR")} / 1,000자</span>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {busy && <p role="status">신고를 접수하고 있어요.</p>}
        <div className={styles.actions}><button type="button" className="button" disabled={busy} onClick={() => dialog.current?.close()}>취소</button><button type="submit" className="button" disabled={busy}>신고하기</button></div>
      </form>}
    </dialog>
  </div>;
}
