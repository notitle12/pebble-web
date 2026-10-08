"use client";
import { Extension, Node as TiptapNode } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { Table, TableView } from "@tiptap/extension-table";
import { Plugin } from "@tiptap/pm/state";
import type { DOMOutputSpec, Node as PMNode } from "@tiptap/pm/model";
import { parseTableSpec, parseArchitectureSpec } from "../api/post-list";
import { codeLanguages, defaultTextSizes, textSizes } from "../writer-document";
import { InlineCodeView, InlineTableSpecView, InlineArchitectureView, defaultInlineTableSpec, defaultInlineArchitectureSpec } from "./inline-block-views";
import styles from "./rich-body-editor.module.css";

export const InlineCode = TiptapNode.create({
  name: "pebbleCode", group: "block", content: "text*", marks: "", code: true, defining: true,
  addAttributes() { return { language: { default: "TYPESCRIPT" }, key: { default: null, rendered: false }, title: { default: null, rendered: false } }; },
  parseHTML() { return [{ tag: "pre", preserveWhitespace: "full", getAttrs: element => ({ language: codeLanguages.includes(element.getAttribute("data-language") ?? "") ? element.getAttribute("data-language") : "TYPESCRIPT" }) }]; },
  renderHTML({ node }) { return ["pre", { "data-language": node.attrs.language }, ["code", {}, 0]]; },
  addNodeView() { return ReactNodeViewRenderer(InlineCodeView); },
  addKeyboardShortcuts() { return { Tab: () => this.editor.isActive(this.name) ? this.editor.commands.insertContent("  ") : false, "Mod-Enter": () => this.editor.isActive(this.name) ? this.editor.commands.exitCode() : false }; },
});
function structured(name: string, type: "TABLE" | "ARCHITECTURE") {
  return TiptapNode.create({
    name, group: "block", atom: true, defining: true,
    addAttributes() { return { spec: { default: type === "TABLE" ? defaultInlineTableSpec() : defaultInlineArchitectureSpec() }, key: { default: null, rendered: false }, title: { default: null }, valid: { default: true, rendered: false } }; },
    parseHTML() { return [{ tag: `div[data-pebble-type="${type}"]`, getAttrs: element => {
      try { const value = JSON.parse(element.getAttribute("data-pebble-spec") ?? ""); return { spec: type === "TABLE" ? parseTableSpec(value) : parseArchitectureSpec(value), title: element.getAttribute("data-pebble-title") }; } catch { return false; }
    } }]; },
    renderHTML({ node }) { return ["div", { "data-pebble-type": type, "data-pebble-spec": JSON.stringify(node.attrs.spec), ...(node.attrs.title ? { "data-pebble-title": node.attrs.title } : {}) }]; },
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
    const { $from, empty } = this.editor.state.selection;
    if (!empty || $from.parent.type.name !== "heading" || $from.parentOffset !== $from.parent.content.size) return false;
    return this.editor.chain().splitBlock().setParagraph().updateAttributes("paragraph", { fontSize: defaultTextSizes.p, id: null }).run();
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
    const columns = document.createElement("div"), rows = document.createElement("div");
    columns.className = styles.columnTools; rows.className = styles.rowTools;
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
    makeButton(rows, "+", "행 추가", "addRowAfter"); const removeRow = makeButton(rows, "−", "마지막 행 삭제", "deleteRow"); makeButton(rows, "삭제", "표 삭제", "deleteTable");
    columns.contentEditable = "false"; rows.contentEditable = "false"; base.dom.append(columns, rows);
    const refresh = (next: PMNode) => { for (const button of buttons) button.disabled = !this.editor.isEditable; removeColumn.disabled ||= next.firstChild?.childCount === 1; removeRow.disabled ||= next.childCount === 1; };
    refresh(node);
    return { dom: base.dom, contentDOM: base.contentDOM, update: (next: PMNode) => { const result = base.update(next); if (result) refresh(next); return result; }, ignoreMutation: mutation => !base.contentDOM.contains(mutation.target) || base.ignoreMutation(mutation), stopEvent: event => columns.contains(event.target as globalThis.Node) || rows.contains(event.target as globalThis.Node) };
  }; },
}).configure({ resizable: false });
