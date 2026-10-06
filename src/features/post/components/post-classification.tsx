"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { getPublicCategories, type PublicCategory } from "../../category/api/public-categories";
import { getPublicTags, type PublicTag } from "../../tag/api/public-tags";

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
  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [tags, setTags] = useState<PublicTag[]>([]);
  const [categoryState, setCategoryState] = useState<"loading" | "ready" | "error">("loading");
  const [tagState, setTagState] = useState<"loading" | "ready" | "error">("loading");
  const [query, setQuery] = useState("");

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
      <input id={`${id}-tag-search`} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="태그 검색" autoComplete="off" />
      <div className="post-classification-selected" aria-live="polite">
        <span>현재 선택:</span> {selectedTags.length ? selectedTags.map(tag => tag.name).join(", ") : "없음"}
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
