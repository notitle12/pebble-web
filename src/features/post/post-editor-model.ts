import { parseArchitectureSpec, parseTableSpec, type ArchitectureSpec, type PostDetail, type TableSpec } from "./api/post-list.ts";

export type PostEditorValue = {
  title: string;
  summary: string;
  blocks: Array<{ key: string; type: "TEXT" | "CODE" | "TABLE" | "ARCHITECTURE"; content: string; language: string | null; title: string | null; valid: boolean }>;
};

const blankTable: TableSpec = { schemaVersion: 1, tableName: "table_name", columns: [{ name: "id", dataType: "BIGINT", nullable: false, primaryKey: true }] };
const blankArchitecture: ArchitectureSpec = { schemaVersion: 1, groups: [], nodes: [{ id: "node-1", type: "CUSTOM", label: "서비스" }], edges: [] };

export function createEditorBlock(type: PostEditorValue["blocks"][number]["type"] = "TEXT") {
  const content = type === "TABLE" ? JSON.stringify(blankTable) : type === "ARCHITECTURE" ? JSON.stringify(blankArchitecture) : "";
  return { key: globalThis.crypto?.randomUUID?.() ?? `block-${Date.now()}-${Math.random().toString(36).slice(2)}`, type, content, language: type === "CODE" ? "TYPESCRIPT" : null, title: null, valid: true };
}

export function editorValueFromPost(post: PostDetail): PostEditorValue {
  return {
    title: post.title,
    summary: post.summary ?? "",
    blocks: post.blocks.map((block, index) => ({
      key: `saved-${index}-${block.displayOrder}`,
      type: block.type,
      content: block.content,
      language: block.language,
      title: block.title,
      valid: true,
    })),
  };
}

export function validateEditorValue(value: PostEditorValue): string[] {
  const errors: string[] = [];
  const length = (text: string) => Array.from(text).length;
  const safe = (text: string) => !/[\u0000]/u.test(text) && !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(text);
  if (!value.title.trim()) errors.push("제목을 입력해 주세요.");
  if (!safe(value.title) || length(value.title) > 200) errors.push("제목은 올바른 Unicode로 된 200자 이하여야 합니다.");
  if (!safe(value.summary) || length(value.summary) > 500) errors.push("요약은 올바른 Unicode로 된 500자 이하여야 합니다.");
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
    summary: value.summary.trim() ? value.summary : null,
    blocks: value.blocks.map(({ type, content, language, title }) => ({ type, content, language: type === "CODE" ? language : null, title })),
  };
}
