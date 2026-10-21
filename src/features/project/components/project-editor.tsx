"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { TechStackSelection } from "../../tech-stack/components/tech-stack-selection";
import { RichBodyEditor } from "../../post/components/rich-body-editor";
import type { EditorBlock } from "../../post/post-editor-model";
import { projectWriteFailure, type ProjectTechStack } from "../api/member-projects";
import type { LinkInput, ProjectEditorValue, ProjectVisibility } from "../project-editor-model";
import { PROJECT_SECTIONS, PROJECT_TEAM_ROLES, type ProjectSectionKey } from "../project-document";
import styles from "./project-editor.module.css";
import {ProjectDiagramSection} from "./project-diagram-section";
import {ProjectCoverImage} from "./project-cover-image";
import {ProjectDocumentView} from "./project-document-view";
import {safeExternalUrl} from "../api/project-list";

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
  featuredElement?: (visibility: ProjectVisibility) => ReactNode;
  onPublishOpen?: () => void;
  coverPreviewUrl?: string | null;
  representativeImageSrc?: string | null;
  onSelectRepresentativeImage?: (src: string) => void;
};
const linkTypes: { value: LinkInput["linkType"]; label: string }[] = [
  { value: "GITHUB", label: "GitHub" }, { value: "DEPLOYMENT", label: "배포" },
  { value: "DOWNLOAD", label: "다운로드" }, { value: "OTHER", label: "기타" },
];

