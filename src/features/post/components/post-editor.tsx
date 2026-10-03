"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseArchitectureSpec, parseTableSpec, type ArchitectureSpec, type TableSpec } from "../api/post-list";
import { ArchitectureBlock } from "./architecture-block";
import { ArchitectureEditor } from "./architecture-editor";
import { CodeBlock } from "./code-block";
import { TableBlock } from "./table-block";
import { TableSpecEditor } from "./table-spec-editor";
import { createEditorBlock, validateEditorValue, type PostEditorValue } from "../post-editor-model";

export type { PostEditorValue } from "../post-editor-model";

const languages = ["JAVA", "JAVASCRIPT", "TYPESCRIPT", "PYTHON", "HTML", "CSS", "SQL", "JSON", "YAML", "MARKDOWN", "BASH", "SHELL"] as const;
const typeNames = { TEXT: "본문", CODE: "코드", TABLE: "테이블", ARCHITECTURE: "아키텍처" } as const;
const initial = (): PostEditorValue => ({ title: "", summary: "", blocks: [createEditorBlock("TEXT")] });

export function PostEditor({ initialValue, onSave, busy = false, saveLabel = "비공개로 저장" }: { initialValue?: PostEditorValue; onSave: (value: PostEditorValue) => Promise<void>; busy?: boolean; saveLabel?: string }) {
  const startingValue = useRef<PostEditorValue>(initialValue ?? initial());
  const [value, setValue] = useState<PostEditorValue>(() => startingValue.current);
  const [activeKey, setActiveKey] = useState(() => startingValue.current.blocks[0]?.key ?? "");
  const baseline = useRef(JSON.stringify(startingValue.current));
  const dirty = JSON.stringify(value) !== baseline.current;
  const errors = useMemo(() => validateEditorValue(value), [value]);
  const updateBlock = useCallback((key: string, update: (block: PostEditorValue["blocks"][number]) => PostEditorValue["blocks"][number]) => {
    setValue(current => ({ ...current, blocks: current.blocks.map(block => block.key === key ? update(block) : block) }));
  }, []);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = async () => {
    if (errors.length || busy) return;
    try {
      await onSave({ ...value, blocks: value.blocks.map(block => ({ ...block })) });
      baseline.current = JSON.stringify(value);
    } catch { /* The parent owns persistence errors and displays them beside the editor. */ }
    finally { setValue(current => ({ ...current })); }
  };

  const addBlock = (type: PostEditorValue["blocks"][number]["type"]) => {
    const block = createEditorBlock(type);
    setValue(current => ({ ...current, blocks: [...current.blocks, block] }));
    setActiveKey(block.key);
  };
  const moveBlock = (index: number, direction: -1 | 1) => setValue(current => {
    const next = [...current.blocks];
    const target = index + direction;
    if (target < 0 || target >= next.length) return current;
    [next[index], next[target]] = [next[target], next[index]];
    return { ...current, blocks: next };
  });

  return <section className="post-editor" aria-label="게시글 작성기">
    <div inert={busy}>
    <div className="post-editor-fields">
      <label>제목 <span>{Array.from(value.title).length}/200</span><input value={value.title} maxLength={400} aria-invalid={!value.title.trim() || Array.from(value.title).length > 200} onChange={event => setValue(current => ({ ...current, title: event.target.value }))} /></label>
      <label>요약 <span>{Array.from(value.summary).length}/500</span><textarea value={value.summary} maxLength={1000} rows={3} aria-invalid={Array.from(value.summary).length > 500} onChange={event => setValue(current => ({ ...current, summary: event.target.value }))} /></label>
    </div>

    <div className="post-editor-block-heading"><div><h2>본문 블록</h2><p>글, 코드, 테이블 명세, 시스템 구성도를 순서대로 구성하세요.</p></div>
      <div className="post-editor-add" aria-label="본문 블록 추가">{(Object.keys(typeNames) as Array<keyof typeof typeNames>).map(type => <button key={type} type="button" onClick={() => addBlock(type)}>＋ {typeNames[type]}</button>)}</div>
    </div>
    <ol className="post-editor-block-list">{value.blocks.map((block, index) => <li key={block.key}>
      <div className="post-editor-block-row"><button type="button" aria-current={activeKey === block.key ? "true" : undefined} onClick={() => setActiveKey(block.key)}>{index + 1}. {typeNames[block.type]}{!block.valid && <span className="post-editor-invalid-mark"> · 입력 오류</span>}</button>
        <div><button type="button" aria-label={`${index + 1}번째 블록 위로`} disabled={index === 0} onClick={() => moveBlock(index, -1)}>↑</button><button type="button" aria-label={`${index + 1}번째 블록 아래로`} disabled={index === value.blocks.length - 1} onClick={() => moveBlock(index, 1)}>↓</button><button type="button" aria-label={`${index + 1}번째 블록 삭제`} disabled={value.blocks.length <= 1} onClick={() => { setValue(current => ({ ...current, blocks: current.blocks.filter(item => item.key !== block.key) })); if (activeKey === block.key) setActiveKey(value.blocks.find(item => item.key !== block.key)?.key ?? ""); }}>삭제</button></div>
      </div>
      <BlockFields block={block} active={activeKey === block.key} updateBlock={updateBlock} />
    </li>)}</ol>

    {errors.length > 0 && <div className="post-editor-errors" role="alert"><p>저장하기 전에 다음 항목을 확인해 주세요.</p><ul>{errors.map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}</ul></div>}
    </div>
    <div className="post-editor-footer"><span>{dirty ? "저장되지 않은 변경 사항이 있습니다." : "변경 사항 없음"}</span><button type="button" disabled={busy || errors.length > 0} onClick={save}>{busy ? "저장 중…" : saveLabel}</button></div>
  </section>;
}

