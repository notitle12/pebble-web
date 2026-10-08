"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { getPublicCategories, type PublicCategory } from "../../category/api/public-categories";
import { getPublicTags, type PublicTag } from "../../tag/api/public-tags";
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
};

export function PostClassification({ categoryId, tagIds, existingCategory, existingTags = [], onChange, showCategory=true, showTags=true, categoryLabel="분류" }: Props) {
  const id = useId();
  const session = useUserSession();
  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [tags, setTags] = useState<PublicTag[]>([]);
  const [categoryState, setCategoryState] = useState<"loading" | "ready" | "error">("loading");
  const [tagState, setTagState] = useState<"loading" | "ready" | "error">("loading");
  const [query, setQuery] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tagBusy, setTagBusy] = useState(false);
  const [tagError, setTagError] = useState("");

  async function loadLookups() {
    setCategoryState("loading");
    setTagState("loading");
    const [categoryResult, tagResult] = await Promise.allSettled([showCategory?getPublicCategories():Promise.resolve([]), showTags?getPublicTags():Promise.resolve([])]);
    if (categoryResult.status === "fulfilled") {
      setCategories(categoryResult.value);
      setCategoryState("ready");
    } else setCategoryState("error");
    if (tagResult.status === "fulfilled") {
      setTags(tagResult.value);
      setTagState("ready");
    } else setTagState("error");
  }

  useEffect(() => { void loadLookups(); }, [showCategory,showTags]);

  const allTags = useMemo(() => {
    const byId = new Map<string, PublicTag>();
    for (const tag of tags) byId.set(tag.id, tag);
    for (const tag of existingTags) if (!byId.has(tag.id)) byId.set(tag.id, tag as PublicTag);
    return [...byId.values()];
  }, [tags, existingTags]);
  const selectedTags = allTags.filter(tag => tagIds.includes(tag.id));
  const visibleTags = allTags.filter(tag => tag.status === "ACTIVE" && tag.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const canCreateTags = session.phase === "ready" && session.member?.profileCompleted === true;

  async function addTags() {
    if (tagBusy || tagState !== "ready" || !canCreateTags) return;
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
        const item: PublicTag = { id: created.id, name: created.name, status: created.status };
        knownByName.set(name, item);
        setTags(current => current.some(tag => tag.id === item.id) ? current : [...current, item]);
        if (!nextIds.includes(item.id)) nextIds.push(item.id);
      }
      onChange({ tagIds: nextIds }); setTagInput("");
    } catch (error) {
      onChange({ tagIds: nextIds });
      setTagError(error instanceof Error ? error.message : "태그를 추가하지 못했습니다.");
    } finally { setTagBusy(false); }
  }

  const renderLeaf = (category: PublicCategory) => (
    <option key={category.id} value={category.id} disabled={category.status !== "ACTIVE" && category.id !== categoryId}>
      {category.name}{category.status !== "ACTIVE" ? " · 기존 분류" : ""}
    </option>
  );

  return <section className="post-classification" aria-label="게시글 분류">
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
      <label htmlFor={`${id}-tag-search`}>기술 태그</label>
      <label htmlFor={`${id}-tag-add`}>새 태그 추가</label>
      <div className="post-classification-add-tag">
        <input id={`${id}-tag-add`} value={tagInput} onChange={event => { setTagInput(event.target.value); setTagError(""); }} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void addTags(); } }} placeholder="#태그 입력 후 Enter" disabled={tagBusy || tagState !== "ready" || !canCreateTags} aria-describedby={tagError ? `${id}-tag-error` : `${id}-tag-help`} />
        <button type="button" className="button" onClick={() => void addTags()} disabled={tagBusy || tagState !== "ready" || !canCreateTags || !tagInput.trim()}>{tagBusy ? "추가 중…" : "태그 추가"}</button>
      </div>
      <p id={`${id}-tag-help`} className="post-classification-help">쉼표나 Enter로 추가할 수 있어요. 여러 태그는 #springboot #아무개처럼 입력하세요.</p>
      {!canCreateTags && <p className="post-classification-help">새 태그 추가는 프로필 설정을 완료한 회원만 사용할 수 있어요.</p>}
      {tagError && <p id={`${id}-tag-error`} className="post-classification-help" role="alert">{tagError}</p>}
      <input id={`${id}-tag-search`} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="태그 검색" autoComplete="off" />
      <div className="post-classification-selected" aria-live="polite">
        <span>현재 선택:</span> {selectedTags.length ? <span className="post-classification-chips">{selectedTags.map(tag => <span className="post-classification-chip" key={tag.id}>{tag.name}<button type="button" aria-label={`${tag.name} 태그 삭제`} onClick={() => onChange({ tagIds: tagIds.filter(selectedId => selectedId !== tag.id) })} disabled={tagBusy}>×</button></span>)}</span> : "없음"}
      </div>
      {tagState === "loading" && <p className="post-classification-help" role="status">태그를 불러오는 중…</p>}
      {tagState === "error" && <p className="post-classification-help" role="alert">태그를 불러오지 못했어요. 현재 선택은 유지됩니다. <button type="button" onClick={() => void loadLookups()}>다시 시도</button></p>}
      {tagState === "ready" && visibleTags.length === 0 && <p className="post-classification-help">검색 결과가 없어요.</p>}
      <div className="post-classification-tags" role="group" aria-label="기술 태그 선택">
        {visibleTags.map(tag => <label className="post-classification-tag" key={tag.id}>
          <input type="checkbox" disabled={tagState !== "ready"} checked={tagIds.includes(tag.id)} onChange={event => {
            const next = event.target.checked ? [...tagIds, tag.id] : tagIds.filter(id => id !== tag.id);
            onChange({ tagIds: next });
          }} />
          <span>{tag.name}</span>
        </label>)}
        {allTags.filter(tag => tag.status !== "ACTIVE").map(tag => {
          const checked = tagIds.includes(tag.id);
          return <label className="post-classification-tag is-existing" key={tag.id}>
            <input type="checkbox" checked={checked} disabled={!checked} onChange={() => onChange({ tagIds: tagIds.filter(id => id !== tag.id) })} />
            <span>{tag.name} · 기존 태그</span>
          </label>;
        })}
        {tagIds.map(selectedId => !allTags.some(tag => tag.id === selectedId) ? <label className="post-classification-tag is-existing" key={selectedId}>
          <input type="checkbox" checked onChange={() => onChange({ tagIds: tagIds.filter(id => id !== selectedId) })} />
          <span>기존 태그 ({selectedId})</span>
        </label> : null)}
      </div>
    </div>}
  </section>;
}
