"use client";
import { PrimaryKeyNote } from "./primary-key-note";

import { useEffect, useId, useRef, useState, type InputHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { NodeViewContent, NodeViewWrapper, useEditorState, type NodeViewProps } from "@tiptap/react";
import { parseArchitectureSpec, parseTableSpec, type ArchitectureSpec, type TableColumn, type TableSpec } from "../api/post-list";
import { ArchitectureBlock } from "./architecture-block";
import { ArchitectureEditor } from "./architecture-editor";
import styles from "./inline-block-views.module.css";
import { transitionTableInputComposition, type TableInputCompositionState } from "./table-input-composition";

const languages = ["JAVA", "JAVASCRIPT", "TYPESCRIPT", "PYTHON", "HTML", "CSS", "SQL", "JSON", "YAML", "MARKDOWN", "BASH", "SHELL"];
export const defaultInlineTableSpec = (): TableSpec => ({ schemaVersion: 1, tableName: "", columns: [{ name: "", dataType: "", primaryKey: false, nullable: true }] });
export const defaultInlineArchitectureSpec = (): ArchitectureSpec => ({ schemaVersion: 1, groups: [], nodes: [{ id: "client", type: "CLIENT", label: "", icon: "CLIENT", position: { x: 56, y: 80 } }], edges: [] });
function useEditable(editor: NodeViewProps["editor"]) {
  return useEditorState({ editor, selector: ({ editor: current }) => current.isEditable });
}
function tableError(spec: TableSpec): string {
  try {
    parseTableSpec(spec);
    if (Array.from(JSON.stringify(spec)).length > 50000) return "테이블 명세는 최대 50,000자입니다.";
    return "";
  } catch {
    const names = spec.columns.map(column => column.name.trim().toLowerCase());
    if (new Set(names).size !== names.length) return "컬럼명은 중복될 수 없습니다.";
    return "테이블명·컬럼명·자료형을 입력해 주세요. 이름·자료형은 100자, 참조는 200자, 설명은 500자까지 입력할 수 있으며 기본 키는 NULL을 허용하지 않습니다.";
  }
}

function TableTextInput({ value, disabled, onCommit, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "onCompositionStart" | "onCompositionEnd"> & { value: string; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  const composition = useRef<TableInputCompositionState>({ composing: false });
  useEffect(() => { if (!composition.current.composing) setDraft(value); }, [value]);
  const handleComposition = (event: Parameters<typeof transitionTableInputComposition>[1]) => {
    const result = transitionTableInputComposition(composition.current, event);
    composition.current = result.state;
    if ("value" in event) setDraft(event.value);
    if (result.commit !== undefined) onCommit(result.commit);
  };
  return <input {...props} disabled={disabled} value={draft}
    onCompositionStart={() => handleComposition({ type: "compositionstart" })}
    onChange={event => handleComposition({ type: "change", value: event.currentTarget.value })}
    onCompositionEnd={event => handleComposition({ type: "compositionend", value: event.currentTarget.value })}
    onBlur={event => handleComposition({ type: "blur", value: event.currentTarget.value })} />;
}

export function InlineCodeView({ node, editor, updateAttributes, deleteNode }: NodeViewProps) {
  const editable = useEditable(editor);
  const [copyMessage, setCopyMessage] = useState("");
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(node.textContent);
      setCopyMessage("코드를 복사했어요.");
    } catch {
      setCopyMessage("코드를 복사하지 못했어요. 코드를 직접 선택해 주세요.");
    }
  };
  return <NodeViewWrapper className={`${styles.block} ${styles.code}`} data-align={node.attrs.align ?? "left"}>
    <div className={styles.toolbar} contentEditable={false} onPointerDown={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
      <select aria-label="코드 언어" value={node.attrs.language ?? "TYPESCRIPT"} disabled={!editable} onChange={event => { if (editor.isEditable) updateAttributes({ language: event.target.value }); }}>
        {languages.map(language => <option key={language} value={language}>{language}</option>)}
      </select>
      <button type="button" onClick={() => void copyCode()}>코드 복사</button>
      <button type="button" aria-label="코드 블록 삭제" disabled={!editable} onClick={() => { if (editor.isEditable) deleteNode(); }}>삭제</button>
    </div>
    <NodeViewContent<"pre"> as="pre" className={styles.codeContent} spellCheck={false} aria-label="코드 내용" />
    <p className={styles.copyStatus} contentEditable={false} role="status">{copyMessage}</p>
  </NodeViewWrapper>;
}

export function InlineTableSpecView({ node, editor, updateAttributes, deleteNode, getPos }: NodeViewProps) {
  const editable = useEditable(editor);
  const id = useId();
  const spec: TableSpec = node.attrs.spec ?? defaultInlineTableSpec();
  const error = tableError(spec);
  const change = (next: TableSpec) => {
    if (editor.isEditable) updateAttributes({ spec: next, valid: !tableError(next) });
  };
  const columnChange = (index: number, patch: Partial<TableColumn>) => change({ ...spec, columns: spec.columns.map((column, position) => position === index ? { ...column, ...patch } : column) });
  return <NodeViewWrapper className={`${styles.block} ${styles.tableBlock}`} data-align={node.attrs.align ?? "left"} contentEditable={false} onPointerDown={(event: React.PointerEvent) => event.stopPropagation()} onKeyDown={(event: React.KeyboardEvent) => event.stopPropagation()} onClick={(event: React.MouseEvent) => { if ((event.target as Element).closest("button,input,select,textarea")) return; const pos = getPos(); if (editor.isEditable && typeof pos === "number") editor.commands.setNodeSelection(pos); }}>
    <div className={styles.heading}><span>{node.attrs.title ?? "테이블 명세"}</span><button type="button" disabled={!editable} aria-label="테이블 명세 블록 삭제" onClick={() => { if (editor.isEditable) deleteNode(); }}>삭제</button></div>
    <div className={styles.tableMeta}>
      <label htmlFor={`${id}-name`}>테이블명<TableTextInput id={`${id}-name`} disabled={!editable} value={spec.tableName} placeholder="테이블명" aria-invalid={!!error} onCommit={value => change({ ...spec, tableName: value })} /></label>
      <label htmlFor={`${id}-description`}>설명 (선택)<TableTextInput id={`${id}-description`} disabled={!editable} value={spec.description ?? ""} onCommit={value => change({ ...spec, description: value || null })} /></label>
    </div>
    <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="테이블 명세 편집 표">
      <table className={styles.table}><caption>{spec.tableName || "새 테이블"} 컬럼 명세</caption>
        <thead><tr><th scope="col">컬럼명</th><th scope="col">자료형</th><th scope="col">PK</th><th scope="col">NULL</th><th scope="col">참조</th><th scope="col">설명</th><th scope="col">삭제</th></tr></thead>
        <tbody>{spec.columns.map((column, index) => <tr key={index}>
          <td><TableTextInput aria-label={`컬럼 ${index + 1} 이름`} disabled={!editable} value={column.name} placeholder="컬럼명" onCommit={value => columnChange(index, { name: value })} /></td>
          <td><TableTextInput aria-label={`컬럼 ${index + 1} 자료형`} disabled={!editable} value={column.dataType} placeholder="자료형" onCommit={value => columnChange(index, { dataType: value })} /></td>
          <td><input type="checkbox" aria-label={`컬럼 ${index + 1} 기본 키`} disabled={!editable} checked={column.primaryKey} onChange={event => columnChange(index, { primaryKey: event.target.checked, nullable: event.target.checked ? false : column.nullable })} /></td>
          <td><input type="checkbox" aria-label={`컬럼 ${index + 1} NULL 허용`} disabled={!editable || column.primaryKey} checked={column.nullable} onChange={event => columnChange(index, { nullable: event.target.checked })} /></td>
          <td><TableTextInput aria-label={`컬럼 ${index + 1} 외래 키 참조`} disabled={!editable} value={column.foreignKey ?? ""} placeholder="table.id" onCommit={value => columnChange(index, { foreignKey: value || null })} /></td>
          <td><TableTextInput aria-label={`컬럼 ${index + 1} 설명`} disabled={!editable} value={column.description ?? ""} onCommit={value => columnChange(index, { description: value || null })} /></td>
          <td><button type="button" aria-label={`컬럼 ${index + 1} 삭제`} disabled={!editable || spec.columns.length <= 1} onClick={() => change({ ...spec, columns: spec.columns.filter((_, position) => position !== index) })}>×</button></td>
        </tr>)}</tbody>
      </table>
    </div>
    <PrimaryKeyNote columns={spec.columns}/>
    <div className={styles.tableFooter}><button type="button" disabled={!editable || spec.columns.length >= 50} onClick={() => change({ ...spec, columns: [...spec.columns, { name: "", dataType: "", primaryKey: false, nullable: true }] })}>컬럼 추가</button><span>{spec.columns.length}/50</span></div>
    {error && <p className={styles.error} role="alert">{error}</p>}
  </NodeViewWrapper>;
}

export function InlineArchitectureView({ node, editor, updateAttributes, deleteNode, getPos }: NodeViewProps) {
  const editable = useEditable(editor);
  const headingId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ArchitectureSpec | null>(null);
  const spec: ArchitectureSpec = node.attrs.spec ?? defaultInlineArchitectureSpec();
  let validSpec: ArchitectureSpec | null = null;
  try { validSpec = parseArchitectureSpec(spec); } catch { /* Never render malformed diagram data. */ }
  useEffect(() => {
    const element = dialog.current;
    if (open && editable) { if (element && !element.open) element.showModal(); }
    else { element?.close(); if (open) setOpen(false); }
  }, [open, editable]);
  const close = () => { dialog.current?.close(); setOpen(false); opener.current?.focus(); };
  const show = () => { if (editor.isEditable) { setDraft(spec); setOpen(true); } };
  const apply = () => {
    if (!editor.isEditable || !draft) return;
    try {
      const next = parseArchitectureSpec(draft);
      if (Array.from(JSON.stringify(next)).length > 50000) return;
      updateAttributes({ spec: next, valid: true }); close();
    } catch { setDraft(null); }
  };
  return <NodeViewWrapper className={`${styles.block} ${styles.architecture}`} data-align={node.attrs.align ?? "left"} contentEditable={false} onPointerDown={(event: React.PointerEvent) => event.stopPropagation()} onKeyDown={(event: React.KeyboardEvent) => event.stopPropagation()} onClick={(event: React.MouseEvent) => { if ((event.target as Element).closest("button,input,select,textarea")) return; const pos = getPos(); if (editor.isEditable && typeof pos === "number") editor.commands.setNodeSelection(pos); }}>
    <div className={styles.heading}><span>{node.attrs.title ?? "아키텍처"}</span><div><button ref={opener} type="button" disabled={!editable} onClick={show}>구성도 편집</button><button type="button" aria-label="아키텍처 블록 삭제" disabled={!editable || open} onClick={() => { if (editor.isEditable) deleteNode(); }}>삭제</button></div></div>
    <div onDoubleClick={show}>{validSpec ? <ArchitectureBlock spec={validSpec} title={null} /> : <p className={styles.error} role="alert">구성도를 편집해 올바른 요소와 연결을 입력해 주세요.</p>}</div>
    {open && createPortal(<dialog ref={dialog} className={styles.dialog} aria-labelledby={headingId} onCancel={event => { event.preventDefault(); close(); }} onClose={() => { setOpen(false); opener.current?.focus(); }} onPointerDown={event => event.stopPropagation()} onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); close(); } event.stopPropagation(); }}>
      <header><h2 id={headingId}>구성도 편집</h2><button type="button" aria-label="구성도 편집 취소" onClick={close}>×</button></header>
      <fieldset disabled={!editable} className={styles.diagramEditor}><ArchitectureEditor initialValue={spec} embedded onChange={setDraft} /></fieldset>
      {!draft && <p className={styles.error} role="alert">입력 오류를 수정하면 구성도를 적용할 수 있습니다.</p>}
      <footer><button type="button" onClick={close}>취소</button><button type="button" disabled={!editable || !draft} onClick={apply}>적용</button></footer>
    </dialog>, document.body)}
  </NodeViewWrapper>;
}
