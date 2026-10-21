export function normalizeTagName(input: string): string {
  const value = input.normalize("NFKC").trim().replace(/^#+/, "").trim();
  if (!value || Array.from(value).length > 50 || /[#\p{Cc}\p{Cs}]/u.test(value)) throw new Error("태그는 # 없이 50자 이내로 입력해 주세요.");
  return value;
}
export function splitTagInput(input: string): string[] {
  return input.split(/[,#]+/).map(value => value.trim()).filter(Boolean);
}
export function normalizeTags(values: string[]): string[] {
  const tags = [...new Set(values.map(normalizeTagName))];
  if (tags.length > 20) throw new Error("태그는 최대 20개까지 추가할 수 있어요.");
  return tags;
}

/** Preserve browser drafts saved before tags were separated from the catalog. */
export function restoreDraftTags(draft: {tags?:string[];tagIds?:string[];pendingTagNames?:string[]}, catalog: {id:string;name:string}[] = []): string[] {
  const names = (draft.tagIds ?? []).map(id => {
    const match = catalog.find(item => item.id === id);
    if (!match) throw new Error("이전 편집 내용의 태그 이름을 확인하지 못했습니다. 서버에 저장된 글을 확인해 주세요.");
    return match.name;
  });
  return normalizeTags([...(draft.tags ?? []), ...names, ...(draft.pendingTagNames ?? [])]);
}
