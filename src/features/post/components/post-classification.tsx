"use client";
import { useEffect, useId, useRef, useState } from "react";
import { getPublicCategories, type PublicCategory } from "../../category/api/public-categories";
import { normalizeTags, splitTagInput } from "../post-tags";
type ExistingCategory = {id:string;name:string;status:string};
type Props = {categoryId:string|null;tags?:string[];existingCategory?:ExistingCategory;onChange:(patch:{categoryId?:string|null;tags?:string[]})=>void;showCategory?:boolean;showTags?:boolean;disabled?:boolean;categoryLabel?:string;ariaLabel?:string};
export function PostClassification({categoryId,tags=[],existingCategory,onChange,showCategory=true,showTags=true,disabled=false,categoryLabel="분류",ariaLabel="게시글 분류"}:Props){
  const id=useId();
  const lookupVersion=useRef(0);
  const [categories,setCategories]=useState<PublicCategory[]>([]);
  const [categoryState,setCategoryState]=useState<"loading"|"ready"|"error">("loading");
  const [tagInput,setTagInput]=useState(""),[tagError,setTagError]=useState("");
  async function loadLookups(){const version=++lookupVersion.current;setCategoryState("loading");try{const result=showCategory?await getPublicCategories():[];if(lookupVersion.current===version){setCategories(result);setCategoryState("ready");}}catch{if(lookupVersion.current===version)setCategoryState("error");}}
  useEffect(()=>{void loadLookups();return()=>{lookupVersion.current+=1;};},[showCategory]);
  function addTags(){if(disabled)return;try{const parts=splitTagInput(tagInput);if(!parts.length)return;onChange({tags:normalizeTags([...tags,...parts])});setTagInput("");setTagError("");}catch(error){setTagError(error instanceof Error?error.message:"태그를 확인해 주세요.");}}
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
      <div className="post-classification-add-tag"><input id={`${id}-tag-add`} value={tagInput} onChange={event=>{setTagInput(event.target.value);setTagError("");}} onBlur={()=>{if(tagInput.trim())addTags();}} onKeyDown={event=>{if(!event.nativeEvent.isComposing&&(event.key==="Enter"||event.key===",")){event.preventDefault();addTags();}}} placeholder="#태그 입력 후 Enter 또는 쉼표" disabled={disabled}/><button type="button" className="button" onClick={addTags} disabled={disabled||!tagInput.trim()}>태그 추가</button></div>
      <p className="post-classification-help">자유롭게 입력하세요. 태그는 최대 20개까지 추가할 수 있어요.</p>
      {tagError&&<p role="alert">{tagError}</p>}
      <div className="post-classification-selected" aria-live="polite"><span className="post-classification-chips">{tags.map(tag=><span className="post-classification-chip" key={tag}>#{tag}<button type="button" aria-label={`${tag} 태그 삭제`} disabled={disabled} onClick={()=>onChange({tags:tags.filter(value=>value!==tag)})}>×</button></span>)}</span></div>
    </div>}
  </section>;
}
