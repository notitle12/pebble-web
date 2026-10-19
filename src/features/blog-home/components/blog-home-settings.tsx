"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { MemberGate } from "../../auth/components/member-gate";
import { userSession, type Member } from "../../auth/user-session";
import { HOME_SECTION_KEYS, defaultBlogHomeSettings, getMyBlogHome, normalizeTechStacks, saveMyBlogHome, type BlogHomeSettings, type HomeSectionKey } from "../api/blog-home";

import Link from "next/link";
import {useRegionDrag} from "./use-region-drag";
import { TechStackPicker } from "./tech-stack-picker";

const label: Record<HomeSectionKey, string> = { ACTIVITY: "블로그 활동", TECH_STACKS: "기술 스택", PROJECTS: "대표 프로젝트", RECENT_POSTS: "인기 글 (공감순)" };
function Editor({ member }: { member: Member }) {
  const [saved, setSaved] = useState<BlogHomeSettings | null>(null);
  const [draft, setDraft] = useState<BlogHomeSettings>(defaultBlogHomeSettings());
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const savingRef = useRef(false);
  useEffect(() => {
    let live=true;setLoading(true);setError("");
    getMyBlogHome(path=>userSession.request(path)).then(home=>{if(live){setSaved(home);setDraft(home);}})
      .catch(()=>{if(live)setError("홈 구성을 불러오지 못했어요. 다시 시도해 주세요.");})
      .finally(()=>{if(live)setLoading(false);});
    return()=>{live=false;};
  },[member.id,loadAttempt]);
  const dirty = useMemo(() => JSON.stringify(saved) !== JSON.stringify(draft), [saved, draft]);
  function update(change: (current: BlogHomeSettings) => BlogHomeSettings) { setDraft(current => change(current)); setNotice(""); }
  const sectionDrag=useRegionDrag("data-home-section",saving,(source,target)=>update(current=>{const sections=[...current.sections],from=sections.findIndex(s=>s.key===source),to=sections.findIndex(s=>s.key===target);if(from<0||to<0||from===to)return current;const [section]=sections.splice(from,1);sections.splice(to,0,section);return {...current,sections};}));
  async function submit(event: React.FormEvent) { event.preventDefault(); if (savingRef.current || !dirty) return; savingRef.current = true; setSaving(true); setError(""); setNotice(""); try { const next = await saveMyBlogHome({ ...draft, techStacks: normalizeTechStacks(draft.techStacks) }, (path, options) => userSession.request(path, options)); setSaved(next); setDraft(next); setNotice("홈 구성을 저장했어요."); } catch (e) { setError(e instanceof Error ? e.message : "저장하지 못했어요. 입력 내용을 유지했으니 다시 시도해 주세요."); } finally { savingRef.current = false; setSaving(false); } }
  return <section className="blog-home-settings" aria-labelledby="home-settings-title"><p className="profile-eyebrow">{member.blogName ?? "Pebble"}</p><h1 id="home-settings-title">홈 구성</h1><p className="blog-management-intro">공개 블로그 홈에 보여줄 항목과 순서를 정합니다.</p>
    {loading ? <p role="status">홈 구성을 불러오고 있어요.</p> : saved === null ? <div className="blog-home-error"><p role="alert">{error}</p><button className="button" type="button" onClick={() => { setError(""); setLoadAttempt(value => value + 1); }}>다시 불러오기</button></div> : <form onSubmit={submit}>
      {error && <p className="blog-home-error" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
      <fieldset><legend>홈 섹션</legend><p>표시할 섹션을 고르고 영역을 드래그해 순서를 바꾸세요.</p><ol className="home-section-order">{draft.sections.map(section=><li key={section.key} data-home-section={section.key} {...sectionDrag.props(section.key)}><input type="checkbox" aria-label={`${label[section.key]} 표시`} checked={section.visible} disabled={saving} onChange={event=>update(current=>({...current,sections:current.sections.map(item=>item.key===section.key?{...item,visible:event.target.checked}:item)}))}/><span>{label[section.key]}</span></li>)}</ol></fieldset>
      <fieldset><legend>블로그 활동 기본 보기</legend><div className="activity-choice">{(["GRASS","STONES"] as const).map(value=><label key={value}><input type="radio" name="activityDisplay" checked={(draft.activityDisplay??"GRASS")===value} disabled={saving} onChange={()=>update(current=>({...current,activityDisplay:value}))}/>{value==="GRASS"?"잔디":"기록의 돌"}</label>)}</div><p>방문자는 잔디와 돌을 전환해서 볼 수 있어요.</p></fieldset>
      <TechStackPicker value={draft.techStacks} disabled={saving} onChange={techStacks=>update(current=>({...current,techStacks}))}/>
      <fieldset><legend>대표 프로젝트</legend><label htmlFor="featured-project-limit">홈에 표시할 개수</label><select id="featured-project-limit" value={draft.featuredProjectLimit??6} disabled={saving} onChange={event=>update(current=>({...current,featuredProjectLimit:Number(event.target.value)}))}>{[1,2,3,4,5,6].map(count=><option key={count} value={count}>{count}개</option>)}</select><p>대표 프로젝트는 <Link href="/me/projects">프로젝트 관리</Link>에서 최대 6개까지 지정하거나 해제할 수 있어요.</p></fieldset>
      <div className="home-settings-actions"><button className="button" type="submit" disabled={saving || !dirty}>{saving ? "저장 중…" : "변경 저장"}</button><button className="button" type="button" disabled={saving || !dirty} onClick={() => saved && setDraft(saved)}>변경 취소</button></div>
    </form>}</section>;
}
export function BlogHomeSettings() { return <MemberGate profile>{member => <Editor key={member.id} member={member}/>}</MemberGate>; }
