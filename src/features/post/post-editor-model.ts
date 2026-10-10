import { normalizeTagName } from "../tag/api/create-tag.ts";
import { validTagId } from "../../lib/list-query.ts";
import { parseArchitectureSpec, parseTableSpec, type ArchitectureSpec, type PostDetail, type TableSpec } from "./api/post-list.ts";
import {bodyImageId,representativeImageSrc,postImageSources} from "./post-images.ts";
import { derivePostExcerpt } from "./post-excerpt.ts";

export type EditorBlockType = "TEXT" | "CODE" | "TABLE" | "ARCHITECTURE" | "HTML" | "MARKDOWN";
export type BlockAlignment = "LEFT" | "CENTER" | "RIGHT";
export type EditorBlock = { key: string; type: EditorBlockType; content: string; language: string | null; title: string | null; valid: boolean; alignment?: BlockAlignment; imagePreviews?: Record<string,string> };
export type PostEditorValue = {
  title: string;
  summary: string;
  categoryId?: string | null;
  projectId?: string | null;
  boardId?: string | null;
  tagIds?: string[];
  pendingTagNames?: string[];
  slug?: string;
  thumbnailImageSrc?: string | null;
  blocks: EditorBlock[];
};

const blankTable: TableSpec = { schemaVersion: 1, tableName: "", columns: [{ name: "", dataType: "", nullable: true, primaryKey: false }] };
const blankArchitecture: ArchitectureSpec = { schemaVersion: 1, groups: [], nodes: [{ id: "node-1", type: "CUSTOM", label: "" }], edges: [] };

export function createEditorBlock(type: EditorBlockType = "TEXT") {
  const content = type === "TABLE" ? JSON.stringify(blankTable) : type === "ARCHITECTURE" ? JSON.stringify(blankArchitecture) : "";
  return { key: globalThis.crypto?.randomUUID?.() ?? `block-${Date.now()}-${Math.random().toString(36).slice(2)}`, type, content, language: type === "CODE" ? "TYPESCRIPT" : null, title: null, valid: type !== "TABLE" && type !== "ARCHITECTURE" };
}

export function editorValueFromPost(post: PostDetail & {category?: {id:string} | null;projectId?:string|null;boardId?:string|null;draft?:boolean;thumbnailImageId?:string|null;imagePreviews?:Record<string,string>}): PostEditorValue {
  return {
    title: post.title,
    summary: post.summary ?? "",
    categoryId: post.category?.id ?? null,
    projectId: post.projectId ?? null,
    boardId: post.boardId ?? null,
    tagIds: post.tags.map(tag => tag.id),
    thumbnailImageSrc: post.thumbnailImageId ? postImageSources(post.blocks).find(src=>bodyImageId(src)===post.thumbnailImageId)??null : null,
    slug: /^[1-9]\d*$/.test(post.urlKey) ? "" : post.urlKey,
    blocks: post.blocks.map((block, index) => ({
      key: `saved-${index}-${block.displayOrder}`,
      type: block.type,
      content: block.content,
      language: block.language,
      title: block.title,
      valid: true,
      alignment: block.alignment ?? "LEFT",
      imagePreviews: post.imagePreviews,
    })),
  };
}

export function normalizePostSlug(value:string):string {
  return value.trim().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0,200).replace(/-+$/g, "");
}
export function validatePostSlug(value:string):boolean {
  return value.length <= 200 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && !/^\d+$/.test(value) && value !== "search";
}

export function validateEditorValue(value: PostEditorValue): string[] {
  const errors: string[] = [];
  const length = (text: string) => Array.from(text).length;
  const safe = (text: string) => !/[\u0000]/u.test(text) && !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(text);
  if (!value.title.trim()) errors.push("제목을 입력해 주세요.");
  if (!safe(value.title) || length(value.title) > 200) errors.push("제목은 올바른 Unicode로 된 200자 이하여야 합니다.");
  if (!safe(value.summary) || length(value.summary) > 500) errors.push("요약은 올바른 Unicode로 된 500자 이하여야 합니다.");
  if (value.boardId != null && !validTagId(value.boardId)) errors.push("글 폴더를 다시 선택해 주세요.");
  if (value.projectId != null && !validTagId(value.projectId)) errors.push("프로젝트를 다시 선택해 주세요.");
  if (value.categoryId != null && !validTagId(value.categoryId)) errors.push("카테고리를 다시 선택해 주세요.");
  if (value.tagIds && (value.tagIds.some(id => !validTagId(id)) || new Set(value.tagIds).size !== value.tagIds.length)) errors.push("태그를 중복 없이 다시 선택해 주세요.");
  try { if (value.pendingTagNames && (value.pendingTagNames.some(name => normalizeTagName(name) !== name) || new Set(value.pendingTagNames).size !== value.pendingTagNames.length)) errors.push("태그를 중복 없이 다시 입력해 주세요."); }
  catch { errors.push("태그 이름을 확인해 주세요."); }
  if (!value.blocks.length) errors.push("본문 블록을 하나 이상 추가해 주세요.");
  for (const [index, block] of value.blocks.entries()) {
    if (!block.valid) errors.push(`${index + 1}번째 블록의 입력을 확인해 주세요.`);
    if (!safe(block.content) || length(block.content) > 50000) errors.push(`${index + 1}번째 블록은 올바른 Unicode로 된 50,000자 이하여야 합니다.`);
    if (block.title && (!safe(block.title) || length(block.title) > 100)) errors.push(`${index + 1}번째 블록 제목은 100자 이하여야 합니다.`);
    if (block.type === "CODE" && (!block.language || length(block.language) > 50 || !["JAVA", "JAVASCRIPT", "TYPESCRIPT", "PYTHON", "HTML", "CSS", "SQL", "JSON", "YAML", "MARKDOWN", "BASH", "SHELL"].includes(block.language))) errors.push(`${index + 1}번째 코드 블록의 언어를 선택해 주세요.`);
    if (block.type === "TABLE" || block.type === "ARCHITECTURE") {
      try {
        const parsed: unknown = JSON.parse(block.content);
        if (block.type === "TABLE") parseTableSpec(parsed);
        else parseArchitectureSpec(parsed);
      } catch { errors.push(`${index + 1}번째 구조 블록을 완성해 주세요.`); }
    }
  }
  return errors;
}

