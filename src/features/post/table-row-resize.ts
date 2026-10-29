import { cursorInTableCell } from "./table-tools.ts";
import { Plugin, PluginKey, type EditorState, type Transaction } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export function setTableRowHeight(state: EditorState, pos: number, height: number): Transaction | null {
  const row = state.doc.nodeAt(pos);
  if (row?.type.spec.tableRole !== "row" || !Number.isInteger(height) || height < 20 || height > 1200) return null;
  return state.tr.setNodeMarkup(pos, undefined, { ...row.attrs, height });
}

type Resize = { pos: number; startY: number; initialHeight: number; height: number; cellPos: number; moved: boolean };
const key = new PluginKey<Resize | null>("pebbleRowResize");
const boundedHeight = (height: number) => Math.max(20, Math.min(1200, Math.round(height)));

function boundary(view: EditorView, event: PointerEvent) {
  if (!view.editable || !(event.target instanceof Element)) return null;
  const cell = event.target.closest("td,th"), table = cell?.closest("table");
  if (!cell || !table || !view.dom.contains(table)) return null;
  const cellRect = cell.getBoundingClientRect();
  // Column resizing takes priority at intersections of horizontal and vertical borders.
  if (Math.abs(event.clientX - cellRect.right) < 7) return null;
  const rows = Array.from(table.rows);
  const row = rows.find(element => Math.abs(event.clientY - element.getBoundingClientRect().bottom) <= 5);
  if (!row) return null;
  const pos = view.posAtDOM(row, 0) - 1;
  return view.state.doc.nodeAt(pos)?.type.spec.tableRole === "row" ? { pos, row } : null;
}

export function tableRowResizing() {
  return new Plugin<Resize | null>({
    key,
    state: {
      init: () => null,
      apply(tr, value) {
        const meta = tr.getMeta(key);
        if (meta !== undefined) return meta;
        // A concurrent document edit cancels the preview rather than changing another row.
        return tr.docChanged ? null : value;
      },
    },
    props: {
      decorations(state) {
        const active = key.getState(state), row = active && state.doc.nodeAt(active.pos);
        return active && row ? DecorationSet.create(state.doc, [Decoration.node(active.pos, active.pos + row.nodeSize, { style: `height: ${active.height}px` })]) : null;
      },
      handleDOMEvents: {
        pointermove(view, event) {
          if (!key.getState(view.state)) view.dom.style.cursor = boundary(view, event) ? "row-resize" : "";
          return false;
        },
        pointerleave(view) { if (!key.getState(view.state)) view.dom.style.cursor = ""; return false; },
        pointerdown(view, event) {
          if (event.button !== 0) return false;
          const hit = boundary(view, event); if (!hit) return false;
          event.preventDefault();
          const height = hit.row.getBoundingClientRect().height;
          view.dispatch(view.state.tr.setMeta(key, { pos: hit.pos, startY: event.clientY, initialHeight: height, height: boundedHeight(height), cellPos: view.posAtDOM((event.target as Element).closest("td,th")!, 0) - 1, moved: false }).setMeta("addToHistory", false));
          return true;
        },
      },
    },
    view(view) {
      const cancel = () => {
        if (key.getState(view.state)) view.dispatch(view.state.tr.setMeta(key, null).setMeta("addToHistory", false));
        view.dom.style.cursor = "";
      };
      const move = (event: PointerEvent) => {
        const active = key.getState(view.state); if (!active) return;
        event.preventDefault(); view.dom.style.cursor = "row-resize";
        view.dispatch(view.state.tr.setMeta(key, { ...active, moved: active.moved || Math.abs(event.clientY - active.startY) > 3, height: boundedHeight(active.initialHeight + event.clientY - active.startY) }).setMeta("addToHistory", false));
      };
      const finish = () => {
        const active = key.getState(view.state); if (!active) return;
        const tr = !view.editable ? null : active.moved ? setTableRowHeight(view.state, active.pos, active.height) : cursorInTableCell(view.state.tr, active.cellPos);
        if (tr) { view.dispatch(tr.setMeta(key, null)); if (!active.moved) view.focus(); } else cancel();
        view.dom.style.cursor = "";
      };
      const escape = (event: KeyboardEvent) => { if (event.key === "Escape") cancel(); };
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", finish);
      document.addEventListener("pointercancel", cancel);
      window.addEventListener("blur", cancel);
      document.addEventListener("keydown", escape);
      return { destroy() {
        document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", finish);
        window.removeEventListener("blur", cancel); document.removeEventListener("pointercancel", cancel); document.removeEventListener("keydown", escape);
        view.dom.style.cursor = "";
      } };
    },
  });
}
