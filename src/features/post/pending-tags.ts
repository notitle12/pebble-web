import { normalizeTagName, createTag } from "../tag/api/create-tag.ts";
import type { PostEditorValue } from "./post-editor-model.ts";

export function parsePendingTagNames(value: unknown): string[] {
  if (!Array.isArray(value) || value.some(name => typeof name !== "string" || normalizeTagName(name) !== name) || new Set(value).size !== value.length) throw new Error("저장된 태그 이름을 확인하지 못했습니다.");
  return value as string[];
}

export function createPendingTags() {
  // Keep successful results across a partial publish failure, scoped to this writer.
  const ids = new Map<string, string>();
  return {
    async resolve(value: PostEditorValue, request: Parameters<typeof createTag>[1]): Promise<PostEditorValue> {
      const names = parsePendingTagNames(value.pendingTagNames ?? []);
      const tagIds = new Set(value.tagIds ?? []);
      for (const name of names) {
        let id = ids.get(name);
        if (!id) { id = (await createTag(name, request)).id; ids.set(name, id); }
        tagIds.add(id);
      }
      return { ...value, tagIds: [...tagIds], pendingTagNames: [] };
    },
  };
}
