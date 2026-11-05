import type { EditorView } from "@tiptap/pm/view";

/** End an interrupted IME session on focus loss without rewriting text or stealing focus back. */
export function installEditorCompositionBoundary(view: EditorView, onSettled: () => void) {
  const dom = view.dom, doc = dom.ownerDocument, owner = doc.defaultView;
  let pending: ReturnType<typeof setTimeout> | undefined;
  let pasteTimer: ReturnType<typeof setTimeout> | undefined;
  const pastes: string[] = [];
  const pasteSettledCode = () => {
    clearTimeout(pasteTimer);
    pasteTimer = undefined;
    if (view.isDestroyed || view.composing) return;
    const queued = pastes.splice(0);
    // Do not steal focus or apply a delayed paste to a different kind of block.
    if (!view.hasFocus() || !view.state.selection.$from.parent.type.spec.code) return;
    for (const text of queued) view.pasteText(text);
  };
  const settled = () => {
    clearTimeout(pending);
    // ProseMirror flushes pending DOM mutations after compositionend. Publish only after that flush.
    pending = setTimeout(() => {
      if (!view.isDestroyed && !view.composing) {
        onSettled();
        if (pastes.length) pasteSettledCode();
      }
    }, 0);
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
  const paste = (event: ClipboardEvent) => {
    if (view.isDestroyed || (!view.composing && !pastes.length)) return;
    const { $from, $to } = view.state.selection;
    if (!$from.parent.type.spec.code || !$from.sameParent($to)) return;
    const text = event.clipboardData?.getData("text/plain");
    if (!text) return;
    // Native paste during a stranded composition can leave raw DOM text without
    // a document transaction, highlighting, or Enter handling until focus changes.
    event.preventDefault();
    pastes.push(text.replace(/\r\n?/g, "\n"));
    end();
    // ProseMirror reconciles the final composed text in a microtask first.
    pasteTimer ??= setTimeout(pasteSettledCode, 0);
  };
  const visibility = () => { if (doc.hidden) leaveWindow(); };
  dom.addEventListener("compositionend", settled);
  dom.addEventListener("paste", paste, true);
  dom.addEventListener("blur", end);
  owner?.addEventListener("blur", leaveWindow);
  doc.addEventListener("visibilitychange", visibility);
  return () => {
    clearTimeout(pending);
    clearTimeout(pasteTimer); pastes.length = 0;
    dom.removeEventListener("paste", paste, true);
    dom.removeEventListener("compositionend", settled); dom.removeEventListener("blur", end);
    owner?.removeEventListener("blur", leaveWindow); doc.removeEventListener("visibilitychange", visibility);
  };
}
