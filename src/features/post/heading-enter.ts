import { TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";

/** End-of-heading Enter inserts one paragraph without splitting the following block. */
export function headingEnterTransaction(state: EditorState): Transaction | null {
  const { $from, empty } = state.selection;
  if (!empty || $from.parent.type.name !== "heading" || $from.parentOffset !== $from.parent.content.size) return null;
  const pos = $from.after();
  const next = state.doc.nodeAt(pos);
  const tr = state.tr;
  if (next?.type.name === "paragraph" && next.content.size === 0) {
    tr.setNodeMarkup(pos, undefined, { ...next.attrs, fontSize: "16px", id: null });
  } else {
    const paragraph = state.schema.nodes.paragraph.create({ fontSize: "16px", id: null });
    tr.insert(pos, paragraph);
  }
  return tr.setSelection(TextSelection.create(tr.doc, pos + 1)).scrollIntoView();
}
