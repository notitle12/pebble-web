"use client";
import {parseDatabaseSchema,newDatabaseSchema} from "../database-schema";
import {InlineDatabaseSchema} from "./inline-database-schema";
import { Extension, Node as TiptapNode } from "@tiptap/core";
import { NodeViewWrapper, NodeViewContent, useEditorState, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
export { ControllableTable } from "./editable-table-view";
import { Plugin } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { DOMOutputSpec, Node as PMNode } from "@tiptap/pm/model";
import { parseTableSpec, parseArchitectureSpec } from "../api/post-list";
import { codeLanguages, defaultTextSizes, textSizes } from "../writer-document";
import { InlineCodeView, InlineTableSpecView, InlineArchitectureView, defaultInlineTableSpec, defaultInlineArchitectureSpec } from "./inline-block-views";
import { headingEnterTransaction } from "../heading-enter";
import { tokenizeCode } from "../syntax-highlight";
import styles from "./rich-body-editor.module.css";

export const InlineCode = TiptapNode.create({
  name: "pebbleCode", group: "block", content: "text*", marks: "", code: true, defining: true,
  addAttributes() { return { language: { default: "TYPESCRIPT" }, align: { default: "left", parseHTML: (element: HTMLElement) => ["left", "center", "right"].includes(element.getAttribute("data-align") || "") ? element.getAttribute("data-align") : "left", renderHTML: attrs => ({ "data-align": ["left", "center", "right"].includes(String(attrs.align)) ? attrs.align : "left" }) }, key: { default: null, rendered: false }, title: { default: null, rendered: false } }; },
  parseHTML() { return [{ tag: "pre", preserveWhitespace: "full", getAttrs: element => {
    const explicitLang = (element.getAttribute("data-language") ?? "").toUpperCase();
    const codeClass = element.querySelector("code")?.className ?? "";
    const classMatch = (codeClass.match(/language-([a-z0-9_-]+)/i)?.[1] ?? "").toUpperCase();
    const detected = codeLanguages.includes(explicitLang) ? explicitLang : codeLanguages.includes(classMatch) ? classMatch : "TYPESCRIPT";
    return { language: detected, align: ["left", "center", "right"].includes(element.getAttribute("data-align") || "") ? element.getAttribute("data-align") : "left" };
  } }]; },
  renderHTML({ node, HTMLAttributes }) { return ["pre", { ...HTMLAttributes, "data-language": node.attrs.language }, ["code", {}, 0]]; },
  addNodeView() { return ReactNodeViewRenderer(InlineCodeView, { contentDOMElementTag: "code" }); },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handlePaste: (view, event) => {
            const { $from, $to, from, to } = view.state.selection;
            if ($from.parent.type.name !== this.name || !$from.sameParent($to) || !event.clipboardData) return false;
            const text = event.clipboardData.getData("text/plain");
            if (!text) return false;
            event.preventDefault();
            view.dispatch(view.state.tr.insertText(text.replace(/\r\n?/g, "\n"), from, to).scrollIntoView());
            return true;
          },
          decorations: (state) => {
            const decorations: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (node.type.name === this.name) {
                const code = node.textContent;
                const language = (node.attrs.language ?? "").toString();
                const tokens = tokenizeCode(code, language);
                let offset = 0;
                for (const token of tokens) {
                  const len = token.text.length;
                  if (token.type && len > 0) {
                    decorations.push(
                      Decoration.inline(pos + 1 + offset, pos + 1 + offset + len, {
                        class: `hl-${token.type}`,
                      })
                    );
                  }
                  offset += len;
                }
                return false;
              }
            });
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
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

function structured(name: string, type: "TABLE" | "ARCHITECTURE" | "DB_SCHEMA") {
  return TiptapNode.create({
    name, group: "block", atom: true, defining: true,
    addAttributes() { return { editorTab:{default:"ERD",rendered:false}, spec: { default: type === "DB_SCHEMA" ? newDatabaseSchema() : type === "TABLE" ? defaultInlineTableSpec() : defaultInlineArchitectureSpec() }, align: { default: "left", parseHTML: (element: HTMLElement) => ["left", "center", "right"].includes(element.getAttribute("data-align") || "") ? element.getAttribute("data-align") : "left", renderHTML: attrs => ({ "data-align": ["left", "center", "right"].includes(String(attrs.align)) ? attrs.align : "left" }) }, key: { default: null, rendered: false }, title: { default: null }, valid: { default: true, rendered: false } }; },
    parseHTML() { return [{ tag: `div[data-pebble-type="${type}"]`, getAttrs: element => {
      try { const value = JSON.parse(element.getAttribute("data-pebble-spec") ?? ""); return { spec: type === "DB_SCHEMA" ? parseDatabaseSchema(value) : type === "TABLE" ? parseTableSpec(value) : parseArchitectureSpec(value), title: element.getAttribute("data-pebble-title"), align: ["left", "center", "right"].includes(element.getAttribute("data-align") || "") ? element.getAttribute("data-align") : "left" }; } catch { return false; }
    } }]; },
    renderHTML({ node, HTMLAttributes }) { return ["div", { ...HTMLAttributes, "data-pebble-type": type, "data-pebble-spec": JSON.stringify(node.attrs.spec), ...(node.attrs.title ? { "data-pebble-title": node.attrs.title } : {}) }]; },
    addNodeView() { return ReactNodeViewRenderer(type === "DB_SCHEMA" ? InlineDatabaseSchema : type === "TABLE" ? InlineTableSpecView : InlineArchitectureView); },
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

export const InlineDatabase = structured("databaseSchema", "DB_SCHEMA");