function BlockFields({ block, active, updateBlock }: { block: PostEditorValue["blocks"][number]; active: boolean; updateBlock: (key: string, update: (block: PostEditorValue["blocks"][number]) => PostEditorValue["blocks"][number]) => void }) {
  const set = (patch: Partial<PostEditorValue["blocks"][number]>) => updateBlock(block.key, current => ({ ...current, ...patch }));
  const onTableChange = useCallback((spec: TableSpec | null) => {
    updateBlock(block.key, current => {
      if (!spec) return current.valid ? { ...current, valid: false } : current;
      const content = JSON.stringify(spec);
      return current.valid && current.content === content ? current : { ...current, valid: true, content };
    });
  }, [block.key, updateBlock]);
  const onArchitectureChange = useCallback((spec: ArchitectureSpec | null) => {
    updateBlock(block.key, current => {
      if (!spec) return current.valid ? { ...current, valid: false } : current;
      const content = JSON.stringify(spec);
      return current.valid && current.content === content ? current : { ...current, valid: true, content };
    });
  }, [block.key, updateBlock]);
  let table: TableSpec | undefined;
  let architecture: ArchitectureSpec | undefined;
  try { if (block.type === "TABLE") table = parseTableSpec(JSON.parse(block.content)); } catch { /* Keep the mounted editor state for invalid in-progress input. */ }
  try { if (block.type === "ARCHITECTURE") architecture = parseArchitectureSpec(JSON.parse(block.content)); } catch { /* Keep the mounted editor state for invalid in-progress input. */ }
  const initialTable = useRef(table).current;
  const initialArchitecture = useRef(architecture).current;

  return <div className="post-editor-block-fields" hidden={!active}>
    {block.type === "TEXT" && <><label>본문 내용<textarea aria-label="본문 내용" rows={12} value={block.content} onChange={event => set({ content: event.target.value, valid: true })} /></label><div className="post-editor-preview"><h3>미리보기</h3><div className="post-editor-text-preview">{block.content || "본문 내용을 입력하세요."}</div></div></>}
    {block.type === "CODE" && <><div className="post-editor-code-meta"><label>코드 언어<select value={block.language ?? ""} onChange={event => set({ language: event.target.value || null })}><option value="">선택하세요</option>{languages.map(language => <option key={language} value={language}>{language}</option>)}</select></label><label>코드 제목 (선택)<input value={block.title ?? ""} maxLength={100} onChange={event => set({ title: event.target.value || null })} /></label></div><label>코드 내용<textarea aria-label="코드 내용" rows={12} value={block.content} onChange={event => set({ content: event.target.value, valid: true })} /></label><div className="post-editor-preview"><CodeBlock content={block.content} language={block.language} title={block.title} /></div></>}
    {block.type === "TABLE" && <><label>블록 제목 (선택)<input value={block.title ?? ""} maxLength={100} onChange={event => set({ title: event.target.value || null })} /></label><TableSpecEditor key={block.key} initialValue={initialTable} onChange={onTableChange} embedded /><div className="post-editor-preview"><h3>미리보기</h3>{block.valid && table ? <TableBlock spec={table} title={block.title} /> : <p>테이블 입력 오류를 수정하면 미리보기가 표시됩니다.</p>}</div></>}
    {block.type === "ARCHITECTURE" && <><label>블록 제목 (선택)<input value={block.title ?? ""} maxLength={100} onChange={event => set({ title: event.target.value || null })} /></label><ArchitectureEditor key={block.key} initialValue={initialArchitecture} onChange={onArchitectureChange} embedded /><div className="post-editor-preview"><h3>미리보기</h3>{block.valid && architecture ? <ArchitectureBlock spec={architecture} title={block.title} /> : <p>구성도 입력 오류를 수정하면 미리보기가 표시됩니다.</p>}</div></>}
  </div>;
}
