import { Extension, Node, nodeInputRule } from "@tiptap/core";
import { exitCode, newlineInCode } from "@tiptap/pm/commands";
import type { EditorState } from "@tiptap/pm/state";

export const dividerStyles = ["solid", "dashed", "double", "short"] as const;
export type DividerStyle = typeof dividerStyles[number];
export const dividerLabels: Record<DividerStyle, string> = { solid: "실선", dashed: "점선", double: "이중선", short: "짧은 선" };

export const StyledDivider = Node.create({
  name: "horizontalRule", group: "block", atom: true,
  addAttributes() { return { variant: {
    default: "solid",
    parseHTML: element => dividerStyles.find(style => element.classList.contains(`post-divider-${style}`)) ?? "solid",
    renderHTML: attrs => ({ class: `post-divider-${dividerStyles.includes(attrs.variant) ? attrs.variant : "solid"}` }),
  } }; },
  parseHTML() { return [{ tag: "hr" }]; },
  renderHTML({ HTMLAttributes }) { return ["hr", HTMLAttributes]; },
  addInputRules() { return [nodeInputRule({ find: /^(?:---|—-|___\s|\*\*\*\s)$/, type: this.type })]; },
});

export const TextPanel = Node.create({
  name: "textPanel", group: "block", content: "block+", defining: true,
  parseHTML() { return [{ tag: "div.post-text-block" }]; },
  renderHTML() { return ["div", { class: "post-text-block" }, 0]; },
  addKeyboardShortcuts() { return { "Mod-Enter": () => {
    const { $from } = this.editor.state.selection;
    for (let depth = $from.depth; depth > 0; depth--) {
      if ($from.node(depth).type.name !== this.name) continue;
      const pos = $from.after(depth);
      return this.editor.chain().insertContentAt(pos, { type: "paragraph" }).setTextSelection(pos + 1).run();
    }
    return false;
  } }; },
});

/** Custom code nodes use the same plain-text Enter behavior as codeBlock. */
export const CodeKeyboard = Extension.create({
  name: "codeKeyboard", priority: 1200,
  addKeyboardShortcuts() { return {
    Enter: () => !this.editor.view.composing && newlineInCode(this.editor.state, this.editor.view.dispatch),
    "Shift-Enter": () => !this.editor.view.composing && newlineInCode(this.editor.state, this.editor.view.dispatch),
    "Mod-Enter": () => exitCode(this.editor.state, this.editor.view.dispatch),
  }; },
});

export function slashMatch(state: EditorState) {
  const { $from, empty } = state.selection;
  if (!empty || $from.parent.type.name !== "paragraph") return null;
  const before = $from.parent.textBetween(0, $from.parentOffset, "\ufffc", "\ufffc");
  const match = /^\/([^/\n]{0,40})$/.exec(before);
  return match ? { from: $from.start(), to: $from.pos, query: match[1].toLocaleLowerCase().trim() } : null;
}