export function buildPostBody(value: PostEditorValue) {
  return {
    title: value.title,
    thumbnailImageId: bodyImageId(representativeImageSrc(value.blocks,value.thumbnailImageSrc)??""),
    // Keep summary in the editor model for older drafts, but derive the persisted
    // list excerpt from the current readable body on every save.
    summary: derivePostExcerpt(value.blocks),
    blocks: value.blocks.map(({ type, content, language, title, alignment }) => ({ type, content, language: type === "CODE" ? language : null, title, alignment: alignment ?? "LEFT" })),
  };
}

export type PostVisibility = "PUBLIC" | "HIDDEN";
export type PostSaveOptions={draft?:boolean;visibility?:PostVisibility;finalize?:boolean;slug?:string};
export function buildPostSaveBody(value:PostEditorValue,existing?:{visibilityStatus:PostVisibility;isBlocked:boolean;draft?:boolean;urlKey?:string;boardId?:string|null;projectId?:string|null;category?:{id:string}|null;tags?:{id:string}[]},visibilityOrOptions?:PostVisibility|PostSaveOptions){
  const options=typeof visibilityOrOptions==="string"?{visibility:visibilityOrOptions}:visibilityOrOptions??{};
  const visibility=options.visibility;
  if(options.draft!==true && value.pendingTagNames?.length)throw new Error("새 태그를 저장한 뒤 발행해 주세요.");
  const errors=validateEditorValue(value);
  if(errors.length)throw new Error(errors[0]);
  if(visibility!==undefined && visibility!=="PUBLIC" && visibility!=="HIDDEN")throw new Error("공개 또는 비공개를 선택해 주세요.");
  if(visibility==="PUBLIC" && existing?.isBlocked)throw new Error("차단된 글은 공개로 게시할 수 없습니다.");
  const requestedSlug=options.slug ?? value.slug;
  const slug=requestedSlug?.trim()?normalizePostSlug(requestedSlug):undefined;
  if(options.draft!==true && requestedSlug?.trim() && (!slug || !validatePostSlug(slug)))throw new Error("주소는 영문 소문자·숫자와 하이픈으로 된 200자 이하여야 하며 숫자만 사용할 수 없습니다.");
  if(existing && existing.draft===false && slug && slug!==existing.urlKey)throw new Error("게시가 완료된 글 주소는 변경할 수 없습니다.");
  if(options.draft===true && existing && existing.draft===false)throw new Error("게시가 완료된 글을 임시 글로 되돌릴 수 없습니다.");
  if(options.finalize && existing && existing.draft===false && options.draft!==false)throw new Error("게시 상태가 이미 완료된 글입니다.");
  const classification: {boardId?:string|null;projectId?:string|null;categoryId?:string|null;tagIds?:string[]} = {};
  if(value.boardId !== undefined && (!existing || value.boardId !== (existing.boardId ?? null))) classification.boardId=value.boardId;
  if(value.projectId !== undefined && (!existing || value.projectId !== (existing.projectId ?? null))) classification.projectId=value.projectId;
  if(value.categoryId !== undefined && (!existing || value.categoryId !== (existing.category?.id ?? null))) classification.categoryId=value.categoryId;
  if(value.tagIds !== undefined && (!existing || JSON.stringify(value.tagIds) !== JSON.stringify(existing.tags?.map(tag=>tag.id) ?? []))) classification.tagIds=[...value.tagIds];
  return {...buildPostBody(value),...classification,...(!existing?{visibilityStatus:visibility??"HIDDEN"}:visibility!==undefined?{visibilityStatus:visibility}:{}),...(options.draft!==undefined?{draft:options.draft}:{}),...(options.finalize?{draft:false}:{}),...(slug && options.draft!==true && (!existing || existing.draft===true)?{slug}:{})};
}
