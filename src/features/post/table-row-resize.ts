import { cursorInTableCell } from "./table-tools.ts";
import { Plugin, PluginKey, type EditorState, type Transaction } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { resizeTableSegments } from "./table-resize.ts";

export function setTableRowHeight(state: EditorState, pos: number, height: number): Transaction | null {
  const row = state.doc.nodeAt(pos);
  if (row?.type.spec.tableRole !== "row" || !Number.isInteger(height) || height < 20 || height > 1200) return null;
  return state.tr.setNodeMarkup(pos, undefined, { ...row.attrs, height });
}

/** Preserve the rendered total when rounding the heights stored in the document. */
export function normalizeRowHeights(measured: number[]) {
  if (!measured.length || measured.some(height => !Number.isFinite(height) || height < 20 || height > 1200)) return null;
  const heights = measured.map(Math.round);
  let difference = Math.round(measured.reduce((sum, height) => sum + height, 0)) - heights.reduce((sum, height) => sum + height, 0);
  for (let i = heights.length - 1; i >= 0 && difference; i--) {
    const adjustment = Math.max(20 - heights[i], Math.min(1200 - heights[i], difference));
    heights[i] += adjustment; difference -= adjustment;
  }
  return heights;
}

export function resizeRowHeights(measured: number[], boundary: number, delta: number, minimums = measured.map(() => 20)) {
  const heights = normalizeRowHeights(measured);
  if (!heights || minimums.length !== heights.length || minimums.some(height => !Number.isFinite(height) || height < 0)) return null;
  // Never increase a minimum beyond the already rendered height because of subpixel rounding.
  return resizeTableSegments(heights, boundary, delta, heights.map((height, index) => Math.max(20, Math.min(height, Math.ceil(minimums[index])))), 1200);
}

export function freezeTableRowHeights(state: EditorState, tablePos: number, measured: number[]): Transaction | null {
  const table = state.doc.nodeAt(tablePos), heights = normalizeRowHeights(measured);
  if (table?.type.spec.tableRole !== "table" || !heights || table.childCount !== heights.length) return null;
  const tr = state.tr;
  // Freeze the other rendered heights so browser table layout cannot redistribute spare space.
  table.forEach((row, offset, index) => {
    if (row.attrs.height !== heights[index]) tr.setNodeMarkup(tablePos + 1 + offset, undefined, { ...row.attrs, height: heights[index] });
  });
  return tr.docChanged ? tr : null;
}

export function resizeTableRowBoundary(state: EditorState, tablePos: number, measured: number[], boundary: number, delta: number, minimums?: number[]): Transaction | null {
  const heights = resizeRowHeights(measured, boundary, delta, minimums);
  return heights ? freezeTableRowHeights(state, tablePos, heights) : null;
}

type Resize = { tablePos: number; positions: number[]; boundary: number; startY: number; initial: number[]; minimums: number[]; heights: number[]; cellPos: number; moved: boolean };
const key = new PluginKey<Resize | null>("pebbleRowResize");

