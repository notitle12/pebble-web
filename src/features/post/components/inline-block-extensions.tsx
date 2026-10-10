"use client";
import { Extension, Node as TiptapNode } from "@tiptap/core";
import { NodeViewWrapper, NodeViewContent, useEditorState, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { Table, TableView } from "@tiptap/extension-table";
import { Plugin } from "@tiptap/pm/state";
import type { DOMOutputSpec, Node as PMNode } from "@tiptap/pm/model";
import { parseTableSpec, parseArchitectureSpec } from "../api/post-list";
import { codeLanguages, defaultTextSizes, textSizes } from "../writer-document";
import { InlineCodeView, InlineTableSpecView, InlineArchitectureView, defaultInlineTableSpec, defaultInlineArchitectureSpec } from "./inline-block-views";
import { headingEnterTransaction } from "../heading-enter";
import styles from "./rich-body-editor.module.css";

export const InlineCode = TiptapNode.create({
  name: "pebbleCode", group: "block", content: "text*", marks: "", code: true, defining: true,
  addAttributes() { return { language: { default: "TYPESCRIPT" }, align: { default: "left", parseHTML: (element: HTMLElement) => ["left", "center", "right"].includes(element.getAttribute("data-align") || "") ? element.getAttribute("data-align") : "left", renderHTML: attrs => ({ "data-align": ["left", "center", "right"].includes(String(attrs.align)) ? attrs.align : "left" }) }, key: { default: null, rendered: false }, title: { default: null, rendered: false } }; },
  parseHTML() { return [{ tag: "pre", preserveWhitespace: "full", getAttrs: element => ({ language: codeLanguages.includes(element.getAttribute("data-language") ?? "") ? element.getAttribute("data-language") : "TYPESCRIPT", align: ["left", "center", "right"].includes(element.getAttribute("data-align") || "") ? element.getAttribute("data-align") : "left" }) }]; },
  renderHTML({ node, HTMLAttributes }) { return ["pre", { ...HTMLAttributes, "data-language": node.attrs.language }, ["code", {}, 0]]; },
  addNodeView() { return ReactNodeViewRenderer(InlineCodeView, { contentDOMElementTag: "code" }); },
  addProseMirrorPlugins() { return [new Plugin({ props: { handlePaste: (view, event) => {
    const { $from, $to, from, to } = view.state.selection;
    if ($from.parent.type.name !== this.name || !$from.sameParent($to) || !event.clipboardData) return false;
    const text = event.clipboardData.getData("text/plain");
    if (!text) return false;
    event.preventDefault();
    view.dispatch(view.state.tr.insertText(text.replace(/\r\n?/g, "\n"), from, to).scrollIntoView());
    return true;
  } } })]; },
  addKeyboardShortcuts() { return { Tab: () => this.editor.isActive(this.name) ? this.editor.commands.insertContent("  ") : false, "Mod-Enter": () => this.editor.isActive(this.name) ? this.editor.commands.exitCode() : false }; },
});
function ToggleView({ node, editor, updateAttributes }: NodeViewProps) {
  const editable = useEditorState({ editor, selector: ({ editor: current }) => current.isEditable });
  return <NodeViewWrapper className={styles.toggleBlock}>
    <div className={styles.toggleHeader} contentEditable={false}>
      <button type="button" aria-label={node.attrs.open ? "내용 접기" : "내용 펼치기"} aria-expanded={!!node.attrs.open} onClick={() => updateAttributes({ open: !node.attrs.open })}>
        <svg aria-hidden="true" viewBox="0 0 16 16" style={{ transform: node.attrs.open ? "rotate(90deg)" : undefined }}><path d="m6 3 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.6"/></svg>
      </button>
      <input aria-label="접는 글 제목" placeholder="제목을 입력하세요" value={node.attrs.summary} disabled={!editable} onChange={event => updateAttributes({ summary: event.target.value })}/>
    </div>
    <NodeViewContent className={styles.toggleContent} hidden={!node.attrs.open}/>
  </NodeViewWrapper>;
}
export const EditableToggle = TiptapNode.create({
  name: "details", group: "block", content: "block+", defining: true,
  addAttributes() { return {
    summary: { default: "", rendered: false, parseHTML: (element: HTMLElement) => element.querySelector("summary")?.textContent || "" },
    open: { default: true, parseHTML: (element: HTMLElement) => element.hasAttribute("open"), renderHTML: attrs => attrs.open ? { open: "" } : {} },
  }; },
  parseHTML() { return [{ tag: "details", contentElement: (element: HTMLElement) => element.querySelector("[data-details-content]") || element }]; },
  renderHTML({ node, HTMLAttributes }) { return ["details", HTMLAttributes, ["summary", {}, node.attrs.summary], ["div", { "data-details-content": "" }, 0]]; },
  addNodeView() { return ReactNodeViewRenderer(ToggleView); },
});

function structured(name: string, type: "TABLE" | "ARCHITECTURE") {
  return TiptapNode.create({
    name, group: "block", atom: true, defining: true,
    addAttributes() { return { spec: { default: type === "TABLE" ? defaultInlineTableSpec() : defaultInlineArchitectureSpec() }, align: { default: "left", parseHTML: (element: HTMLElement) => ["left", "center", "right"].includes(element.getAttribute("data-align") || "") ? element.getAttribute("data-align") : "left", renderHTML: attrs => ({ "data-align": ["left", "center", "right"].includes(String(attrs.align)) ? attrs.align : "left" }) }, key: { default: null, rendered: false }, title: { default: null }, valid: { default: true, rendered: false } }; },
    parseHTML() { return [{ tag: `div[data-pebble-type="${type}"]`, getAttrs: element => {
      try { const value = JSON.parse(element.getAttribute("data-pebble-spec") ?? ""); return { spec: type === "TABLE" ? parseTableSpec(value) : parseArchitectureSpec(value), title: element.getAttribute("data-pebble-title"), align: ["left", "center", "right"].includes(element.getAttribute("data-align") || "") ? element.getAttribute("data-align") : "left" }; } catch { return false; }
    } }]; },
    renderHTML({ node, HTMLAttributes }) { return ["div", { ...HTMLAttributes, "data-pebble-type": type, "data-pebble-spec": JSON.stringify(node.attrs.spec), ...(node.attrs.title ? { "data-pebble-title": node.attrs.title } : {}) }]; },
    addNodeView() { return ReactNodeViewRenderer(type === "TABLE" ? InlineTableSpecView : InlineArchitectureView); },
  });
}
export const InlineTableSpec = structured("tableSpec", "TABLE");
export const InlineArchitecture = structured("architectureSpec", "ARCHITECTURE");

function TocView({ node }: NodeViewProps) {
  return <NodeViewWrapper as="nav" className={styles.toc} contentEditable={false} aria-label="목차"><strong>목차</strong>{node.attrs.items.length ? <ol>{node.attrs.items.map((item: { id: string; text: string; level: number }) => <li key={item.id} style={{ paddingLeft: `${(item.level - 1) * 12}px` }}><a href={`#${item.id}`} onClick={event => { event.preventDefault(); document.getElementById(item.id)?.scrollIntoView({ block: "center" }); }}>{item.text || "제목 없음"}</a></li>)}</ol> : <p>본문에 제목을 추가하면 목차가 자동으로 표시됩니다.</p>}</NodeViewWrapper>;
}
export const TocNode = TiptapNode.create({
  name: "tableOfContents", group: "block", atom: true,
  addAttributes() { return { items: { default: [] } }; },
  parseHTML() { return [{ tag: "nav.post-toc", getAttrs: element => ({ items: Array.from(element.querySelectorAll("li")).map(li => ({ id: li.querySelector("a")?.getAttribute("href")?.slice(1) ?? "", text: li.textContent ?? "", level: Number(li.getAttribute("data-level")) || 1 })) }) }]; },
  renderHTML({ node }): DOMOutputSpec { return ["nav", { class: "post-toc", "aria-label": "목차" }, ["h2", {}, "목차"], ["ol", {}, ...node.attrs.items.map((item: { id: string; text: string; level: number }): DOMOutputSpec => ["li", { "data-level": item.level }, ["a", { href: `#${item.id}` }, item.text]])]]; },
  addNodeView() { return ReactNodeViewRenderer(TocView); },
});
export const HeadingParagraphReset = Extension.create({
  name: "headingParagraphReset", priority: 1100,
  addKeyboardShortcuts() { return { Enter: () => {
    if (this.editor.view.composing) return false;
    const tr = headingEnterTransaction(this.editor.state);
    if (!tr) return false;
    this.editor.view.dispatch(tr);
    return true;
  } }; },
  addProseMirrorPlugins() { return [new Plugin({ appendTransaction: (transactions, _oldState, state) => {
    if (!transactions.some(tr => tr.docChanged)) return null;
    const tr = state.tr;
    state.doc.descendants((node, pos) => {
      if (node.type.name === "paragraph" && node.attrs.fontSize && !textSizes.p.includes(node.attrs.fontSize)) tr.setNodeMarkup(pos, undefined, { ...node.attrs, fontSize: defaultTextSizes.p });
    });
    return tr.docChanged ? tr : null;
  } })]; },
});

export const AutomaticToc = Extension.create({
  name: "automaticToc",
  addProseMirrorPlugins() { return [new Plugin({ appendTransaction: (_transactions, _old, state) => {
    const headings: { id: string; text: string; level: number }[] = [], tocs: { node: PMNode; pos: number }[] = [], ids = new Set<string>();
    const tr = state.tr;
    state.doc.descendants((node, pos) => {
      if (node.type.name === "tableOfContents") { tocs.push({ node, pos }); return false; }
      if (node.type.name !== "heading") return;
      let id = typeof node.attrs.id === "string" && /^[\w-]+$/.test(node.attrs.id) ? node.attrs.id : `pebble-heading-${pos}`;
      while (ids.has(id)) id += "-copy";
      ids.add(id);
      headings.push({ id, text: node.textContent, level: node.attrs.level });
      if (node.attrs.id !== id) tr.setNodeMarkup(pos, undefined, { ...node.attrs, id });
    });
    for (const { node, pos } of tocs) if (JSON.stringify(node.attrs.items) !== JSON.stringify(headings)) tr.setNodeMarkup(pos, undefined, { ...node.attrs, items: headings });
    return tr.docChanged ? tr.setMeta("addToHistory", false) : null;
  } })]; },
});

export const ControllableTable = Table.extend({
  addNodeView() { return ({ node, view, HTMLAttributes, getPos }) => {
    const base = new TableView(node, this.options.cellMinWidth, view, HTMLAttributes);
    base.dom.classList.add(styles.editableTable);
    const syncAlignment = (next: PMNode) => {
      const align = ["left", "center", "right"].includes(next.attrs.align) ? next.attrs.align : "left";
      base.dom.setAttribute("data-align", align);
      base.contentDOM.closest("table")?.setAttribute("data-align", align);
    };
    syncAlignment(node);
    const columns = document.createElement("div"), rows = document.createElement("div"), remove = document.createElement("div");
    columns.className = styles.columnTools; rows.className = styles.rowTools; remove.className = styles.tableDelete;
    const buttons: HTMLButtonElement[] = [];
    const action = (command: "addColumnAfter" | "deleteColumn" | "addRowAfter" | "deleteRow" | "deleteTable") => {
      const pos = getPos(); if (typeof pos !== "number" || !this.editor.isEditable) return;
      const table = this.editor.state.doc.nodeAt(pos); if (!table) return;
      let rowOffset = 0, cellOffset = 0;
      table.forEach((row, offset, index) => { if (index === table.childCount - 1) { rowOffset = offset; row.forEach((_cell, cell, i) => { if (i === row.childCount - 1) cellOffset = cell; }); } });
      const chain = this.editor.chain().focus().setTextSelection(pos + rowOffset + cellOffset + 4);
      chain[command]().run();
    };
    const makeButton = (target: HTMLElement, text: string, label: string, command: Parameters<typeof action>[0]) => {
      const button = document.createElement("button"); button.type = "button"; button.textContent = text; button.setAttribute("aria-label", label); button.title = label; button.contentEditable = "false";
      button.addEventListener("mousedown", event => event.preventDefault()); button.addEventListener("click", () => action(command)); target.append(button); buttons.push(button); return button;
    };
    makeButton(columns, "+", "열 추가", "addColumnAfter"); const removeColumn = makeButton(columns, "−", "마지막 열 삭제", "deleteColumn");
    makeButton(rows, "+", "행 추가", "addRowAfter"); const removeRow = makeButton(rows, "−", "마지막 행 삭제", "deleteRow"); makeButton(remove, "×", "표 삭제", "deleteTable");
    columns.contentEditable = "false"; rows.contentEditable = "false"; remove.contentEditable = "false"; base.dom.append(columns, rows, remove);
    const refresh = (next: PMNode) => { for (const button of buttons) button.disabled = !this.editor.isEditable; removeColumn.disabled ||= next.firstChild?.childCount === 1; removeRow.disabled ||= next.childCount === 1; };
    refresh(node);
    return { dom: base.dom, contentDOM: base.contentDOM, update: (next: PMNode) => { const result = base.update(next); if (result) { syncAlignment(next); refresh(next); } return result; }, ignoreMutation: mutation => !base.contentDOM.contains(mutation.target) || base.ignoreMutation(mutation), stopEvent: event => columns.contains(event.target as globalThis.Node) || rows.contains(event.target as globalThis.Node) || remove.contains(event.target as globalThis.Node) };
  }; },
}).configure({ resizable: false });
