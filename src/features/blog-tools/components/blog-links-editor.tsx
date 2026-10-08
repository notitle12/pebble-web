"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Member } from "@/features/auth/user-session";
import { userSession } from "@/features/auth/user-session";
import { MemberApiError } from "@/lib/member-api";
import { parseBlogLinks, validateBlogLinkDraft, type BlogLinkDraft, type BlogLinks } from "../api/blog-tools";

type DraftSite = BlogLinkDraft & { localKey: string; logoUrl: string | null; file: File | null };
const MAX_LOGO = 2 * 1024 * 1024;
const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];
let nextKey = 0;
function draftFrom(links: BlogLinks): DraftSite[] {
  return links.sites.map(site => ({ id: site.id, localKey: `saved-${site.id}`, label: site.label, url: site.url, logoUrl: site.logoUrl, file: null }));
}
function errorText(error: unknown) {
  return error instanceof Error ? error.message : "외부 링크를 처리하지 못했습니다.";
}

export function BlogLinksEditor({ member }: { member: Member }) {
  const [saved, setSaved] = useState<BlogLinks | null>(null);
  const [githubUrl, setGithubUrl] = useState("");
  const [sites, setSites] = useState<DraftSite[]>([]);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const mounted = useRef(false);
  const busyRef = useRef(false);

  function currentMember() {
    const current = userSession.snapshot();
    return mounted.current && current.phase === "ready" && current.member?.id === member.id;
  }
  function apply(links: BlogLinks) {
    setSaved(links); setGithubUrl(links.githubUrl ?? ""); setSites(draftFrom(links));
    setUncertain(false); setError("");
  }
  async function load() {
    if (!currentMember()) return;
    setError("");
    try {
      const response = await userSession.request("/members/me/blog-links");
      if (!currentMember()) return;
      apply(parseBlogLinks(response));
    }
    catch (cause) { if (currentMember()) setError(errorText(cause)); }
  }
  useEffect(() => {
    mounted.current = true;
    void load();
    return () => { mounted.current = false; };
  }, [member.id]);

  function changeSite(localKey: string, patch: Partial<DraftSite>) {
    setSites(old => old.map(site => site.localKey === localKey ? { ...site, ...patch } : site));
    setNotice("");
  }
  function chooseLogo(localKey: string, file: File | undefined) {
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type) || file.size > MAX_LOGO) {
      setError("PNG, JPEG, WebP 로고만 선택할 수 있어요. 파일은 2MiB 이하로 올려 주세요.");
      return;
    }
    setError(""); changeSite(localKey, { file });
  }
  function cancel() {
    if (saved) apply(saved);
    setNotice("");
  }
  async function reloadAfterUnknown() {
    if (busyRef.current || !currentMember()) return;
    busyRef.current = true; setBusy(true); setError("");
    try {
      const response = await userSession.request("/members/me/blog-links");
      if (!currentMember()) return;
      apply(parseBlogLinks(response)); setNotice("서버에 저장된 외부 링크를 다시 불러왔어요.");
    }
    catch (cause) { if (currentMember()) setError(errorText(cause)); }
    finally { busyRef.current = false; if (mounted.current) setBusy(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current || uncertain || !currentMember()) return;
    const linkDrafts = sites.map(({ id, label, url }) => ({ ...(id ? { id } : {}), label: label.trim(), url: url.trim() }));
    const validation = validateBlogLinkDraft(githubUrl, linkDrafts);
    if (validation) { setError(validation); return; }
    if (sites.some(site => !site.id && !site.file)) { setError("새 사이트에는 로고를 올려 주세요."); return; }
    busyRef.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const links = { githubUrl: githubUrl.trim() || null, sites: linkDrafts };
      const form = new FormData();
      form.append("links", JSON.stringify(links));
      sites.forEach((site, index) => { if (site.file) form.append(`logo${index}`, site.file); });
      const hasFiles = sites.some(site => site.file !== null);
      await userSession.request("/members/me/blog-links", { method: "PUT", body: hasFiles ? form : links });
      if (!currentMember()) return;
      const latest = parseBlogLinks(await userSession.request("/members/me/blog-links"));
      if (!currentMember()) return;
      apply(latest); setNotice("외부 링크를 저장했습니다.");
    } catch (cause) {
      if (!currentMember()) return;
      const knownRejection = cause instanceof MemberApiError && cause.status >= 400 && cause.status < 500;
      if (knownRejection) setError(errorText(cause));
      else { setUncertain(true); setError("저장 결과를 확인하지 못했습니다. 다시 저장하지 말고 서버 상태를 불러와 확인해 주세요."); }
    } finally { busyRef.current = false; if (mounted.current) setBusy(false); }
  }

  const disabled = busy || uncertain || !saved;
  return <section className="profile-screen blog-links-editor" aria-labelledby="blog-links-heading">
    <header className="profile-heading"><div><p className="profile-eyebrow">블로그 공개 정보</p><h2 id="blog-links-heading">외부 링크</h2></div></header>
    {!saved && !error ? <p role="status">링크 설정을 불러오고 있어요.</p> : null}
    {saved && <form className="search-panel profile-form blog-links-form" onSubmit={submit}>
      <fieldset disabled={busy || uncertain}>
        <legend>GitHub와 사이트</legend>
        <div className="search-field"><label htmlFor="blog-github-url">깃허브 링크</label><input id="blog-github-url" type="url" inputMode="url" maxLength={2048} placeholder="https://github.com/username" value={githubUrl} onChange={event => { setGithubUrl(event.target.value); setNotice(""); }}/><p className="profile-help">github.com 프로필 주소를 입력해 주세요.</p></div>
        <div className="blog-site-editor-heading"><h3>사이트 링크</h3><button className="button" type="button" disabled={busy || uncertain || sites.length >= 5} onClick={() => { setSites(old => [...old, { localKey: `new-${++nextKey}`, label: "", url: "", logoUrl: null, file: null }]); setNotice(""); }}>사이트 추가</button></div>
        {sites.map((site, index) => <fieldset className="blog-site-draft" key={site.localKey}>
          <legend>사이트 {index + 1}</legend>
          <div className="search-field"><label htmlFor={`blog-site-label-${site.localKey}`}>표시 이름</label><input id={`blog-site-label-${site.localKey}`} required minLength={1} maxLength={50} value={site.label} onChange={event => changeSite(site.localKey, { label: event.target.value })}/></div>
          <div className="search-field"><label htmlFor={`blog-site-url-${site.localKey}`}>사이트 주소</label><input id={`blog-site-url-${site.localKey}`} type="url" required maxLength={2048} inputMode="url" value={site.url} onChange={event => changeSite(site.localKey, { url: event.target.value })}/></div>
          <div className="blog-site-logo"><label htmlFor={`blog-site-logo-${site.localKey}`}>로고 (PNG, JPEG, WebP · 2MiB 이하)</label>{site.file ? <span>{site.file.name}</span> : site.logoUrl ? <img src={site.logoUrl} alt={`${site.label || `사이트 ${index + 1}`} 로고 미리보기`}/> : <span>로고가 없습니다.</span>}<input id={`blog-site-logo-${site.localKey}`} type="file" accept="image/png,image/jpeg,image/webp" onChange={event => chooseLogo(site.localKey, event.target.files?.[0])}/>{site.id && <p className="profile-help">기존 로고를 유지하려면 파일을 선택하지 마세요.</p>}</div>
          <button className="button" type="button" disabled={busy || uncertain} onClick={() => { setSites(old => old.filter(item => item.localKey !== site.localKey)); setNotice(""); }}>사이트 삭제</button>
        </fieldset>)}
      </fieldset>
      {error && <p className="profile-error" role="alert">{error}</p>}{notice && <p className="profile-notice" role="status">{notice}</p>}
      <div className="profile-actions">{uncertain ? <button className="button" type="button" disabled={busy} onClick={() => void reloadAfterUnknown()}>{busy ? "확인 중…" : "서버 상태 다시 불러오기"}</button> : <button className="button profile-primary" type="submit" disabled={disabled}>{busy ? "저장 중…" : "외부 링크 저장"}</button>}<button className="button" type="button" disabled={busy || uncertain || !saved} onClick={cancel}>취소</button></div>
    </form>}
    {!saved && error && <div className="list-state"><p role="alert">{error}</p><button className="button" type="button" onClick={() => void load()}>다시 불러오기</button></div>}
  </section>;
}