/** Measure natural content at the same column widths, without changing the editable table. */
function minimumRowHeights(table: HTMLTableElement) {
  const probe = table.cloneNode(true) as HTMLTableElement;
  probe.removeAttribute("id"); probe.querySelectorAll("[id]").forEach(element => element.removeAttribute("id"));
  probe.setAttribute("aria-hidden", "true"); probe.contentEditable = "false";
  Object.assign(probe.style, { position: "fixed", left: "-100000px", top: "0", visibility: "hidden", pointerEvents: "none", width: `${table.getBoundingClientRect().width}px`, minWidth: "0", height: "auto", minHeight: "0" });
  Array.from(probe.rows).forEach(row => { row.style.height = "20px"; });
  // The sibling stays inside the same styled node-view wrapper and is removed synchronously.
  table.after(probe);
  try { return Array.from(probe.rows).map(row => row.getBoundingClientRect().height); }
  finally { probe.remove(); }
}

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
  return view.state.doc.nodeAt(pos)?.type.spec.tableRole === "row" ? { table, rows, index: rows.indexOf(row) } : null;
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
        const active = key.getState(state);
        // A separate CSS property leaves persisted inline heights intact when a preview is removed.
        return active ? DecorationSet.create(state.doc, active.positions.map((pos, index) => Decoration.node(pos, pos + state.doc.nodeAt(pos)!.nodeSize, { "data-row-resizing": "true", style: `--pebble-row-preview-height: ${active.heights[index]}px` }))) : null;
      },
      handleDOMEvents: {
        pointermove(view, event) {
          if (!key.getState(view.state)) view.dom.style.cursor = boundary(view, event) ? "row-resize" : "";
          return false;
        },
        pointerleave(view) { if (!key.getState(view.state)) view.dom.style.cursor = ""; return false; },
        pointerdown(view, event) {
          if (event.button !== 0 || view.composing) return false;
          const hit = boundary(view, event); if (!hit) return false;
          const initial = hit.rows.map(row => row.getBoundingClientRect().height);
          const heights = normalizeRowHeights(initial); if (!heights) return false;
          const positions = hit.rows.map(row => view.posAtDOM(row, 0) - 1);
          event.preventDefault();
          view.dispatch(view.state.tr.setMeta(key, { tablePos: positions[0] - 1, positions, boundary: hit.index, startY: event.clientY, initial, minimums: minimumRowHeights(hit.table), heights, cellPos: view.posAtDOM((event.target as Element).closest("td,th")!, 0) - 1, moved: false }).setMeta("addToHistory", false));
          return true;
        },
      },
    },
    view(view) {
      const doc = view.dom.ownerDocument, owner = doc.defaultView;
      const cancel = () => {
        if (key.getState(view.state)) view.dispatch(view.state.tr.setMeta(key, null).setMeta("addToHistory", false));
        view.dom.style.cursor = "";
      };
      const move = (event: PointerEvent) => {
        const active = key.getState(view.state); if (!active) return;
        if (!view.editable) { cancel(); return; }
        if (!event.buttons) { finish(event); return; }
        event.preventDefault(); view.dom.style.cursor = "row-resize";
        const initial = normalizeRowHeights(active.initial)!;
        const heights = resizeRowHeights(active.heights, active.boundary, initial[active.boundary] + event.clientY - active.startY - active.heights[active.boundary], active.minimums);
        if (heights) view.dispatch(view.state.tr.setMeta(key, { ...active, moved: active.moved || Math.abs(event.clientY - active.startY) > 3, heights }).setMeta("addToHistory", false));
      };
      const finish = (event?: PointerEvent) => {
        const active = key.getState(view.state); if (!active) return;
        const initial = normalizeRowHeights(active.initial)!;
        const heights = event ? resizeRowHeights(active.heights, active.boundary, initial[active.boundary] + event.clientY - active.startY - active.heights[active.boundary], active.minimums)! : active.heights;
        const moved = active.moved || !!event && Math.abs(event.clientY - active.startY) > 3;
        const changed = heights.some((height, index) => height !== initial[index]);
        const tr = !view.editable ? null : moved
          ? changed ? freezeTableRowHeights(view.state, active.tablePos, heights) : null
          : cursorInTableCell(view.state.tr, active.cellPos);
        if (tr) { view.dispatch(tr.setMeta(key, null)); if (!moved) view.focus(); } else cancel();
        view.dom.style.cursor = "";
      };
      const escape = (event: KeyboardEvent) => { if (event.key === "Escape") cancel(); };
      doc.addEventListener("pointermove", move);
      doc.addEventListener("pointerup", finish);
      doc.addEventListener("pointercancel", cancel);
      owner?.addEventListener("blur", cancel);
      owner?.addEventListener("resize", cancel);
      doc.addEventListener("keydown", escape);
      return { destroy() {
        doc.removeEventListener("pointermove", move); doc.removeEventListener("pointerup", finish);
        owner?.removeEventListener("blur", cancel); owner?.removeEventListener("resize", cancel); doc.removeEventListener("pointercancel", cancel); doc.removeEventListener("keydown", escape);
        view.dom.style.cursor = "";
      } };
    },
  });
}
