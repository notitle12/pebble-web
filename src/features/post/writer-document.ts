import type { JSONContent } from "@tiptap/core";
import type { EditorBlock } from "./post-editor-model.ts";
import { parseArchitectureSpec, parseTableSpec } from "./api/post-list.ts";

export const codeLanguages = ["JAVA", "JAVASCRIPT", "TYPESCRIPT", "PYTHON", "HTML", "CSS", "SQL", "JSON", "YAML", "MARKDOWN", "BASH", "SHELL"];
export const textSizes = { p: ["12px", "14px", "16px", "18px", "20px", "24px"], "1": ["28px", "32px", "36px", "40px", "48px"], "2": ["22px", "24px", "28px", "32px", "36px"], "3": ["18px", "20px", "22px", "24px", "28px"] };
export const defaultTextSizes = { p: "16px", "1": "32px", "2": "24px", "3": "20px" };
export const textColors = ["#202124", "#5f6368", "#9aa0a6", "#c62828", "#ef6c00", "#b8860b", "#2e7d32", "#1565c0", "#6a1b9a", "#ffffff"];
export const highlightColors = ["#fff29a", "#ffccbc", "#f8bbd0", "#e1bee7", "#bbdefb", "#b2dfdb", "#c8e6c9", "#eeeeee"];
const nodeTypes = { CODE: "pebbleCode", TABLE: "tableSpec", ARCHITECTURE: "architectureSpec" };
const attrs = (block: EditorBlock) => ({ key: block.key, title: block.title, valid: block.valid });

/** 저장 블록을 한 문서로 조립한다. HTML 파싱은 호출자가 안전한 HTML/스키마로 수행한다. */
export function blocksToDocument(blocks: EditorBlock[], parseRich: (block: EditorBlock) => JSONContent): JSONContent {
  const content: JSONContent[] = [];
  for (const block of blocks) {
    if (block.type === "CODE") content.push({ type: nodeTypes.CODE, attrs: { ...attrs(block), language: block.language }, content: block.content ? [{ type: "text", text: block.content }] : [] });
    else if (block.type === "TABLE" || block.type === "ARCHITECTURE") {
      const spec = block.type === "TABLE" ? parseTableSpec(JSON.parse(block.content)) : parseArchitectureSpec(JSON.parse(block.content));
      content.push({ type: nodeTypes[block.type], attrs: { ...attrs(block), spec } });
    } else {
      if (block.title) content.push({ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: block.title }] });
      content.push(...(parseRich(block).content ?? []));
    }
  }
  return { type: "doc", content: content.length ? content : [{ type: "paragraph" }] };
}

/** 문서의 순서를 보존해 기존 API 블록으로 분할한다. 구조 JSON은 HTML 본문에 저장하지 않는다. */
export function documentToBlocks(doc: JSONContent, renderRich: (doc: JSONContent) => string, imagePreviews: Record<string, string> = {}): EditorBlock[] {
  const result: EditorBlock[] = [];
  let rich: JSONContent[] = [];
  const flush = () => {
    if (!rich.length) return;
    result.push({ key: `rich-${result.length}`, type: "HTML", content: renderRich({ type: "doc", content: rich }), language: null, title: null, valid: true, ...(Object.keys(imagePreviews).length ? { imagePreviews } : {}) });
    rich = [];
  };
  const isSpecial = (node: JSONContent) => Object.values(nodeTypes).includes(node.type ?? "");
  const containsSpecial = (node: JSONContent): boolean => isSpecial(node) || !!node.content?.some(containsSpecial);
  const append = (node: JSONContent) => {
    if (isSpecial(node)) {
      flush();
      const type = node.type === "pebbleCode" ? "CODE" : node.type === "tableSpec" ? "TABLE" : "ARCHITECTURE";
      result.push({ key: node.attrs?.key ?? `inline-${result.length}`, type, content: type === "CODE" ? (node.content ?? []).map(child => child.text ?? "").join("") : JSON.stringify(node.attrs?.spec), language: type === "CODE" ? node.attrs?.language ?? "TYPESCRIPT" : null, title: node.attrs?.title ?? null, valid: node.attrs?.valid !== false });
    } else if (node.content?.some(containsSpecial)) {
      // 붙여넣은 인용/목록 안에 구조 블록이 있어도 누락하지 않고 형식 경계에서 분리한다.
      let children: JSONContent[] = [];
      const wrap = () => { if (children.length) { rich.push({ ...node, content: children }); children = []; } };
      for (const child of node.content) { if (containsSpecial(child)) { wrap(); flush(); append(child); } else children.push(child); }
      wrap();
    } else rich.push(node);
  };
  for (const node of doc.content ?? []) append(node);
  flush();
  return result.length ? result : [{ key: "rich-0", type: "HTML", content: "<p></p>", language: null, title: null, valid: true }];
}
export const blocksSignature = (blocks: EditorBlock[]) => JSON.stringify(blocks.map(({ type, content, language, title, valid }) => ({ type, content, language, title, valid })));
