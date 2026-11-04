"use client";
import type { Editor } from "@tiptap/core";
import { useEffect, useRef, useState } from "react";
import { canPlaceBodyBlockBeside, placeBodyBlockBeside, sideOfBlockDrop, blockGapContext, movableBlocks, moveBodyBlock, type MovableBlock } from "../block-move";
import styles from "./body-block-handle.module.css";

type Block = MovableBlock & { rect: DOMRect; table: boolean };
type Drag = { source: number; doc: EditorDoc; gap: number; started: boolean; x:number; y: number; beside?:{target:number;side:"left"|"right"} };

type EditorDoc = NonNullable<Editor>["state"]["doc"];

export function BodyBlockHandle({ editor, disabled }: { editor: Editor | null; disabled: boolean }) {
  const [hover, setHover] = useState<Block | null>(null);
  const [line, setLine] = useState<{ left: number; top: number; width: number; height?:number; side?:"left"|"right" } | null>(null);
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
        if (Math.hypot(event.clientX-current.x,event.clientY-current.y)>4) current.started = true;
        if (!current.started || !items.length) return;
        const source=items.find(item=>item.pos===current.source);
        const besideTarget=source?items.filter(item=>canPlaceBodyBlockBeside(source,item)&&sideOfBlockDrop(event.clientX,event.clientY,item.rect)).sort((a,b)=>a.rect.width*a.rect.height-b.rect.width*b.rect.height)[0]:null;
        const side=besideTarget?sideOfBlockDrop(event.clientX,event.clientY,besideTarget.rect):null;
        if(besideTarget&&side){
          current.beside={target:besideTarget.pos,side};
          setLine({left:side==="left"?besideTarget.rect.left:besideTarget.rect.right,top:besideTarget.rect.top,width:3,height:Math.max(24,besideTarget.rect.height),side});
          if(event.clientY<96)window.scrollBy(0,-12);else if(event.clientY>window.innerHeight-48)window.scrollBy(0,12);
          event.preventDefault();return;
        }
        current.beside=undefined;
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
      const tr = current.beside?placeBodyBlockBeside(editor.state.tr,current.source,current.beside.target,current.beside.side):moveBodyBlock(editor.state.tr, current.source, current.gap);
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
    aria-label="본문 블록 이동" title="드래그해서 이동 · 문단 좌우 끝에 놓으면 나란히 배치 · Alt+↑/↓"
    onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { source: hover.pos, doc: editor.state.doc, gap: hover.pos, started: false, x:event.clientX, y: event.clientY }; }}
    onKeyDown={event => { if (!event.altKey || !["ArrowUp", "ArrowDown"].includes(event.key)) return; event.preventDefault();
      const siblings = movableBlocks(editor.state.doc).filter(item => item.parentPos === hover.parentPos);
      const index = siblings.findIndex(item => item.pos === hover.pos);
      const neighbor = siblings[index + (event.key === "ArrowUp" ? -1 : 1)];
      const gap = event.key === "ArrowUp" ? neighbor?.pos : neighbor?.end;
      if (gap === undefined) return; const tr = moveBodyBlock(editor.state.tr, hover.pos, gap); if (tr) { editor.view.dispatch(tr); setHover(null); } }}>
    <svg aria-hidden="true" viewBox="0 0 16 24">{[6,12,18].flatMap(y => [5,11].map(x => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.4" fill="currentColor"/>))}</svg>
  </button>}{line && <div className={`${styles.line} ${line.side?styles.sideLine:""}`} style={{left:line.left,top:line.top,width:line.width,height:line.height}} role="status" aria-label={line.side?`${line.side==="left"?"왼쪽":"오른쪽"}에 나란히 배치`:"블록 이동 위치"}/>}</>;
}
