"use client";
import type { Editor } from "@tiptap/core";
import type { Node } from "@tiptap/pm/model";
import { useEffect, useRef, useState } from "react";
import { moveBodyBlock } from "../block-move";
import styles from "./body-block-handle.module.css";

type Block = { pos: number; end: number; rect: DOMRect };
type Drag = { source: number; doc: Node; gap: number; started: boolean; y: number };

export function BodyBlockHandle({ editor, disabled }: { editor: Editor | null; disabled: boolean }) {
  const [hover, setHover] = useState<Block | null>(null);
  const [line, setLine] = useState<{ left: number; top: number; width: number } | null>(null);
  const drag = useRef<Drag | null>(null);
  useEffect(() => {
    if (!editor || disabled) { setHover(null); return; }
    const blocks = (): Block[] => {
      const result: Block[] = [];
      editor.state.doc.forEach((node, pos) => {
        const dom = editor.view.nodeDOM(pos);
        if (dom instanceof HTMLElement) result.push({ pos, end: pos + node.nodeSize, rect: dom.getBoundingClientRect() });
      });
      return result;
    };
    const move = (event: MouseEvent) => {
      const items = blocks();
      if (drag.current) {
        const current = drag.current;
        if (Math.abs(event.clientY - current.y) > 4) current.started = true;
        if (!current.started || !items.length) return;
        const target = items.find(item => event.clientY < item.rect.top + item.rect.height / 2);
        current.gap = target?.pos ?? editor.state.doc.content.size;
        const rect = target?.rect ?? items[items.length - 1].rect;
        setLine({ left: rect.left, top: target ? rect.top : rect.bottom, width: rect.width });
        if (event.clientY < 96) window.scrollBy(0, -12);
        else if (event.clientY > window.innerHeight - 48) window.scrollBy(0, 12);
        event.preventDefault(); return;
      }
      if (event.target instanceof Element && event.target.closest("[data-body-block-handle]")) return;
      setHover(items.find(item => event.clientY >= item.rect.top && event.clientY <= item.rect.bottom
        && event.clientX >= item.rect.left - 40 && event.clientX <= item.rect.right) ?? null);
    };
    const end = () => {
      const current = drag.current; if (!current) return; drag.current = null; setLine(null); setHover(null);
      if (!current?.started || !editor.isEditable || !editor.state.doc.eq(current.doc)) return;
      const tr = moveBodyBlock(editor.state.tr, current.source, current.gap);
      if (tr) editor.view.dispatch(tr.scrollIntoView());
    };
    const cancel = () => { drag.current = null; setLine(null); setHover(null); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") cancel(); };
    const scroll = () => { if (!drag.current) setHover(null); };
    document.addEventListener("pointermove", move, { passive: false }); document.addEventListener("mousemove", move); document.addEventListener("mouseover", move); document.addEventListener("pointerup", end); document.addEventListener("mouseup", end);
    document.addEventListener("pointercancel", cancel); document.addEventListener("keydown", escape);
    window.addEventListener("scroll", scroll, true); window.addEventListener("blur", cancel);
    return () => { cancel(); document.removeEventListener("pointermove", move); document.removeEventListener("mousemove", move); document.removeEventListener("mouseover", move); document.removeEventListener("pointerup", end); document.removeEventListener("mouseup", end);
      document.removeEventListener("pointercancel", cancel); document.removeEventListener("keydown", escape);
      window.removeEventListener("scroll", scroll, true); window.removeEventListener("blur", cancel); };
  }, [editor, disabled]);
  if (!editor || disabled) return null;
  return <>{hover && <button data-body-block-handle type="button" className={styles.handle}
    style={{ left: Math.max(0, hover.rect.left - 30), top: Math.max(74, hover.rect.top) }}
    aria-label="본문 블록 이동" title="드래그해서 이동 · Alt+↑/↓"
    onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { source: hover.pos, doc: editor.state.doc, gap: hover.pos, started: false, y: event.clientY }; }}
    onKeyDown={event => { if (!event.altKey || !["ArrowUp", "ArrowDown"].includes(event.key)) return; event.preventDefault();
      const positions: number[] = []; editor.state.doc.forEach((_node, pos) => positions.push(pos));
      const index = positions.indexOf(hover.pos), gap = event.key === "ArrowUp" ? positions[index - 1] : positions[index + 2] ?? editor.state.doc.content.size;
      if (gap === undefined) return; const tr = moveBodyBlock(editor.state.tr, hover.pos, gap); if (tr) { editor.view.dispatch(tr); setHover(null); } }}>
    <svg aria-hidden="true" viewBox="0 0 16 24">{[6,12,18].flatMap(y => [5,11].map(x => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.4" fill="currentColor"/>))}</svg>
  </button>}{line && <div className={styles.line} style={line}/>}</>;
}
