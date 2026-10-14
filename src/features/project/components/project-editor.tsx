"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { TechStackSelection } from "../../tech-stack/components/tech-stack-selection";
import { RichBodyEditor } from "../../post/components/rich-body-editor";
import { PostBody } from "../../post/components/post-body";
import type { EditorBlock } from "../../post/post-editor-model";
import type { ProjectTechStack } from "../api/member-projects";
import type { LinkInput, ProjectEditorValue, ProjectVisibility } from "../project-editor-model";
import { PROJECT_SECTIONS, PROJECT_TEAM_ROLES, PROJECT_ROLE_OPTIONS, type TeamRole, type ProjectSectionKey } from "../project-document";
import styles from "./project-editor.module.css";

type Props = {
  value: ProjectEditorValue;
  onChange: (value: ProjectEditorValue) => void;
  busy: boolean;
  visibility: ProjectVisibility;
  blocked: boolean;
  existingTechStacks?: ProjectTechStack[];
  onSave: (visibility: ProjectVisibility) => Promise<void>;
  onTemporarySave?: () => Promise<void>;
  uploadImage?: (file: File) => Promise<{src: string; previewUrl: string}>;
  imagePreviews?: Record<string, string>;
  coverElement?: ReactNode;
};
const linkTypes: { value: LinkInput["linkType"]; label: string }[] = [
  { value: "GITHUB", label: "GitHub" }, { value: "DEPLOYMENT", label: "배포" },
  { value: "DOWNLOAD", label: "다운로드" }, { value: "OTHER", label: "기타" },
];
const hasContent = (blocks: EditorBlock[]) => blocks.some(block => (block.type !== "HTML" && block.type !== "TEXT" && block.type !== "MARKDOWN") || block.content.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, "").trim() || /<(img|table|iframe)\b|data-pebble-type|data-(table|architecture|database)/i.test(block.content));

