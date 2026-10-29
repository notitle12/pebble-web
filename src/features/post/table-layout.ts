import type { EditorState, Transaction } from "@tiptap/pm/state";
import { CellSelection, TableMap, setCellAttr } from "@tiptap/pm/tables";
import type { Node as PMNode } from "@tiptap/pm/model";
import { tableContext } from "./table-tools.ts";

export function tableSelectionRect(state: EditorState) {
  const context = tableContext(state); if (!context) return null;
  const rect = state.selection instanceof CellSelection
    ? context.map.rectBetween(state.selection.$anchorCell.pos - context.start, state.selection.$headCell.pos - context.start)
    : context.map.findCell(context.cellPos - context.start);
  return { ...context, rect };
}

export function setCellVerticalAlignment(state: EditorState, alignment: "top" | "middle" | "bottom") {
  if (!tableContext(state)) return null;
  const results: Transaction[] = [];
  setCellAttr("verticalAlign", alignment)(state, tr => results.push(tr));
  return results[0] ?? null;
}

export type TableDimensions = { widths: number[]; heights: number[]; contentWidths?: number[] };
export function fitTableSelection(state: EditorState, mode: "columns" | "rows" | "content", dimensions: TableDimensions) {
  const context = tableSelectionRect(state); if (!context) return null;
  const { table, start, map, rect } = context;
  const tr = state.tr;
  if (mode !== "rows") {
    const widths = Array.from({ length: map.width }, (_, i) => Math.max(48, Math.min(1200, Math.round(dimensions.widths[i] || 120))));
    const average = Math.round(widths.slice(rect.left, rect.right).reduce((a, b) => a + b, 0) / (rect.right - rect.left));
    for (let col = rect.left; col < rect.right; col++) widths[col] = mode === "columns" ? average : Math.max(48, Math.min(600, Math.ceil(dimensions.contentWidths?.[col] || 48)));
    for (const offset of new Set(map.map)) {
      const cell = table.nodeAt(offset)!; const cellRect = map.findCell(offset);
      tr.setNodeMarkup(start + offset, undefined, { ...cell.attrs, colwidth: widths.slice(cellRect.left, cellRect.right) });
    }
  }
  if (mode !== "columns") {
    const average = Math.max(20, Math.min(1200, Math.round(dimensions.heights.slice(rect.top, rect.bottom).reduce((a, b) => a + b, 0) / (rect.bottom - rect.top)) || 25));
    table.forEach((row, offset, index) => {
      if (index >= rect.top && index < rect.bottom) tr.setNodeMarkup(start + offset, undefined, { ...row.attrs, height: mode === "content" ? null : average });
    });
  }
  return tr;
}

export type BorderMode = "all" | "outer" | "inner" | "none" | "top" | "right" | "bottom" | "left" | "reset";
export type BorderSettings = { color: string; width: number; style: "solid" | "dashed" | "dotted" | "hidden" };
const sides = ["top", "right", "bottom", "left"] as const;
const attributes = { top: "borderTop", right: "borderRight", bottom: "borderBottom", left: "borderLeft" };
const opposite = { top: "bottom", right: "left", bottom: "top", left: "right" } as const;
export function setSelectionBorders(state: EditorState, mode: BorderMode, settings: BorderSettings) {
  const context = tableSelectionRect(state);
  if (!context || !/^#[0-9a-f]{6}$/i.test(settings.color) || ![1, 2, 3, 4].includes(settings.width) || !["solid", "dashed", "dotted", "hidden"].includes(settings.style)) return null;
  const { map, table, start, rect } = context;
  const value = settings.style === "hidden" ? "0px hidden" : `${settings.width}px ${settings.style} ${settings.color}`;
  const patches = new Map<number, Record<string, unknown>>();
  const patch = (offset: number, side: typeof sides[number], border: string | null) => {
    patches.set(offset, { ...patches.get(offset), [attributes[side]]: border });
  };
  for (const offset of map.cellsInRect(rect)) {
    const cellRect = map.findCell(offset);
    for (const side of sides) {
      const outer = side === "top" ? cellRect.top === rect.top : side === "bottom" ? cellRect.bottom === rect.bottom : side === "left" ? cellRect.left === rect.left : cellRect.right === rect.right;
      if (mode === "inner" && outer || sides.includes(mode as typeof sides[number]) && (mode !== side || !outer)) continue;
      const border = mode === "reset" ? null : mode === "none" || mode === "outer" && !outer ? "0px hidden" : value;
      patch(offset, side, border);
      // A shared edge must change on both sides, including neighbors outside the selection.
      const neighbors: number[] = [];
      if (side === "top" && cellRect.top > 0 || side === "bottom" && cellRect.bottom < map.height) {
        const row = side === "top" ? cellRect.top - 1 : cellRect.bottom;
        for (let col = cellRect.left; col < cellRect.right; col++) neighbors.push(map.map[row * map.width + col]);
      }
      if (side === "left" && cellRect.left > 0 || side === "right" && cellRect.right < map.width) {
        const col = side === "left" ? cellRect.left - 1 : cellRect.right;
        for (let row = cellRect.top; row < cellRect.bottom; row++) neighbors.push(map.map[row * map.width + col]);
      }
      for (const neighbor of new Set(neighbors)) if (neighbor !== offset) patch(neighbor, opposite[side], border);
    }
  }
  const tr = state.tr;
  for (const [offset, attrs] of patches) tr.setNodeMarkup(start + offset, undefined, { ...table.nodeAt(offset)!.attrs, ...attrs });
  return tr;
}

export function moveTableBand(state: EditorState, tablePos: number, axis: "row" | "column", from: number, to: number) {
  const table = state.doc.nodeAt(tablePos); if (table?.type.spec.tableRole !== "table") return null;
  const map = TableMap.get(table), size = axis === "row" ? map.height : map.width;
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= size || to >= size || from === to) return null;
  // Moving across merged geometry would split cells; leave those tables unchanged.
  if ([...new Set(map.map)].some(pos => { const cell = table.nodeAt(pos)!; return cell.attrs.colspan !== 1 || cell.attrs.rowspan !== 1; })) return null;
  const reorder = <T,>(values: T[]) => { const next = [...values]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next; };
  let rows: PMNode[] = []; table.forEach(row => rows.push(row));
  if (axis === "row") rows = reorder(rows);
  else rows = rows.map(row => { const cells: PMNode[] = []; row.forEach(cell => cells.push(cell)); return row.type.create(row.attrs, reorder(cells), row.marks); });
  const next = table.type.create(table.attrs, rows, table.marks), nextMap = TableMap.get(next);
  const tr = state.tr.replaceWith(tablePos, tablePos + table.nodeSize, next), start = tablePos + 1;
  const first = axis === "row" ? to * map.width : to;
  const last = axis === "row" ? first + map.width - 1 : (map.height - 1) * map.width + to;
  return tr.setSelection(CellSelection.create(tr.doc, start + nextMap.map[first], start + nextMap.map[last]));
}
