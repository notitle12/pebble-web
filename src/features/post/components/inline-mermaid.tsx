"use client";

import { useRef, useState } from "react";
import { Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, useEditorState, type NodeViewProps } from "@tiptap/react";
import { tableAlignment } from "../block-alignment";
import { readMermaidSource, writeMermaidSource } from "../mermaid-source";
import { DiagramWidthFrame } from "./diagram-width-frame";
import { MermaidEditorDialog } from "./mermaid-editor-dialog";
import { MermaidPreview } from "./mermaid-preview";
import styles from "./mermaid-preview.module.css";

function MermaidNodeView({ node, editor, updateAttributes, deleteNode, getPos }: NodeViewProps) {
  const editable = useEditorState({ editor, selector: ({ editor }) => editor.isEditable });
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const source = String(node.attrs.source ?? "");
  const close = () => { setOpen(false); requestAnimationFrame(() => button.current?.focus({ preventScroll: true })); };

  return <NodeViewWrapper className={styles.block} data-align={node.attrs.align} contentEditable={false} onClick={(event: React.MouseEvent) => {
    if ((event.target as Element).closest("button,dialog")) return;
    const position = getPos();
    if (editor.isEditable && typeof position === "number") editor.commands.setNodeSelection(position);
  }}>
    <DiagramWidthFrame width={node.attrs.width} editable={editable} onCommit={width => updateAttributes({ width })}>
      <MermaidPreview source={source}/>
    </DiagramWidthFrame>
    <div className={styles.actions}>
      <button ref={button} className={styles.action} type="button" disabled={!editable} onClick={() => setOpen(true)}>코드 보기</button>
      <button className={styles.action} type="button" aria-label="Mermaid 블록 삭제" title="Mermaid 블록 삭제" disabled={!editable} onClick={deleteNode}>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4.5h10M6 4.5V3h4v1.5m1.5 0-.65 8.5h-5.7L4.5 4.5"/></svg>
      </button>
    </div>
    {open && editable && <MermaidEditorDialog initialSource={source} onCancel={close} onComplete={next => {
      if (editor.isEditable && next !== source) updateAttributes({ source: next });
      close();
    }}/>}
  </NodeViewWrapper>;
}

export const InlineMermaid = Node.create({
  name: "mermaidDiagram", group: "block", atom: true, defining: true,
  addAttributes() {
    return { source: { default: "", rendered: false }, width: { default: 100, rendered: false },
      key: { default: null, rendered: false }, title: { default: null, rendered: false }, align: { default: "left", rendered: false } };
  },
  parseHTML() {
    return [{ tag: "pre", priority: 80, getAttrs: element => {
      const code = element.querySelector("code");
      const classes = `${element.className} ${code?.className ?? ""}`.toLowerCase().split(/\s+/);
      if (element.getAttribute("data-language")?.toUpperCase() !== "MERMAID" && !classes.includes("language-mermaid")) return false;
      return { ...readMermaidSource(code?.textContent ?? element.textContent ?? ""), align: tableAlignment(element.getAttribute("data-align")) };
    } }];
  },
  renderHTML({ node }) {
    return ["pre", { "data-language": "MERMAID", "data-align": tableAlignment(node.attrs.align) }, ["code", {}, writeMermaidSource(node.attrs.source, node.attrs.width)]];
  },
  addNodeView() { return ReactNodeViewRenderer(MermaidNodeView); },
});
