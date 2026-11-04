"use client";
import type { Editor } from "@tiptap/core";
import { useEffect, useRef, useState } from "react";
import { blockGapContext, movableBlocks, moveBodyBlock, type MovableBlock } from "../block-move";
import styles from "./body-block-handle.module.css";

type Block = MovableBlock & { rect: DOMRect; table: boolean };
type Drag = { source: number; doc: EditorDoc; gap: number; started: boolean; y: number };

type EditorDoc = NonNullable<Editor>["state"]["doc"];

export function BodyBlockHandle({ editor, disabled }: { editor: Editor | null; disabled: boolean }) {
  const [hover, setHover] = useState<Block | null>(null);
  const [line, setLine] = useState<{ left: number; top: number; width: number } | null>(null);
  const drag = useRef<Drag | null>(null);
  useEffect(() => {
    if (!editor || disabled) { setHover(null); return; }
    const blocks = (): Block[] => movableBlocks(editor.state.doc).flatMap(item => {
      const dom = editor.view.nodeDOM(item.pos);
      return dom instanceof HTMLElement ? [{ ...item, rect: dom.getBoundingClientRect(), table: item.node.type.spec.tableRole === "table" }] : [];
    });
    const move = (event: MouseEvent) => {
      const items = blocks();
      if (drag.current) {
        const current = drag.current;
        if (Math.abs(event.clientY - current.y) > 4) current.started = true;
        if (!current.started || !items.length) return;
        const located = editor.view.posAtCoords({ left: event.clientX, top: event.clientY });
        const context = located ? blockGapContext(editor.state.doc, located.pos) : null;
        const target = context && items.find(item => item.pos === context.before);
        if (context && target) {
          const after = event.clientY >= target.rect.top + target.rect.height / 2;
          current.gap = after ? context.after! : context.before!;
          setLine({ left: target.rect.left, top: after ? target.rect.bottom : target.rect.top, width: target.rect.width });
        } else if (context && context.before === null) {
          current.gap = context.pos;
          const parent = context.parentPos < 0 ? editor.view.dom : editor.view.nodeDOM(context.parentPos);
          const rect = parent instanceof HTMLElement ? parent.getBoundingClientRect() : editor.view.dom.getBoundingClientRect();
          setLine({ left: rect.left, top: rect.bottom, width: rect.width });
        } else {
          const topLevel = items.filter(item => item.parentPos === -1);
          const last = topLevel.at(-1);
          if (!last || event.clientY < last.rect.top + last.rect.height / 2) return;
          current.gap = editor.state.doc.content.size;
          setLine({ left: last.rect.left, top: last.rect.bottom, width: last.rect.width });
        }
        if (event.clientY < 96) window.scrollBy(0, -12);
        else if (event.clientY > window.innerHeight - 48) window.scrollBy(0, 12);
        event.preventDefault(); return;
      }
      if (event.target instanceof Element && event.target.closest("[data-body-block-handle]")) return;
      // Table row/column controls own the cell gutter. Offer whole-block movement farther left.
      if (event.target instanceof Element && event.target.closest("td,th,[data-table-band-control]")) { setHover(null); return; }
      const target = items.filter(item => event.clientY >= item.rect.top && event.clientY <= item.rect.bottom
        && event.clientX >= item.rect.left - 60 && event.clientX <= item.rect.right)
        .sort((a, b) => a.rect.width * a.rect.height - b.rect.width * b.rect.height)[0] ?? null;
      setHover(target);
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
    style={{ left: Math.max(0, hover.rect.left - (hover.table ? 58 : 30)), top: Math.max(74, hover.rect.top) }}
    aria-label="본문 블록 이동" title="드래그해서 이동 · Alt+↑/↓"
    onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { source: hover.pos, doc: editor.state.doc, gap: hover.pos, started: false, y: event.clientY }; }}
    onKeyDown={event => { if (!event.altKey || !["ArrowUp", "ArrowDown"].includes(event.key)) return; event.preventDefault();
      const siblings = movableBlocks(editor.state.doc).filter(item => item.parentPos === hover.parentPos);
      const index = siblings.findIndex(item => item.pos === hover.pos);
      const neighbor = siblings[index + (event.key === "ArrowUp" ? -1 : 1)];
      const gap = event.key === "ArrowUp" ? neighbor?.pos : neighbor?.end;
      if (gap === undefined) return; const tr = moveBodyBlock(editor.state.tr, hover.pos, gap); if (tr) { editor.view.dispatch(tr); setHover(null); } }}>
    <svg aria-hidden="true" viewBox="0 0 16 24">{[6,12,18].flatMap(y => [5,11].map(x => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.4" fill="currentColor"/>))}</svg>
  </button>}{line && <div className={styles.line} style={line}/>}</>;
}
