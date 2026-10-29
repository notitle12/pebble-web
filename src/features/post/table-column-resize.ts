import { updateColumns } from "@tiptap/extension-table";
import type { EditorView } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, type EditorState } from "@tiptap/pm/state";
import { columnResizingPluginKey, TableMap } from "@tiptap/pm/tables";

/** Give every column its current rendered width before changing one of them. */
export function freezeTableColumnWidths(state: EditorState, tablePos: number, measured: number[]) {
  const table = state.doc.nodeAt(tablePos);
  if (table?.type.spec.tableRole !== "table") return null;
  const map = TableMap.get(table);
  if (measured.length !== map.width || measured.some(width => !Number.isFinite(width) || width <= 0)) return null;
  const widths = normalizeColumnWidths(measured);
  const tr = state.tr;
  for (const offset of new Set(map.map)) {
    const cell = table.nodeAt(offset)!, rect = map.findCell(offset);
    const colwidth = widths.slice(rect.left, rect.right);
    if (JSON.stringify(cell.attrs.colwidth) !== JSON.stringify(colwidth)) tr.setNodeMarkup(tablePos + 1 + offset, undefined, { ...cell.attrs, colwidth });
  }
  return tr.docChanged ? tr : null;
}

/** Round without changing the total width of a rendered table. */
export function normalizeColumnWidths(measured: number[]) {
  const widths = measured.map(width => Math.max(48, Math.round(width)));
  let difference = Math.max(48 * widths.length, Math.round(measured.reduce((a, b) => a + b, 0))) - widths.reduce((a, b) => a + b, 0);
  for (let i = widths.length - 1; i >= 0 && difference; i--) {
    const adjustment = difference > 0 ? difference : Math.max(difference, 48 - widths[i]);
    widths[i] += adjustment; difference -= adjustment;
  }
  return widths;
}

export function pairedColumnWidths(measured: number[], boundary: number, delta: number) {
  if (!Number.isInteger(boundary) || boundary < 0 || boundary >= measured.length - 1 || !Number.isFinite(delta) || measured.some(width => !Number.isFinite(width) || width <= 0)) return null;
  const widths = normalizeColumnWidths(measured);
  const change = Math.max(48 - widths[boundary], Math.min(widths[boundary + 1] - 48, Math.round(delta)));
  widths[boundary] += change; widths[boundary + 1] -= change;
  return widths;
}

export function resizeTableBoundary(state: EditorState, tablePos: number, measured: number[], boundary: number, delta: number) {
  const widths = pairedColumnWidths(measured, boundary, delta);
  return widths ? freezeTableColumnWidths(state, tablePos, widths) : null;
}

type ResizeSession = { doc: PMNode; tablePos: number; table: HTMLTableElement; colgroup: HTMLTableColElement; widths: number[]; boundary: number; startX: number; delta: number };
export function stableTableColumnResizing() {
  let session: ResizeSession | null = null;
  const restore = (view: EditorView, active: ResizeSession) => {
    const table = view.state.doc.nodeAt(active.tablePos);
    if (active.table.isConnected && table?.type.spec.tableRole === "table") updateColumns(table, active.colgroup, active.table, 48);
  };
  return new Plugin({ props: { handleDOMEvents: {
    mousedown(view, event) {
      const resize = columnResizingPluginKey.getState(view.state);
      if (event.button !== 0 || !view.editable || view.composing || !resize || resize.activeHandle < 0 || resize.dragging) return false;
      const $cell = view.state.doc.resolve(resize.activeHandle), tableNode = $cell.node(-1), map = TableMap.get(tableNode);
      const start = $cell.start(-1), boundary = map.colCount(resize.activeHandle - start) + $cell.nodeAfter!.attrs.colspan - 1;
      const cellDOM = view.nodeDOM(resize.activeHandle) as Element | null;
      if (boundary >= map.width - 1 || !cellDOM || Math.abs(event.clientX - cellDOM.getBoundingClientRect().right) > 8) {
        view.dispatch(view.state.tr.setMeta(columnResizingPluginKey, { setHandle: -1 }).setMeta("addToHistory", false));
        return false;
      }
      const table = cellDOM.closest("table");
      const colgroup = table?.querySelector(":scope > colgroup") as HTMLTableColElement | null;
      if (!table || !colgroup) return false;
      const measured = Array.from(colgroup.children).map(col => col.getBoundingClientRect().width);
      if (measured.length !== map.width || measured.some(width => !Number.isFinite(width) || width <= 0)) return false;
      session = { doc: view.state.doc, tablePos: start - 1, table, colgroup, widths: normalizeColumnWidths(measured), boundary, startX: event.clientX, delta: 0 };
      event.preventDefault();
      view.dispatch(view.state.tr.setMeta(columnResizingPluginKey, { setDragging: { startX: event.clientX, startWidth: session.widths[boundary] } }).setMeta("addToHistory", false));
      return true;
    },
  } }, view(view) {
    const doc = view.dom.ownerDocument, owner = doc.defaultView;
    const cancel = () => {
      const active = session; session = null;
      if (!active || view.isDestroyed) return;
      restore(view, active);
      view.dispatch(view.state.tr.setMeta(columnResizingPluginKey, { setDragging: null }).setMeta("addToHistory", false));
    };
    const finish = (event: MouseEvent) => {
      const active = session; session = null;
      if (!active || view.isDestroyed) return;
      const delta = event.clientX - active.startX;
      const tr = view.editable && view.state.doc === active.doc && Math.abs(delta) > 2
        ? resizeTableBoundary(view.state, active.tablePos, active.widths, active.boundary, delta) : null;
      if (tr) view.dispatch(tr.setMeta(columnResizingPluginKey, { setDragging: null }));
      else {
        restore(view, active);
        view.dispatch(view.state.tr.setMeta(columnResizingPluginKey, { setDragging: null }).setMeta("addToHistory", false));
      }
    };
    const move = (event: MouseEvent) => {
      const active = session; if (!active) return;
      if (!view.editable || view.state.doc !== active.doc) { cancel(); return; }
      if (!event.buttons) { finish(event); return; }
      event.preventDefault(); active.delta = event.clientX - active.startX;
      const widths = pairedColumnWidths(active.widths, active.boundary, active.delta)!;
      // Preview only the colgroup. Commit one undoable document transaction on release.
      Array.from(active.colgroup.children).forEach((col, index) => {
        (col as HTMLElement).style.width = `${widths[index]}px`; (col as HTMLElement).style.minWidth = "";
      });
      active.table.style.width = `${widths.reduce((a, b) => a + b, 0)}px`; active.table.style.minWidth = "";
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") cancel(); };
    doc.addEventListener("mousemove", move); doc.addEventListener("mouseup", finish);
    doc.addEventListener("pointercancel", cancel); doc.addEventListener("keydown", escape); owner?.addEventListener("blur", cancel);
    return { destroy() {
      session = null;
      doc.removeEventListener("mousemove", move); doc.removeEventListener("mouseup", finish);
      doc.removeEventListener("pointercancel", cancel); doc.removeEventListener("keydown", escape); owner?.removeEventListener("blur", cancel);
    } };
  } });
}

export function tableGripCorridors(point: { x: number; y: number }, table: { left: number; top: number }, cell: { left: number; right: number; top: number; bottom: number }) {
  return {
    row: point.x >= table.left - 29 && point.x <= table.left + 8 && point.y >= cell.top - 3 && point.y <= cell.bottom + 3,
    column: point.y >= table.top - 29 && point.y <= table.top + 8 && point.x >= cell.left - 3 && point.x <= cell.right + 3,
  };
}
