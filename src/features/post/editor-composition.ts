import type { EditorView } from "@tiptap/pm/view";

/** End an interrupted IME session on focus loss without rewriting text or stealing focus back. */
export function installEditorCompositionBoundary(view: EditorView, onSettled: () => void) {
  const dom = view.dom, doc = dom.ownerDocument, owner = doc.defaultView;
  let pending: ReturnType<typeof setTimeout> | undefined;
  const settled = () => {
    clearTimeout(pending);
    // ProseMirror flushes pending DOM mutations after compositionend. Publish only after that flush.
    pending = setTimeout(() => { if (!view.isDestroyed && !view.composing) onSettled(); }, 0);
  };
  const end = () => {
    if (!view.isDestroyed && view.composing) {
      // Some window switches omit compositionend. Let ProseMirror's own handler clear its IME state.
      dom.dispatchEvent(new Event("compositionend", { bubbles: true }));
    }
  };
  const leaveWindow = () => {
    if (!view.isDestroyed && view.composing) dom.blur();
    end();
  };
  const visibility = () => { if (doc.hidden) leaveWindow(); };
  dom.addEventListener("compositionend", settled);
  dom.addEventListener("blur", end);
  owner?.addEventListener("blur", leaveWindow);
  doc.addEventListener("visibilitychange", visibility);
  return () => {
    clearTimeout(pending);
    dom.removeEventListener("compositionend", settled); dom.removeEventListener("blur", end);
    owner?.removeEventListener("blur", leaveWindow); doc.removeEventListener("visibilitychange", visibility);
  };
}
