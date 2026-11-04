import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { parseDocument } from "htmlparser2";
import { Element } from "domhandler";
import render from "dom-serializer";
import { themeColorVariables } from "./theme-color.ts";

const cssValue = (value: string) => value.replace(/[;{}]/g, "").trim();
const cssVariables = (variables: Record<string, string>) => Object.entries(variables).map(([name, value]) => `${name}: ${cssValue(value)}`).join("; ");

function nodeColor(node: { marks?: readonly { type: { name: string }; attrs: Record<string, unknown> }[] }) {
  const text = node.marks?.find(mark => mark.type.name === "textStyle")?.attrs.color;
  const highlightMark = node.marks?.find(mark => mark.type.name === "highlight");
  const highlight = highlightMark?.attrs.color;
  return { text: typeof text === "string" ? text : undefined, highlight: typeof highlight === "string" ? highlight : undefined };
}

export const ThemeTextDecorations = Extension.create({
  name: "themeTextDecorations",
  addProseMirrorPlugins() {
    return [new Plugin({
      props: {
        decorations(state) {
          const decorations: Decoration[] = [];
          state.doc.descendants((node, pos) => {
            if (node.type.name === "pebbleCode" || node.type.name === "codeBlock") return false;
            if (!node.isText) return;
            const { text, highlight } = nodeColor(node);
            if (!text && !highlight) return;
            const variables = themeColorVariables(text ?? "#202124", highlight);
            if (!variables) return;
            decorations.push(Decoration.inline(pos, pos + node.nodeSize, {
              class: highlight ? "pebble-theme-text pebble-theme-highlight" : "pebble-theme-text",
              style: cssVariables(variables),
            }, { inclusiveStart: false, inclusiveEnd: false }));
          });
          return DecorationSet.create(state.doc, decorations);
        },
      },
    })];
  },
});

function styleMap(style: string) {
  const entries: [string, string][] = style.split(";").map(part => {
    const split = part.indexOf(":");
    return split < 0 ? ["", ""] : [part.slice(0, split).trim().toLowerCase(), part.slice(split + 1).trim()];
  });
  return new Map(entries.filter(([name, value]) => !!name && !!value));
}

function walk(nodes: readonly import("domhandler").ChildNode[], insideCode = false) {
  for (const node of nodes) {
    if (!(node instanceof Element)) continue;
    const skip = insideCode || node.name === "pre" || node.name === "code";
    if (!skip) {
      const styles = styleMap(node.attribs.style ?? "");
      const highlight = node.name === "mark" ? node.attribs["data-color"] || styles.get("background-color") : styles.get("background-color");
      const text = styles.get("color");
      if (text || highlight) {
        const variables = themeColorVariables(text ?? "#202124", highlight);
        if (variables) {
          node.attribs.class = [...new Set([...(node.attribs.class ?? "").split(/\s+/).filter(Boolean), "pebble-theme-text", ...(highlight ? ["pebble-theme-highlight"] : [])])].join(" ");
          node.attribs.style = `${node.attribs.style ?? ""}${node.attribs.style?.trim() ? "; " : ""}${cssVariables(variables)}`;
        }
      }
    }
    walk(node.children, skip);
  }
}

/** Call only after the content has passed the existing HTML sanitizer. */
export function addThemeColorsToSanitizedHtml(html: string): string {
  const document = parseDocument(html);
  walk(document.children);
  return render(document.children);
}
