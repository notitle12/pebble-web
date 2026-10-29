import { Plugin, type EditorState } from "@tiptap/pm/state";
import { CellSelection, columnResizingPluginKey, tableEditingKey } from "@tiptap/pm/tables";
import type { EditorView } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";
import { cursorInTableCell } from "./table-tools.ts";

export function selectCellRange(state: EditorState, anchor: number, head: number) {
  for (const pos of [anchor, head]) {
    const cell = state.doc.nodeAt(pos);
    if (!cell || !["cell", "header_cell"].includes(cell.type.spec.tableRole)) return null;
  }
  const a = state.doc.resolve(anchor), b = state.doc.resolve(head);
  if (a.depth < 2 || b.depth < 2 || a.start(-1) !== b.start(-1)) return null;
  return state.tr.setSelection(CellSelection.create(state.doc, anchor, head)).setMeta("pointer", true);
}

/** Hit actual cell elements rather than nearest text coordinates in tall/empty cells. */
export function tableCellInteractions() {
  let gesture: { anchor: number; doc: PMNode; x: number; y: number; range: boolean } | null = null;
  const cellAt = (view: EditorView, target: EventTarget | null) => {
    const element = target as Element | null;
    const cell = element?.nodeType === 1 ? element.closest("td,th") : null;
    return cell && view.dom.contains(cell) ? cell : null;
  };
  const select = (view: EditorView, head: number) => {
    if (!gesture || gesture.doc !== view.state.doc) return false;
    const tr = selectCellRange(view.state, gesture.anchor, head); if (!tr) return false;
    gesture.range = true;
    view.dispatch(tr.setMeta(tableEditingKey, gesture.anchor)); view.focus(); return true;
  };
  const double = (view: EditorView, event: MouseEvent) => {
    if (!view.editable || view.composing || event.button !== 0) return false;
    const cell = cellAt(view, event.target); if (!cell) return false;
    const pos = view.posAtDOM(cell, 0) - 1, tr = selectCellRange(view.state, pos, pos);
    if (!tr) return false;
    event.preventDefault(); view.dispatch(tr); view.focus(); return true;
  };
  return new Plugin({ props: { handleDOMEvents: {
    mousedown(view, event) {
      if (!view.editable || view.composing || event.button !== 0 || event.ctrlKey || event.metaKey || columnResizingPluginKey.getState(view.state)?.dragging) return false;
      const cell = cellAt(view, event.target); if (!cell) return false;
      const pos = view.posAtDOM(cell, 0) - 1;
      const anchor = event.shiftKey && view.state.selection instanceof CellSelection ? view.state.selection.$anchorCell.pos : pos;
      gesture = { anchor, doc: view.state.doc, x: event.clientX, y: event.clientY, range: false };
      if (event.detail >= 2 || event.shiftKey) {
        event.preventDefault(); select(view, pos);
      } else if (event.target === cell || !cell.textContent?.trim() || view.state.selection instanceof CellSelection) {
        const tr = cursorInTableCell(view.state.tr, pos);
        if (tr) { event.preventDefault(); view.dispatch(tr.setMeta("pointer", true)); view.focus(); }
      }
      // This gesture owns table dragging. Native caret/text selection inside a
      // populated cell still works; the competing table mouse handler is skipped.
      return true;
    },
    dblclick: double,
  } }, view(view) {
    const doc = view.dom.ownerDocument, owner = doc.defaultView;
    const cancel = () => {
      gesture = null;
      if (!view.isDestroyed && tableEditingKey.getState(view.state) != null) view.dispatch(view.state.tr.setMeta(tableEditingKey, -1));
    };
    const move = (event: MouseEvent) => {
      if (!gesture) return;
      if (!event.buttons || gesture.doc !== view.state.doc) { cancel(); return; }
      if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) < 4 && !gesture.range) return;
      const cell = cellAt(view, event.target) ?? cellAt(view, doc.elementFromPoint(event.clientX, event.clientY));
      if (!cell) return;
      const pos = view.posAtDOM(cell, 0) - 1;
      if ((pos !== gesture.anchor || gesture.range) && select(view, pos)) event.preventDefault();
    };
    const finish = (event: MouseEvent) => {
      if (gesture?.range) { move(eventWithButtons(event)); event.preventDefault(); }
      cancel();
    };
    // mouseup.buttons is zero; resolve its final cell using the same drag path.
    const eventWithButtons = (event: MouseEvent) => ({ target: event.target, clientX: event.clientX, clientY: event.clientY, buttons: 1, preventDefault: () => event.preventDefault() } as MouseEvent);
    const drag = (event: DragEvent) => { if (gesture) event.preventDefault(); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") cancel(); };
    doc.addEventListener("mousemove", move, true); doc.addEventListener("mouseup", finish, true);
    doc.addEventListener("dragstart", drag, true); doc.addEventListener("keydown", escape);
    owner?.addEventListener("blur", cancel);
    return { destroy() {
      gesture = null;
      doc.removeEventListener("mousemove", move, true); doc.removeEventListener("mouseup", finish, true);
      doc.removeEventListener("dragstart", drag, true); doc.removeEventListener("keydown", escape);
      owner?.removeEventListener("blur", cancel);
    } };
  } });
}
