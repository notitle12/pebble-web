"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { getPublicCategories, type PublicCategory } from "../../category/api/public-categories";
import { type PublicTag } from "../../tag/api/public-tags";
import { createTag, normalizeTagName, splitTagInput } from "../../tag/api/create-tag";
import { userSession } from "../../auth/user-session";
import { useUserSession } from "../../auth/components/member-gate";

type ExistingCategory = { id: string; name: string; status: string };
type ExistingTag = { id: string; name: string; status: string };
type Props = {
  categoryId: string | null;
  tagIds: string[];
  existingCategory?: ExistingCategory;
  existingTags?: ExistingTag[];
  onChange: (patch: { categoryId?: string | null; tagIds?: string[] }) => void;
  showCategory?:boolean;
  categoryLabel?:string;
  showTags?:boolean;
  disabled?:boolean;
  ariaLabel?:string;
};

export function PostClassification({ categoryId, tagIds, existingCategory, existingTags = [], onChange, showCategory=true, showTags=true, disabled=false, categoryLabel="분류", ariaLabel="게시글 분류" }: Props) {
  const id = useId();
  const session = useUserSession();
  const tagOperationVersion = useRef(0);
  const sessionKey = `${session.phase}:${session.member?.id ?? ""}`;
  const currentSessionKey = useRef(sessionKey);
  currentSessionKey.current = sessionKey;
  const lookupVersion = useRef(0);
  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [tags, setTags] = useState<PublicTag[]>([]);
  const [categoryState, setCategoryState] = useState<"loading" | "ready" | "error">("loading");
  const [tagInput, setTagInput] = useState("");
  const [tagBusy, setTagBusy] = useState(false);
  const [tagError, setTagError] = useState("");

  async function loadLookups() {
    const version = ++lookupVersion.current;
    setCategoryState("loading");
    try {
      const result = showCategory ? await getPublicCategories() : [];
      if (lookupVersion.current === version) { setCategories(result); setCategoryState("ready"); }
    } catch {
      if (lookupVersion.current === version) setCategoryState("error");
    }
  }

  useEffect(() => {
    void loadLookups();
    return () => { lookupVersion.current += 1; };
  }, [showCategory,showTags]);

  useEffect(() => {
    tagOperationVersion.current += 1;
    setTags([]);
    setTagInput("");
    setTagError("");
    setTagBusy(false);
  }, [session.phase, session.member?.id]);
  useEffect(() => () => { tagOperationVersion.current += 1; }, []);

  const allTags = useMemo(() => {
    const byId = new Map<string, PublicTag>();
    for (const tag of tags) byId.set(tag.id, tag);
    for (const tag of existingTags) if (!byId.has(tag.id)) byId.set(tag.id, tag as PublicTag);
    return [...byId.values()];
  }, [tags, existingTags]);
  const selectedTags = allTags.filter(tag => tagIds.includes(tag.id));
  const canCreateTags = !disabled && session.phase === "ready" && session.member?.profileCompleted === true;

  async function addTags() {
    if (tagBusy || !canCreateTags) return;
    const operationVersion = ++tagOperationVersion.current;
    const operationSessionKey = sessionKey;
    const isCurrentOperation = () => {
      const liveSession = userSession.snapshot();
      const liveSessionKey = `${liveSession.phase}:${liveSession.member?.id ?? ""}`;
      return tagOperationVersion.current === operationVersion && currentSessionKey.current === operationSessionKey && liveSessionKey === operationSessionKey;
    };
    const parts = splitTagInput(tagInput);
    if (!parts.length) { setTagError("태그 이름을 입력해 주세요."); return; }
    setTagBusy(true); setTagError("");
    const nextIds = [...tagIds];
    const knownByName = new Map<string, {id:string;name:string;status:string}>();
    for (const tag of [...tags, ...existingTags]) {
      try { if (tag.status === "ACTIVE") knownByName.set(normalizeTagName(tag.name), tag); } catch { /* preserve malformed legacy labels without matching them */ }
    }
    try {
      for (const part of parts) {
        const name = normalizeTagName(part);
        const existing = knownByName.get(name);
        if (existing) { if (!nextIds.includes(existing.id)) nextIds.push(existing.id); continue; }
        const created = await createTag(name, (path, options) => userSession.request(path, options));
        if (!isCurrentOperation()) return;
        const item: PublicTag = { id: created.id, name: created.name, status: created.status };
        knownByName.set(name, item);
        setTags(current => current.some(tag => tag.id === item.id) ? current : [...current, item]);
        if (!nextIds.includes(item.id)) nextIds.push(item.id);
      }
      if (isCurrentOperation()) { onChange({ tagIds: nextIds }); setTagInput(""); }
    } catch (error) {
      if (isCurrentOperation()) {
        onChange({ tagIds: nextIds });
        setTagError(error instanceof Error ? error.message : "태그를 추가하지 못했습니다.");
      }
    } finally { if (isCurrentOperation()) setTagBusy(false); }
  }

  const renderLeaf = (category: PublicCategory) => (
    <option key={category.id} value={category.id} disabled={category.status !== "ACTIVE" && category.id !== categoryId}>
      {category.name}{category.status !== "ACTIVE" ? " · 기존 분류" : ""}
    </option>
  );

  return <section className="post-classification" aria-label={ariaLabel}>
    {showCategory&&<div className="post-classification-field">
      <label htmlFor={`${id}-category`}>{categoryLabel}</label>
      <select id={`${id}-category`} value={categoryId ?? ""} disabled={categoryState !== "ready"} onChange={event => onChange({ categoryId: event.target.value || null })}>
        <option value="">분류 없음</option>
        {categories.map(category => {
          const activeChildren = category.children.filter(child => child.status === "ACTIVE");
          if (category.children.length > 0) {
            return <optgroup key={category.id} label={category.name}>
              <option value={category.id} disabled>{category.name} (상위 분류)</option>
              {activeChildren.map(renderLeaf)}
              {category.children.filter(child => child.status !== "ACTIVE" && child.id === categoryId).map(renderLeaf)}
            </optgroup>;
          }
          return <option key={category.id} value={category.id} disabled={category.status !== "ACTIVE" && category.id !== categoryId}>
            {category.name}{category.status !== "ACTIVE" ? " · 기존 분류" : ""}
          </option>;
        })}
        {existingCategory && !categories.some(category => category.id === existingCategory.id || category.children.some(child => child.id === existingCategory.id)) && (
          <option value={existingCategory.id} disabled={existingCategory.status !== "ACTIVE"}>{existingCategory.name}{existingCategory.status !== "ACTIVE" ? " · 기존 분류" : ""}</option>
        )}
      </select>
      {categoryState === "ready" && categories.length === 0 && <p className="post-classification-help">등록된 분류가 없어요. 분류 없이 저장할 수 있습니다.</p>}
      {categoryState === "loading" && <p className="post-classification-help" role="status">분류를 불러오는 중…</p>}
      {categoryState === "error" && <p className="post-classification-help" role="alert">분류를 불러오지 못했어요. 현재 선택은 유지됩니다. <button type="button" onClick={() => void loadLookups()}>다시 시도</button></p>}
      {categoryId && <p className="post-classification-help">현재 선택: {existingCategory?.id === categoryId ? existingCategory.name : categories.flatMap(item => [item, ...item.children]).find(item => item.id === categoryId)?.name ?? "기존 분류"}</p>}
    </div>}

    {showTags&&<div className="post-classification-field">
      <label htmlFor={`${id}-tag-add`}>태그</label>
      <div className="post-classification-add-tag">
        <input id={`${id}-tag-add`} value={tagInput} onChange={event => { setTagInput(event.target.value); setTagError(""); }} onKeyDown={event => { if (!event.nativeEvent.isComposing && (event.key === "Enter" || event.key === ",")) { event.preventDefault(); void addTags(); } }} placeholder="#태그 입력 후 Enter 또는 쉼표" disabled={tagBusy || !canCreateTags} aria-describedby={tagError ? `${id}-tag-error` : `${id}-tag-help`} />
        <button type="button" className="button" onClick={() => void addTags()} disabled={tagBusy || !canCreateTags || !tagInput.trim()}>{tagBusy ? "추가 중…" : "태그 추가"}</button>
      </div>
      <p id={`${id}-tag-help`} className="post-classification-help">쉼표나 Enter로 추가할 수 있어요. 여러 태그는 #springboot #아무개처럼 입력하세요.</p>
      {!canCreateTags && <p className="post-classification-help">새 태그 추가는 프로필 설정을 완료한 회원만 사용할 수 있어요.</p>}
      {tagError && <p id={`${id}-tag-error`} className="post-classification-help" role="alert">{tagError}</p>}
      <div className="post-classification-selected" aria-live="polite">
        {selectedTags.length ? <span className="post-classification-chips">{selectedTags.map(tag => <span className="post-classification-chip" key={tag.id}>#{tag.name}<button type="button" aria-label={`${tag.name} 태그 삭제`} onClick={() => onChange({ tagIds: tagIds.filter(selectedId => selectedId !== tag.id) })} disabled={tagBusy || disabled}>×</button></span>)}</span> : "없음"}
      </div>
      {tagIds.filter(selectedId => !allTags.some(tag => tag.id === selectedId)).map(selectedId => <button type="button" className="post-classification-chip" key={selectedId} disabled={tagBusy || disabled} onClick={() => onChange({tagIds:tagIds.filter(id=>id!==selectedId)})}>기존 태그 제거 ({selectedId}) ×</button>)}
    </div>}
  </section>;
}