export function ProjectEditor({ value, onChange, busy, visibility, blocked, existingTechStacks = [], onSave, onTemporarySave, uploadImage, imagePreviews = {}, coverElement }: Props) {
  const id = useId();
  const currentValue = useRef(value);
  currentValue.current = value;
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [toolbarHost,setToolbarHost]=useState<HTMLDivElement|null>(null);
  const [activeSection,setActiveSection]=useState<ProjectSectionKey|null>("BACKGROUND");
  const [preview, setPreview] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [targetVisibility, setTargetVisibility] = useState<ProjectVisibility>(visibility);
  const [feedback, setFeedback] = useState("");
  const [publishError, setPublishError] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const sectionRefs = useRef<Record<string, HTMLDetailsElement | null>>({});
  const sections = PROJECT_SECTIONS.filter(section=>section.key!=="BACKGROUND");
  const [customRole,setCustomRole]=useState("");
  const [roleError,setRoleError]=useState("");
  const selectedRoles=value.document.roles??(value.document.role?[value.document.role]:[]);
  function changeTeam(role:TeamRole,count:number){
    const teamComposition=[...(value.document.teamComposition??[]).filter(item=>item.role!==role),...(count>0?[{role,count}]:[])];
    update("document",{...value.document,teamComposition,teamSize:teamComposition.reduce((sum,item)=>sum+item.count,0)||null});
  }
  function changeRoles(role:string){
    const roles=selectedRoles.includes(role)?selectedRoles.filter(item=>item!==role):[...selectedRoles,role];
    if(roles.length>10){setRoleError("역할은 최대 10개까지 선택해 주세요.");return;}
    setRoleError("");update("document",{...value.document,roles});
  }
  const backgroundEditor=<RichBodyEditor toolbarHost={toolbarHost} toolbarActive={!preview&&activeSection==="BACKGROUND"&&!closed.has("overview")} onActivate={()=>setActiveSection("BACKGROUND")} toolbarMode="inline" allowRepresentativeImage={false} blocks={value.document.sections.find(section=>section.key==="BACKGROUND")?.blocks??[]} onChangeBlocks={blocks=>updateBlocks("BACKGROUND",blocks)} uploadImage={uploadImage} imagePreviews={imagePreviews} disabled={busy}/>;

  const previewTechnologies = existingTechStacks.filter(tech => value.techStackIds.includes(tech.id));
  const unnamedTechnologyCount = value.techStackIds.length - previewTechnologies.length;
  useEffect(() => {
    if (publishing) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [publishing]);

  function update<K extends keyof ProjectEditorValue>(key: K, next: ProjectEditorValue[K]) {
    onChange({ ...currentValue.current, [key]: next });
  }
  function updateBlocks(key: ProjectSectionKey, blocks: EditorBlock[]) {
    const document = currentValue.current.document;
    const previous = document.sections.find(section => section.key === key);
    update("document", { ...document, sections: previous ? document.sections.map(section => section.key === key ? { ...section, blocks } : section) : [...document.sections, { key, blocks }] });
  }
  function changeFold(key: string, open: boolean) {
    if(key==="overview"&&!open&&activeSection==="BACKGROUND")setActiveSection(null);
    if(sections.some(section=>section.key===key)){if(open&&closed.has(key))setActiveSection(key as ProjectSectionKey);else if(!open)setActiveSection(previous=>previous===key?null:previous);}
    setClosed(previous => { const next = new Set(previous); if (open) next.delete(key); else next.add(key); return next; });
  }
  function jump(key: string) {
    setPreview(false);
    if(key==="overview")setActiveSection("BACKGROUND");
    if(sections.some(section=>section.key===key))setActiveSection(key as ProjectSectionKey);
    changeFold(key, true);
    requestAnimationFrame(() => sectionRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
  function checkedDate(input: HTMLInputElement, key: "startedOn" | "completedOn") {
    const date = input.value;
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > "9999-12-31" || date < "0001-01-01")) {
      input.value = currentValue.current[key];
      return;
    }
    update(key, date);
  }
  async function temporarySave() {
    setFeedback("");
    try { await onTemporarySave?.(); setFeedback("임시저장했어요."); } catch (error) { setFeedback(error instanceof Error ? error.message : "임시저장하지 못했어요. 다시 시도해 주세요."); }
  }
  async function publish(event: React.FormEvent) {
    event.preventDefault();
    if (blocked && targetVisibility === "PUBLIC" && visibility !== "PUBLIC") return;
    setPublishError("");
    try { await onSave(targetVisibility); setPublishing(false); } catch (error) { setPublishError(error instanceof Error ? error.message : "발행하지 못했어요. 입력 내용을 확인하고 다시 시도해 주세요."); }
  }
  const details = (key: string, title: string, content: ReactNode, hint?: string) => <details key={key} ref={element => { sectionRefs.current[key] = element; }} id={`${id}-${key}`} className={styles.section} open={!closed.has(key)} onToggle={event => changeFold(key, event.currentTarget.open)}>
    <summary><span>{title}</span>{hint && <small>{hint}</small>}<svg aria-hidden="true" viewBox="0 0 20 20"><path d="m5 8 5 5 5-5" /></svg></summary>
    <div className={styles.sectionBody}>{content}</div>
  </details>;

  return <div className={`${styles.editor} writer-composer`}>
    <footer className={`${styles.toolbar} writer-action-bar`} aria-label="프로젝트 저장 및 발행">
      <button type="button" className="writer-exit" disabled={busy} onClick={()=>window.location.assign("/me/projects")}>나가기</button>
      <span className={styles.saveState} role="status">{busy ? "저장 중…" : feedback || "프로젝트를 자유롭게 기록해 보세요."}</span>
      <div className={styles.actions}>
        <button type="button" disabled={busy || !onTemporarySave} onClick={() => void temporarySave()}>임시저장</button>
        <button type="button" disabled={busy} onClick={() => setPreview(previous => !previous)}>{preview ? "편집으로 돌아가기" : "미리보기"}</button>
        <button type="button" className={styles.primary} disabled={busy} onClick={() => { setTargetVisibility(visibility); setPublishError(""); setPublishing(true); }}>발행하기</button>
      </div>
    </footer>
    {!preview && <div className={styles.sharedBar}><div className={styles.editingSection}>{activeSection ? PROJECT_SECTIONS.find(section=>section.key===activeSection)?.label : "서식을 적용할 본문을 선택하세요"}</div><div ref={setToolbarHost} className={styles.sharedHost}/></div>}
    <div className={styles.layout}>
      <nav className={styles.outline} aria-label="프로젝트 작성 목차">
        <p>프로젝트 구성</p>
        <a href={`#${id}-name`}>프로젝트명</a>
        <button type="button" onClick={() => jump("overview")}>프로젝트 개요</button>
        <button type="button" onClick={() => jump("technologies")}>기술 스택</button>
        {sections.map(section => <button key={section.key} type="button" onClick={() => jump(section.key)}>{section.label}</button>)}
        <div className={styles.foldActions}><button type="button" onClick={() => setClosed(new Set())}>모두 펼치기</button><button type="button" onClick={() => {setClosed(new Set(["overview", "technologies", "execution", ...sections.map(section => section.key)]));setActiveSection(null);}}>모두 접기</button></div>
      </nav>
      <div className={styles.document}>
        {preview ? <article className={styles.preview} aria-label="프로젝트 미리보기">
          <h1>{value.name || "프로젝트 이름"}</h1>{value.summary && <p className={styles.summary}>{value.summary}</p>}
          <section><h2>프로젝트 개요</h2><dl className={styles.overviewPreview}><dt>진행 기간</dt><dd>{value.startedOn || "미정"} — {value.lifecycleStatus === "IN_PROGRESS" ? "진행 중" : value.completedOn || "미정"}</dd>{value.document.teamSize && <><dt>인원</dt><dd>{value.document.teamSize}명{value.document.teamComposition?.length?` (${value.document.teamComposition.map(item=>`${PROJECT_TEAM_ROLES.find(job=>job.key===item.role)?.label} ${item.count}명`).join(", ")})`:""}</dd></>}{selectedRoles.length>0 && <><dt>나의 역할</dt><dd>{selectedRoles.join(", ")}</dd></>}</dl>
          {hasContent(value.document.sections.find(section=>section.key==="BACKGROUND")?.blocks??[])&&<div><h3>배경 및 목적</h3><PostBody blocks={value.document.sections.find(section=>section.key==="BACKGROUND")!.blocks} imagePreviews={imagePreviews}/></div>}</section>
          {value.techStackIds.length > 0 && <section><h2>기술 스택</h2><div className={styles.previewTech}>{previewTechnologies.map(tech => <span key={tech.id}>{tech.name}</span>)}{unnamedTechnologyCount > 0 && <span>{previewTechnologies.length ? "외 " : "선택한 기술 "}{unnamedTechnologyCount}개</span>}</div></section>}
          {sections.map(section => { const blocks = value.document.sections.find(item => item.key === section.key)?.blocks ?? []; return hasContent(blocks) ? <section key={section.key}><h2>{section.label}</h2><PostBody blocks={blocks} imagePreviews={imagePreviews} /></section> : null; })}
          {value.executionInstructions && <section><h2>실행 방법</h2><p className={styles.preservedText}>{value.executionInstructions}</p></section>}
        </article> : <fieldset disabled={busy} className={styles.fields}>
          <label className={styles.nameLabel} htmlFor={`${id}-name`}>프로젝트명</label>
          <input className={styles.name} id={`${id}-name`} value={value.name} maxLength={120} placeholder="어떤 프로젝트를 만들었나요?" onChange={event => update("name", event.target.value)} />
          {details("overview", "프로젝트 개요", <>
            <div className={styles.dateRow}><label htmlFor={`${id}-started`}>진행 기간</label><input aria-label="시작일" id={`${id}-started`} type="date" min="0001-01-01" max="9999-12-31" value={value.startedOn} onChange={event => checkedDate(event.currentTarget, "startedOn")} /><span aria-hidden="true">—</span>{value.lifecycleStatus === "IN_PROGRESS" ? <span className={styles.ongoing}>진행 중</span> : <input aria-label="종료일" type="date" min={value.startedOn || "0001-01-01"} max="9999-12-31" value={value.completedOn} onChange={event => checkedDate(event.currentTarget, "completedOn")} />}<label className={styles.check}><input type="checkbox" checked={value.lifecycleStatus === "IN_PROGRESS"} onChange={event => onChange({ ...currentValue.current, lifecycleStatus: event.target.checked ? "IN_PROGRESS" : "COMPLETED", completedOn: event.target.checked ? "" : currentValue.current.completedOn })} />진행 중</label></div>
            <fieldset className={styles.teamFields}><legend>참여 인원{value.document.teamSize ? ` · 총 ${value.document.teamSize}명` : ""}</legend><div className={styles.teamGrid}>{PROJECT_TEAM_ROLES.map(job=><label key={job.key}>{job.label}<span><input aria-label={`${job.label} 인원`} type="number" min={0} max={10000} step={1} placeholder="0" value={value.document.teamComposition?.find(item=>item.role===job.key)?.count??""} onChange={event=>changeTeam(job.key,Number(event.target.value))}/><span>명</span></span></label>)}</div>{value.document.teamComposition===undefined&&value.document.teamSize&&<small>기존에 입력한 총 인원입니다. 직군별 인원을 입력하면 합계로 바뀝니다.</small>}</fieldset>
            <fieldset className={styles.roleFields}><legend>나의 역할 <small>여러 개 선택할 수 있어요</small></legend><div className={styles.roleOptions}>{[...PROJECT_ROLE_OPTIONS,...selectedRoles.filter(role=>!PROJECT_ROLE_OPTIONS.some(option=>option===role))].map(role=><button type="button" key={role} aria-pressed={selectedRoles.includes(role)} onClick={()=>changeRoles(role)}>{role}</button>)}</div><div className={styles.customRole}><input aria-label="역할 직접 입력" maxLength={40} value={customRole} placeholder="그 밖의 역할 직접 입력" onChange={event=>setCustomRole(event.target.value)} onKeyDown={event=>{if(event.key==="Enter"){event.preventDefault();const role=customRole.trim();if(role&&!selectedRoles.includes(role)){changeRoles(role);setCustomRole("");}}}}/><button type="button" disabled={!customRole.trim()||selectedRoles.includes(customRole.trim())} onClick={()=>{changeRoles(customRole.trim());setCustomRole("");}}>추가</button></div>{roleError&&<p role="alert">{roleError}</p>}</fieldset>
            <section className={styles.background}><h3>배경 및 목적</h3>{backgroundEditor}</section>
          </>, "기간 · 인원 · 역할 · 배경 및 목적")}
          {details("technologies", "기술 스택", <TechStackSelection selected={value.techStackIds} existing={existingTechStacks} onChange={techStackIds => update("techStackIds", techStackIds)} disabled={busy} />, value.techStackIds.length ? `${value.techStackIds.length}개 선택` : undefined)}
          {sections.map(section => details(section.key, section.label, <RichBodyEditor toolbarHost={toolbarHost} toolbarActive={!preview && activeSection===section.key && !closed.has(section.key)} onActivate={()=>setActiveSection(section.key)} toolbarMode="inline" allowRepresentativeImage={false} blocks={value.document.sections.find(item => item.key === section.key)?.blocks ?? []} onChangeBlocks={blocks => updateBlocks(section.key, blocks)} uploadImage={uploadImage} imagePreviews={imagePreviews} disabled={busy} />))}
          {value.executionInstructions && details("execution", "실행 방법", <label>실행 방법<textarea value={value.executionInstructions} rows={5} onChange={event => update("executionInstructions", event.target.value)} /></label>, "기존 내용")}
        </fieldset>}
      </div>
    </div>
    <dialog ref={dialogRef} className={styles.publishDialog} aria-labelledby={`${id}-publish-title`} onCancel={() => setPublishing(false)} onClose={() => setPublishing(false)}>
      <form onSubmit={event => void publish(event)}>
        <header className={styles.dialogHeading}><h2 id={`${id}-publish-title`}>프로젝트 발행</h2><button type="button" aria-label="발행 설정 닫기" onClick={() => setPublishing(false)}>×</button></header>
        <fieldset disabled={busy} className={styles.publishFields}>
          <label>한 줄 요약<textarea rows={3} maxLength={500} value={value.summary} placeholder="목록에 보여줄 프로젝트 소개" onChange={event => update("summary", event.target.value)} /></label>
          <div><span className={styles.fieldTitle}>공개 설정</span><div className={styles.visibility}><label><input type="radio" name={`${id}-visibility`} checked={targetVisibility === "PUBLIC"} disabled={blocked && visibility !== "PUBLIC"} onChange={() => setTargetVisibility("PUBLIC")} />공개</label><label><input type="radio" name={`${id}-visibility`} checked={targetVisibility === "HIDDEN"} onChange={() => setTargetVisibility("HIDDEN")} />비공개</label></div></div>
          {blocked && <p className={styles.saveState}>차단된 프로젝트의 공개 전환은 제한돼요.</p>}
          {coverElement && <section><h3>대표 이미지</h3>{coverElement}</section>}
          <section><div className={styles.linkHeading}><h3>외부 링크</h3><button type="button" onClick={() => update("links", [...value.links, {linkType:"OTHER",label:"",url:"",displayOrder:value.links.length}])}>링크 추가</button></div>{value.links.map((link, index) => <div className={styles.linkRow} key={index}><select aria-label={`${index + 1}번째 링크 종류`} value={link.linkType} onChange={event => update("links", value.links.map((item, i) => i === index ? {...item, linkType:event.target.value as LinkInput["linkType"]} : item))}>{linkTypes.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}</select><input aria-label={`${index + 1}번째 링크 이름`} maxLength={100} placeholder="이름" value={link.label} onChange={event => update("links", value.links.map((item,i) => i === index ? {...item,label:event.target.value} : item))} /><input aria-label={`${index + 1}번째 링크 주소`} type="url" required placeholder="https://" value={link.url} onChange={event => update("links", value.links.map((item,i) => i === index ? {...item,url:event.target.value} : item))} /><button type="button" aria-label={`${index + 1}번째 링크 삭제`} onClick={() => update("links", value.links.filter((_,i) => i !== index).map((item, displayOrder) => ({...item,displayOrder})))}>삭제</button></div>)}</section>
        </fieldset>
        {publishError && <p role="alert" className={styles.error}>{publishError}</p>}
        <footer className={styles.dialogActions}><button type="button" disabled={busy} onClick={() => setPublishing(false)}>계속 작성</button><button type="submit" className={styles.primary} disabled={busy || (blocked && targetVisibility === "PUBLIC" && visibility !== "PUBLIC")}>{busy ? "저장 중…" : targetVisibility === "PUBLIC" ? "공개 발행" : "비공개 발행"}</button></footer>
      </form>
    </dialog>
  </div>;
}
