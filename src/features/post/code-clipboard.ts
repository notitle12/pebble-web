import { parseDocument } from "htmlparser2";
import { Element, Text, type ChildNode } from "domhandler";
import { Extension } from "@tiptap/core";
import { Fragment, Slice } from "@tiptap/pm/model";
import { Plugin } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

const codeMime = "application/x-pebble-code";
const normalize = (text: string) => text.replace(/\r\n?/g, "\n");
const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function codeOnlyHtml(html: string): boolean {
  const onlyCode = (nodes: ChildNode[]): boolean => {
    const visible = nodes.filter(node => node instanceof Element ? !["meta", "head"].includes(node.name) : node instanceof Text && !!node.data.trim());
    return visible.length > 0 && visible.every(node => node instanceof Element && (node.name === "pre" || ["html", "body", "div"].includes(node.name) && onlyCode(node.children)));
  };
  return onlyCode(parseDocument(html).children);
}

function copyCode(view: EditorView, event: ClipboardEvent, cut = false) {
  const { $from, $to, empty } = view.state.selection;
  if (empty || !$from.parent.type.spec.code || !$from.sameParent($to) || !event.clipboardData || cut && !view.editable) return false;
  const text = view.state.doc.textBetween(view.state.selection.from, view.state.selection.to, "\n");
  try {
    event.clipboardData.clearData();
    event.clipboardData.setData("text/plain", text);
    event.clipboardData.setData("text/html", `<p>${escape(text).replace(/\n/g, "<br>")}</p>`);
    event.clipboardData.setData(codeMime, "1");
  } catch {
    // Let ProseMirror's normal copy handling run; never cut if copying failed.
    return false;
  }
  event.preventDefault();
  if (cut) view.dispatch(view.state.tr.deleteSelection().scrollIntoView().setMeta("uiEvent", "cut"));
  return true;
}

export const CodeClipboard = Extension.create({
  name: "codeClipboard",
  priority: 1200,
  addProseMirrorPlugins() {
    return [new Plugin({
      props: {
        handleDOMEvents: {
          copy: (view, event) => copyCode(view, event as ClipboardEvent),
          cut: (view, event) => copyCode(view, event as ClipboardEvent, true),
        },
        handlePaste: (view, event) => {
          if (!view.editable || view.state.selection.$from.parent.type.spec.code || !event.clipboardData) return false;
          const data = event.clipboardData;
          if (data.getData(codeMime) !== "1" && !codeOnlyHtml(data.getData("text/html"))) return false;
          const text = normalize(data.getData("text/plain"));
          const paragraph = view.state.schema.nodes.paragraph;
          if (!text || !paragraph) return false;
          const nodes = text.split("\n").map(line => paragraph.create(null, line ? view.state.schema.text(line) : null));
          view.dispatch(view.state.tr.replaceSelection(new Slice(Fragment.fromArray(nodes), 1, 1))
            .scrollIntoView().setMeta("paste", true).setMeta("uiEvent", "paste"));
          return true;
        },
      },
    })];
  },
});
