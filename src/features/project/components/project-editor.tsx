"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { getPublicTags, type PublicTag } from "../../tag/api/public-tags";
import type { ProjectTag } from "../api/member-projects";
import type { FeatureInput, LinkInput, ProjectEditorValue, ProjectLifecycle, ProjectVisibility } from "../project-editor-model";

type Props = {
  value: ProjectEditorValue;
  onChange: (value: ProjectEditorValue) => void;
  busy: boolean;
  visibility: ProjectVisibility;
  blocked: boolean;
  existingTags?: ProjectTag[];
  onSave: (visibility: ProjectVisibility) => Promise<void>;
};

const linkTypes: { value: LinkInput["linkType"]; label: string }[] = [
  { value: "GITHUB", label: "GitHub" },
  { value: "DEPLOYMENT", label: "배포" },
  { value: "DOWNLOAD", label: "다운로드" },
  { value: "OTHER", label: "기타" },
];

export function ProjectEditor({ value, onChange, busy, visibility, blocked, existingTags = [], onSave }: Props) {
  const id = useId();
  const requestVersion = useRef(0);
  const [tags, setTags] = useState<PublicTag[]>([]);
  const [tagState, setTagState] = useState<"loading" | "ready" | "error">("loading");
  const [tagQuery, setTagQuery] = useState("");

  async function loadTags() {
    const version = ++requestVersion.current;
    setTagState("loading");
    try {
      const result = await getPublicTags();
      if (requestVersion.current === version) {
        setTags(result);
        setTagState("ready");
      }
    } catch {
      if (requestVersion.current === version) setTagState("error");
    }
  }

  useEffect(() => {
    void loadTags();
    return () => { requestVersion.current += 1; };
  }, []);

  const allTags = useMemo(() => {
    const byId = new Map<string, PublicTag>();
    for (const tag of tags) byId.set(tag.id, tag);
    for (const tag of existingTags) if (!byId.has(tag.id)) byId.set(tag.id, tag);
    return [...byId.values()];
  }, [tags, existingTags]);
  const activeTags = allTags.filter(tag => tag.status === "ACTIVE" && tag.name.toLocaleLowerCase().includes(tagQuery.trim().toLocaleLowerCase()));
  const selectedTags = allTags.filter(tag => value.tagIds.includes(tag.id));

  function update<K extends keyof ProjectEditorValue>(key: K, next: ProjectEditorValue[K]) {
    onChange({ ...value, [key]: next });
  }

  function updateFeature(index: number, patch: Partial<FeatureInput>) {
    update("features", value.features.map((feature, itemIndex) => itemIndex === index ? { ...feature, ...patch } : feature));
  }

  function reorderFeatures(index: number, direction: -1 | 1) {
    const next = [...value.features];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    update("features", next);
  }

  function normalizeLinks(links: LinkInput[]) {
    return links.map((link, displayOrder) => ({ ...link, displayOrder }));
  }

  function updateLink(index: number, patch: Partial<LinkInput>) {
    update("links", value.links.map((link, itemIndex) => itemIndex === index ? { ...link, ...patch } : link));
  }

  function reorderLinks(index: number, direction: -1 | 1) {
    const next = [...value.links];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    update("links", normalizeLinks(next));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const requested = submitter instanceof HTMLButtonElement ? submitter.value : visibility;
    const targetVisibility: ProjectVisibility = requested === "PUBLIC" ? "PUBLIC" : "HIDDEN";
    if (blocked && targetVisibility === "PUBLIC" && visibility !== "PUBLIC") return;
    try {
      await onSave(targetVisibility);
    } catch {
      // The owning page presents save errors.
    }
  }

  return <form className="post-editor" onSubmit={event => { void submit(event); }}>
    <fieldset disabled={busy} style={{ display: "contents", border: 0, margin: 0, padding: 0, minWidth: 0 }}>
      <div className="post-editor-fields">
        <label htmlFor={`${id}-name`}>프로젝트 이름 <span>{Array.from(value.name).length}/120자</span>
          <input id={`${id}-name`} value={value.name} required aria-required="true" onChange={event => update("name", event.target.value)} />
        </label>
        <label htmlFor={`${id}-summary`}>요약 <span>{Array.from(value.summary).length}/500자</span>
          <textarea id={`${id}-summary`} value={value.summary} onChange={event => update("summary", event.target.value)} />
        </label>
        <label htmlFor={`${id}-description`}>프로젝트 소개 <span>{Array.from(value.description).length}/20,000자</span>
          <textarea id={`${id}-description`} value={value.description} rows={6} onChange={event => update("description", event.target.value)} />
        </label>
        <label htmlFor={`${id}-architecture`}>기술 구성 <span>{Array.from(value.architectureDescription).length}/20,000자</span>
          <textarea id={`${id}-architecture`} value={value.architectureDescription} rows={5} onChange={event => update("architectureDescription", event.target.value)} />
        </label>
        <label htmlFor={`${id}-instructions`}>실행 방법 <span>{Array.from(value.executionInstructions).length}/10,000자</span>
          <textarea id={`${id}-instructions`} value={value.executionInstructions} rows={5} onChange={event => update("executionInstructions", event.target.value)} />
        </label>
      </div>

      <section className="post-classification" aria-label="프로젝트 상태와 기술 태그">
        <div className="post-classification-field">
          <label htmlFor={`${id}-lifecycle`}>진행 상태</label>
          <select id={`${id}-lifecycle`} value={value.lifecycleStatus} onChange={event => update("lifecycleStatus", event.target.value as ProjectLifecycle)}>
            <option value="IN_PROGRESS">진행 중</option>
            <option value="COMPLETED">완료</option>
          </select>
        </div>
        <div className="post-classification-field">
          <label htmlFor={`${id}-started`}>시작일</label>
          <input id={`${id}-started`} type="date" value={value.startedOn} onInput={event => update("startedOn", event.currentTarget.value)} onChange={event => update("startedOn", event.target.value)} />
        </div>
        <div className="post-classification-field">
          <label htmlFor={`${id}-completed`}>완료일</label>
          <input id={`${id}-completed`} type="date" value={value.completedOn} onInput={event => update("completedOn", event.currentTarget.value)} onChange={event => update("completedOn", event.target.value)} />
        </div>
        <div className="post-classification-field">
          <label htmlFor={`${id}-tag-search`}>기술 태그</label>
          <input id={`${id}-tag-search`} type="search" value={tagQuery} onChange={event => setTagQuery(event.target.value)} placeholder="태그 검색" autoComplete="off" />
          <p className="post-classification-selected" aria-live="polite">현재 선택: {selectedTags.length ? selectedTags.map(tag => tag.name).join(", ") : value.tagIds.length ? value.tagIds.join(", ") : "없음"}</p>
          {tagState === "loading" && <p className="post-classification-help" role="status">태그를 불러오는 중…</p>}
          {tagState === "error" && <p className="post-classification-help" role="alert">태그를 불러오지 못했어요. 현재 선택은 유지됩니다. <button type="button" onClick={() => void loadTags()}>다시 시도</button></p>}
          {tagState === "ready" && activeTags.length === 0 && <p className="post-classification-help">검색 결과가 없어요.</p>}
          <div className="post-classification-tags" role="group" aria-label="기술 태그 선택">
            {activeTags.map(tag => <label className="post-classification-tag" key={tag.id}>
              <input type="checkbox" checked={value.tagIds.includes(tag.id)} disabled={tagState !== "ready"} onChange={event => update("tagIds", event.target.checked ? [...value.tagIds, tag.id] : value.tagIds.filter(tagId => tagId !== tag.id))} />
              <span>{tag.name}</span>
            </label>)}
            {allTags.filter(tag => tag.status !== "ACTIVE").map(tag => {
              const checked = value.tagIds.includes(tag.id);
              return <label className="post-classification-tag is-existing" key={tag.id}>
                <input type="checkbox" checked={checked} disabled={!checked} onChange={() => update("tagIds", value.tagIds.filter(tagId => tagId !== tag.id))} />
                <span>{tag.name} · 기존 태그</span>
              </label>;
            })}
            {value.tagIds.map(tagId => !allTags.some(tag => tag.id === tagId) ? <label className="post-classification-tag is-existing" key={tagId}>
              <input type="checkbox" checked onChange={() => update("tagIds", value.tagIds.filter(id => id !== tagId))} />
              <span>{existingTags.find(tag => tag.id === tagId)?.name ?? `기존 태그 (${tagId})`}</span>
            </label> : null)}
          </div>
        </div>
      </section>

      <section aria-labelledby={`${id}-features-title`}>
        <div className="post-editor-block-heading"><h2 id={`${id}-features-title`}>주요 기능</h2><button type="button" className="post-editor-add" onClick={() => update("features", [...value.features, { title: "", description: "" }])}>기능 추가</button></div>
        {value.features.map((feature, index) => <fieldset className="table-column-editor" key={index}>
          <legend>기능 {index + 1}</legend>
          <div className="table-editor-field"><label htmlFor={`${id}-feature-${index}-title`}>기능 이름 <span>{Array.from(feature.title).length}/100자</span></label><input id={`${id}-feature-${index}-title`} value={feature.title} onChange={event => updateFeature(index, { title: event.target.value })} /></div>
          <div className="table-editor-field"><label htmlFor={`${id}-feature-${index}-description`}>기능 설명 <span>{Array.from(feature.description).length}/2,000자</span></label><textarea id={`${id}-feature-${index}-description`} value={feature.description} onChange={event => updateFeature(index, { description: event.target.value })} /></div>
          <div className="post-editor-add"><button type="button" disabled={index === 0} onClick={() => reorderFeatures(index, -1)}>위로</button><button type="button" disabled={index === value.features.length - 1} onClick={() => reorderFeatures(index, 1)}>아래로</button><button type="button" onClick={() => update("features", value.features.filter((_, itemIndex) => itemIndex !== index))}>삭제</button></div>
        </fieldset>)}
      </section>

      <section aria-labelledby={`${id}-links-title`}>
        <div className="post-editor-block-heading"><h2 id={`${id}-links-title`}>외부 링크</h2><button type="button" className="post-editor-add" onClick={() => update("links", normalizeLinks([...value.links, { linkType: "OTHER", label: "", url: "", displayOrder: value.links.length }]))}>링크 추가</button></div>
        {value.links.map((link, index) => <fieldset className="table-column-editor" key={index}>
          <legend>링크 {index + 1}</legend>
          <div className="table-editor-field"><label htmlFor={`${id}-link-${index}-type`}>링크 종류</label><select id={`${id}-link-${index}-type`} value={link.linkType} onChange={event => updateLink(index, { linkType: event.target.value as LinkInput["linkType"] })}>{linkTypes.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}</select></div>
          <div className="table-editor-field"><label htmlFor={`${id}-link-${index}-label`}>표시 이름 <span>{Array.from(link.label).length}/100자</span></label><input id={`${id}-link-${index}-label`} value={link.label} onChange={event => updateLink(index, { label: event.target.value })} /></div>
          <div className="table-editor-field"><label htmlFor={`${id}-link-${index}-url`}>주소 <span>{Array.from(link.url).length}/2,048자</span></label><input id={`${id}-link-${index}-url`} type="url" value={link.url} required onChange={event => updateLink(index, { url: event.target.value })} /></div>
          <div className="post-editor-add"><button type="button" disabled={index === 0} onClick={() => reorderLinks(index, -1)}>위로</button><button type="button" disabled={index === value.links.length - 1} onClick={() => reorderLinks(index, 1)}>아래로</button><button type="button" onClick={() => update("links", normalizeLinks(value.links.filter((_, itemIndex) => itemIndex !== index)))}>삭제</button></div>
        </fieldset>)}
      </section>

      <div className="post-editor-footer">
        <button type="submit" value="HIDDEN" disabled={busy}>비공개로 저장</button>
        <button type="submit" value="PUBLIC" disabled={busy || (blocked && visibility !== "PUBLIC")}>{blocked && visibility === "PUBLIC" ? "수정 내용 저장" : "공개로 저장"}</button>
      </div>
    </fieldset>
  </form>;
}