export function ProjectEditor({ value, onChange, busy, visibility, blocked, existingTechStacks = [], onSave, onTemporarySave, uploadImage, imagePreviews = {}, coverElement, featuredElement, onPublishOpen, coverPreviewUrl, representativeImageSrc, onSelectRepresentativeImage }: Props) {
  const id = useId();
  const currentValue = useRef(value);
  currentValue.current = value;
  const [closed, setClosed] = useState<Set<string>>(()=>new Set(["technologies","execution",...PROJECT_SECTIONS.filter(section=>section.key!=="BACKGROUND").map(section=>section.key)]));
  const [toolbarHost,setToolbarHost]=useState<HTMLDivElement|null>(null);
  const [activeSection,setActiveSection]=useState<ProjectSectionKey|null>("BACKGROUND");
  const [preview, setPreview] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [targetVisibility, setTargetVisibility] = useState<ProjectVisibility>(visibility);
  const [feedback, setFeedback] = useState("");
  const [publishError, setPublishError] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const sections = PROJECT_SECTIONS.filter(section=>section.key!=="BACKGROUND");
  const teamRows=value.document.teamComposition?.map(item=>({...item,role:PROJECT_TEAM_ROLES.find(job=>job.key===item.role)?.label??item.role}))??[{role:'백엔드',count:0},{role:'프론트엔드',count:0},{role:'디자이너',count:0}];
  const contribution=value.document.roles?.join(', ')??value.document.role;
  function changeTeam(rows:{role:string;count:number}[]){
    update('document',{...value.document,teamComposition:rows,teamSize:rows.reduce((sum,item)=>sum+item.count,0)||null});
  }
  const backgroundEditor=<RichBodyEditor toolbarHost={toolbarHost} toolbarActive={!preview&&activeSection==="BACKGROUND"} onActivate={()=>activate("BACKGROUND")} toolbarMode="inline" allowRepresentativeImage={true} representativeImageSrc={representativeImageSrc} onSelectRepresentativeImage={onSelectRepresentativeImage} blocks={value.document.sections.find(section=>section.key==="BACKGROUND")?.blocks??[]} onChangeBlocks={blocks=>updateBlocks("BACKGROUND",blocks)} uploadImage={uploadImage} imagePreviews={imagePreviews} disabled={busy}/>;

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
  function activate(key:ProjectSectionKey){setActiveSection(key);const target=key==='BACKGROUND'?'overview':key;setClosed(previous=>{if(!previous.has(target))return previous;const next=new Set(previous);next.delete(target);return next;});}
  function changeFold(key: string, open: boolean) {
    setClosed(previous => { const next = new Set(previous); if (open) next.delete(key); else next.add(key); return next; });
  }
  function jump(key: string) {
    setPreview(false);
    if (key === "name") {
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
      return;
    }
    if(key==="overview")setActiveSection("BACKGROUND");
    if(key==="technologies"){
      changeFold("overview",true);
      requestAnimationFrame(()=>sectionRefs.current["technologies"]?.scrollIntoView({behavior:"smooth",block:"start"}));
      return;
    }
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
    setPublishError("");
    try {
      await onTemporarySave?.();
      setFeedback("임시저장했어요.");
    } catch (error) {
      const message = projectWriteFailure(error);
      setFeedback(message);
      if (publishing) setPublishError(message);
    }
  }
  async function publish(event: React.FormEvent) {
    event.preventDefault();
    if (blocked && targetVisibility === "PUBLIC" && visibility !== "PUBLIC") return;
    setPublishError("");
    try {
      await onSave(targetVisibility);
      setPublishing(false);
    } catch (error) {
      setPublishError(projectWriteFailure(error));
    }
  }
  const details = (key: string, title: string, content: ReactNode, hint?: string) => <details key={key} ref={element => { sectionRefs.current[key] = element; }} id={`${id}-${key}`} className={styles.section} open={!closed.has(key)} onToggle={event => changeFold(key, event.currentTarget.open)}>
    <summary><span>{title}</span>{hint && <small>{hint}</small>}<svg aria-hidden="true" viewBox="0 0 20 20"><path d="m5 8 5 5 5-5" /></svg></summary>
    <div className={styles.sectionBody}>{content}</div>
  </details>;

  return <div className={`${styles.editor} writer-composer project-editor`}>
    <footer className={`${styles.toolbar} writer-action-bar`} aria-label="프로젝트 저장 및 발행">
      <button type="button" className="writer-exit" disabled={busy} onClick={()=>window.location.assign("/me/projects")}>나가기</button>
      <span className={styles.saveState} role="status">{busy ? "저장 중…" : feedback || "프로젝트를 자유롭게 기록해 보세요."}</span>
      <div className={styles.actions}>
        <button type="button" disabled={busy || !onTemporarySave} onClick={() => void temporarySave()}>임시저장</button>
        <button type="button" disabled={busy} onClick={() => setPreview(previous => !previous)}>{preview ? "편집으로 돌아가기" : "미리보기"}</button>
        <button type="button" className={styles.primary} disabled={busy} onClick={() => { setTargetVisibility(visibility); setFeedback(""); setPublishError(""); setPublishing(true); onPublishOpen?.(); }}>발행하기</button>
      </div>
    </footer>
    {!preview && <div className={styles.sharedBar}><div ref={setToolbarHost} className={styles.sharedHost}/></div>}
    <div className={`${styles.layout} ${preview ? styles.previewLayout : ""}`}>
      {!preview && (
        <nav className={styles.outline} aria-label="프로젝트 작성 목차">
          <p>프로젝트 구성</p>
          <button type="button" onClick={() => jump("name")}>프로젝트 정보</button>
          {coverElement && <button type="button" onClick={() => jump("cover")}>대표 이미지</button>}
          <button type="button" onClick={() => jump("overview")}>프로젝트 개요</button>
          {sections.map(section => <button key={section.key} type="button" onClick={() => jump(section.key)}>{section.label}</button>)}
          <div className={styles.foldActions}><button type="button" onClick={() => setClosed(new Set())}>모두 펼치기</button><button type="button" onClick={() => {setClosed(new Set(["overview", "execution", ...(coverElement?["cover"]:[]), ...sections.map(section => section.key)]));}}>모두 접기</button></div>
        </nav>
      )}
      <div className={`${styles.document} ${preview ? styles.previewDocument : ""}`}>
        {preview ? (
          <div className="detail-shell post-reading-shell project-reading-shell">
            <article className={`post-detail ${styles.preview}`} aria-label="프로젝트 미리보기">
            <header>
              <div className="post-heading-bar">
                <div className="post-meta">
                  <span className={`project-status ${value.lifecycleStatus === "COMPLETED" ? "completed" : ""}`}>
                    {value.lifecycleStatus === "COMPLETED" ? "완료" : "진행 중"}
                  </span>
                </div>
              </div>
              <h1 title={value.name || "프로젝트 이름"}>{value.name || "프로젝트 이름"}</h1>
              {value.summary && <p>{value.summary}</p>}
              {coverPreviewUrl && <ProjectCoverImage src={coverPreviewUrl} alt="대표 이미지 미리보기" />}
            </header>
            <div className="post-body">
              <ProjectDocumentView
                document={value.document}
                techStacks={existingTechStacks}
                selectedTechStackIds={value.techStackIds}
                period={{
                  startedOn: value.startedOn || null,
                  completedOn: value.completedOn || null,
                  lifecycleStatus: value.lifecycleStatus,
                }}
                imagePreviews={imagePreviews}
              />
              {value.executionInstructions && (
                <section className="text-block project-document-section">
                  <h2>실행 방법</h2>
                  <p style={{whiteSpace:"pre-wrap"}}>{value.executionInstructions}</p>
                </section>
              )}
              {value.links.filter(l => l.url.trim()).length > 0 && (
                <section className="text-block project-document-section">
                  <h2>프로젝트 링크</h2>
                  <ul className="project-links">
                    {[...value.links]
                      .filter(l => l.url.trim())
                      .sort((a, b) => a.displayOrder - b.displayOrder)
                      .map((link, idx) => {
                        const href = safeExternalUrl(link.url);
                        return (
                          <li key={idx}>
                            {href ? (
                              <a href={href} target="_blank" rel="noopener noreferrer">
                                {link.label || link.linkType} ↗<span className="sr-only"> (새 탭)</span>
                              </a>
                            ) : (
                              <span>{link.label || link.url}</span>
                            )}
                          </li>
                        );
                      })}
                  </ul>
                </section>
              )}
            </div>
          </article>
        </div>
        ) : <fieldset disabled={busy} className={styles.fields}>
          <div ref={element => { sectionRefs.current["name"] = element; }} className={styles.nameSection}>
            <label className={styles.nameLabel} htmlFor={`${id}-name`}>프로젝트명</label>
            <input className={styles.name} id={`${id}-name`} value={value.name} maxLength={120} placeholder="어떤 프로젝트를 만들었나요?" onChange={event => update("name", event.target.value)} />
            <label className={styles.nameLabel} htmlFor={`${id}-summary`}>한 줄 요약</label>
            <textarea
              className={styles.summaryInput}
              id={`${id}-summary`}
              rows={2}
              maxLength={500}
              value={value.summary}
              placeholder="프로젝트를 한 줄로 소개해 주세요. (목록 및 상세 상단에 표시됩니다)"
              onChange={event => update("summary", event.target.value)}
            />
          </div>
          {coverElement && details("cover", "대표 이미지", coverElement, "목록 및 상세 상단에 표시될 대표 이미지")}
          {details("overview", "프로젝트 개요", <>
            <div className={styles.dateRow}><label htmlFor={`${id}-started`}>진행 기간</label><input aria-label="시작일" id={`${id}-started`} type="date" min="0001-01-01" max="9999-12-31" value={value.startedOn} onChange={event => checkedDate(event.currentTarget, "startedOn")} /><span aria-hidden="true">—</span>{value.lifecycleStatus === "IN_PROGRESS" ? <span className={styles.ongoing}>진행 중</span> : <input aria-label="종료일" type="date" min={value.startedOn || "0001-01-01"} max="9999-12-31" value={value.completedOn} onChange={event => checkedDate(event.currentTarget, "completedOn")} />}<label className={styles.check}><input type="checkbox" checked={value.lifecycleStatus === "IN_PROGRESS"} onChange={event => onChange({ ...currentValue.current, lifecycleStatus: event.target.checked ? "IN_PROGRESS" : "COMPLETED", completedOn: event.target.checked ? "" : currentValue.current.completedOn })} />진행 중</label></div>
            <fieldset className={styles.teamFields}><legend>참여 인원{value.document.teamSize?` · 총 ${value.document.teamSize}명`:''}</legend><div className={styles.compactTeam}>{teamRows.map((job,index)=><div className={styles.teamRow} key={index}><input aria-label={`직군 ${index+1} 이름`} maxLength={40} placeholder="직군 이름" value={PROJECT_TEAM_ROLES.find(item=>item.key===job.role)?.label??job.role} onChange={event=>changeTeam(teamRows.map((item,i)=>i===index?{...item,role:event.target.value}:item))}/><input aria-label={`직군 ${index+1} 인원`} type="number" min={0} max={10000} step={1} placeholder="0" value={job.count||''} onChange={event=>changeTeam(teamRows.map((item,i)=>i===index?{...item,count:Number(event.target.value)}:item))}/><span>명</span><button type="button" aria-label={`직군 ${index+1} 삭제`} onClick={()=>changeTeam(teamRows.filter((_,i)=>i!==index))}>×</button></div>)}<button type="button" className={styles.addTeam} aria-label="참여 직군 추가" disabled={teamRows.length>=20} onClick={()=>changeTeam([...teamRows,{role:'',count:0}])}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>직군 추가</button></div>{value.document.teamComposition===undefined&&value.document.teamSize&&<small>기존 총 인원입니다. 직군별 인원을 수정하면 합계로 바뀝니다.</small>}</fieldset>
            <label className={styles.contribution}>나의 역할<textarea rows={5} maxLength={10000} placeholder="프로젝트에서 직접 맡아 진행한 작업을 작성해 주세요." value={contribution} onChange={event=>update('document',{...value.document,role:event.target.value,roles:undefined})}/></label>
            <div ref={element => { sectionRefs.current["technologies"] = element; }} className={styles.techStackOverview}>
              <h3>기술 스택</h3>
              <TechStackSelection selected={value.techStackIds} existing={existingTechStacks} onChange={techStackIds => update("techStackIds", techStackIds)} disabled={busy} />
            </div>
            <section className={styles.background}><h3>배경 및 목적</h3>{backgroundEditor}</section>
          </>, value.techStackIds.length ? `기간 · 인원 · 역할 · 기술 스택(${value.techStackIds.length}) · 배경 및 목적` : "기간 · 인원 · 역할 · 기술 스택 · 배경 및 목적")}
          {sections.map(section => details(section.key, section.label, section.key==="ARCHITECTURE"||section.key==="DATABASE"?<ProjectDiagramSection key={section.key} kind={section.key} blocks={value.document.sections.find(item=>item.key===section.key)?.blocks??[]} onChangeBlocks={blocks=>updateBlocks(section.key,blocks)} toolbarHost={toolbarHost} toolbarActive={!preview&&activeSection===section.key} onActivate={()=>activate(section.key)} uploadImage={uploadImage} imagePreviews={imagePreviews} disabled={busy}/>:<RichBodyEditor toolbarHost={toolbarHost} toolbarActive={!preview && activeSection===section.key} onActivate={()=>activate(section.key)} toolbarMode="inline" allowRepresentativeImage={true} representativeImageSrc={representativeImageSrc} onSelectRepresentativeImage={onSelectRepresentativeImage} blocks={value.document.sections.find(item => item.key === section.key)?.blocks ?? []} onChangeBlocks={blocks => updateBlocks(section.key, blocks)} uploadImage={uploadImage} imagePreviews={imagePreviews} disabled={busy} />))}
          {value.executionInstructions && details("execution", "실행 방법", <label>실행 방법<textarea value={value.executionInstructions} rows={5} onChange={event => update("executionInstructions", event.target.value)} /></label>, "기존 내용")}
        </fieldset>}
      </div>
    </div>
    <dialog ref={dialogRef} className={styles.publishDialog} aria-labelledby={`${id}-publish-title`} onCancel={() => setPublishing(false)} onClose={() => setPublishing(false)}>
      <form onSubmit={event => void publish(event)}>
        <header className={styles.dialogHeading}><h2 id={`${id}-publish-title`}>프로젝트 발행</h2><button type="button" aria-label="발행 설정 닫기" onClick={() => setPublishing(false)}>×</button></header>
        <fieldset disabled={busy} className={styles.publishFields}>
          <div><span className={styles.fieldTitle}>공개 설정</span><div className={styles.visibility}><label><input type="radio" name={`${id}-visibility`} checked={targetVisibility === "PUBLIC"} disabled={blocked && visibility !== "PUBLIC"} onChange={() => setTargetVisibility("PUBLIC")} />공개</label><label><input type="radio" name={`${id}-visibility`} checked={targetVisibility === "HIDDEN"} onChange={() => setTargetVisibility("HIDDEN")} />비공개</label></div></div>
          {blocked && <p className={styles.saveState}>차단된 프로젝트의 공개 전환은 제한돼요.</p>}
          {featuredElement?.(targetVisibility)}
          <section><div className={styles.linkHeading}><h3>외부 링크</h3><button type="button" onClick={() => update("links", [...value.links, {linkType:"OTHER",label:"",url:"",displayOrder:value.links.length}])}>링크 추가</button></div>{value.links.map((link, index) => <div className={styles.linkRow} key={index}><select aria-label={`${index + 1}번째 링크 종류`} value={link.linkType} onChange={event => update("links", value.links.map((item, i) => i === index ? {...item, linkType:event.target.value as LinkInput["linkType"]} : item))}>{linkTypes.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}</select><input aria-label={`${index + 1}번째 링크 이름`} maxLength={100} placeholder="이름" value={link.label} onChange={event => update("links", value.links.map((item,i) => i === index ? {...item,label:event.target.value} : item))} /><input aria-label={`${index + 1}번째 링크 주소`} type="url" required placeholder="https://" value={link.url} onChange={event => update("links", value.links.map((item,i) => i === index ? {...item,url:event.target.value} : item))} /><button type="button" className={styles.linkDeleteBtn} aria-label={`${index + 1}번째 링크 삭제`} onClick={() => update("links", value.links.filter((_,i) => i !== index).map((item, displayOrder) => ({...item,displayOrder})))}>×</button></div>)}</section>
        </fieldset>
        {publishError ? <p role="alert" className={styles.error}>{publishError}</p> : feedback ? <p role="status" className={styles.saveState}>{feedback}</p> : null}
        <footer className={styles.dialogActions}><button type="button" disabled={busy || !onTemporarySave} onClick={() => void temporarySave()}>임시저장</button><button type="submit" className={styles.primary} disabled={busy || (blocked && targetVisibility === "PUBLIC" && visibility !== "PUBLIC")}>{busy ? "저장 중…" : targetVisibility === "PUBLIC" ? "공개 발행" : "비공개 발행"}</button></footer>
      </form>
    </dialog>
  </div>;
}
