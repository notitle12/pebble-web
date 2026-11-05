import { Extension } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";

/** Select code contents before the document/table select-all shortcuts run. */
export const CodeBlockSelection = Extension.create({
  name: "codeBlockSelection",
  priority: 1200,
  addKeyboardShortcuts() {
    const selectCode = () => {
      if (!this.editor.isEditable || this.editor.view.composing) return false;
      const { state, view } = this.editor;
      const { $from, $to } = state.selection;
      if (!$from.parent.type.spec.code || !$from.sameParent($to)) return false;
      view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, $from.start(), $from.end())));
      return true;
    };
    return { "Mod-a": selectCode, "Ctrl-a": selectCode };
  },
});
