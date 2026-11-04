import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { parseDocument } from "htmlparser2";
import { Element } from "domhandler";
import render from "dom-serializer";
import { borderThemePair, surfaceThemePair, themeBackgrounds, themeColorVariables, textThemePair, toHex, type ThemePair } from "./theme-color.ts";

const cssValue = (value: string) => value.replace(/[;{}]/g, "").trim();
const cssVariables = (variables: Record<string, string>) => Object.entries(variables).map(([name, value]) => `${name}: ${cssValue(value)}`).join("; ");
const pageSurfaces: ThemePair = { light: toHex(themeBackgrounds.light), dark: toHex(themeBackgrounds.dark) };
const borderClasses = (variables: Record<string, string>) => ["top", "right", "bottom", "left"].filter(side => variables[`--pebble-cell-border-${side}-light`]).map(side => `pebble-theme-border-${side}`);

function cellThemeVariables(attrs: Record<string, unknown>) {
  const authoredSurface = attrs.backgroundColor;
  const backgroundPair = authoredSurface ? surfaceThemePair(authoredSurface) : null;
  if (authoredSurface && !backgroundPair) return null;
  const surfaces = backgroundPair ?? pageSurfaces;
  const variables: Record<string, string> = {};
  if (backgroundPair) {
    variables["--pebble-cell-light"] = backgroundPair.light;
    variables["--pebble-cell-dark"] = backgroundPair.dark;
    const text = textThemePair("#202124", undefined, backgroundPair);
    if (text) {
      variables["--pebble-cell-text-light"] = text.light;
      variables["--pebble-cell-text-dark"] = text.dark;
    }
  }
  for (const [side, key] of [["top", "borderTop"], ["right", "borderRight"], ["bottom", "borderBottom"], ["left", "borderLeft"]]) {
    const pair = borderThemePair(attrs[key], surfaces);
    if (pair) {
      variables[`--pebble-cell-border-${side}-light`] = pair.light;
      variables[`--pebble-cell-border-${side}-dark`] = pair.dark;
    }
  }
  return variables;
}

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
            if (node.type.name === "tableCell" || node.type.name === "tableHeader") {
              const variables = cellThemeVariables(node.attrs);
              if (variables && Object.keys(variables).length) decorations.push(Decoration.node(pos, pos + node.nodeSize, {
                class: ["pebble-theme-cell", ...(variables["--pebble-cell-light"] ? ["pebble-theme-cell-surface"] : []), ...borderClasses(variables)].join(" "),
                style: cssVariables(variables),
              }));
            }
            if (!node.isText) return;
            const { text, highlight } = nodeColor(node);
            if (!text && !highlight) return;
            const $text = state.doc.resolve(pos + 1);
            let surfaces: ThemePair | undefined;
            for (let depth = $text.depth; depth > 0; depth--) {
              const ancestor = $text.node(depth);
              if (ancestor.type.name !== "tableCell" && ancestor.type.name !== "tableHeader") continue;
              const pair = ancestor.attrs.backgroundColor ? surfaceThemePair(ancestor.attrs.backgroundColor) : null;
              if (pair) surfaces = pair;
              break;
            }
            const variables = themeColorVariables(text ?? "#202124", highlight, surfaces);
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

function walk(nodes: readonly import("domhandler").ChildNode[], insideCode = false, surfaces: ThemePair = pageSurfaces, inheritedText = "#24352b") {
  for (const node of nodes) {
    if (!(node instanceof Element)) continue;
    const skip = insideCode || node.name === "pre" || node.name === "code";
    let childSurfaces = surfaces;
    if (!skip) {
      const styles = styleMap(node.attribs.style ?? "");
      const cell = node.name === "td" || node.name === "th";
      const highlight = node.name === "mark" ? node.attribs["data-color"] || styles.get("background-color") : cell ? undefined : styles.get("background-color");
      const text = styles.get("color");
      const canonicalText = text || inheritedText;
      const cellBackground = cell ? styles.get("background-color") : undefined;
      const cellPair = cellBackground ? surfaceThemePair(cellBackground) : null;
      if (cellPair) childSurfaces = cellPair;
      if (cell && (cellPair || ["top", "right", "bottom", "left"].some(side => styles.has(`border-${side}`)))) {
        const cellVariables: Record<string, string> = cellPair ? {
          "--pebble-cell-light": cellPair.light,
          "--pebble-cell-dark": cellPair.dark,
          "--pebble-cell-text-light": textThemePair("#202124", undefined, cellPair)!.light,
          "--pebble-cell-text-dark": textThemePair("#202124", undefined, cellPair)!.dark,
        } : {};
        for (const side of ["top", "right", "bottom", "left"]) {
          const pair = borderThemePair(styles.get(`border-${side}`), cellPair ?? pageSurfaces);
          if (pair) {
            cellVariables[`--pebble-cell-border-${side}-light`] = pair.light;
            cellVariables[`--pebble-cell-border-${side}-dark`] = pair.dark;
          }
        }
        const classes = ["pebble-theme-cell", ...(cellPair ? ["pebble-theme-cell-surface"] : []), ...borderClasses(cellVariables)];
        node.attribs.class = [...new Set([...(node.attribs.class ?? "").split(/\s+/).filter(Boolean), ...classes])].join(" ");
        node.attribs.style = `${node.attribs.style ?? ""}${node.attribs.style?.trim() ? "; " : ""}${cssVariables(cellVariables)}`;
      }
      if (text || highlight) {
        const variables = themeColorVariables(canonicalText, highlight, cellPair ?? surfaces);
        if (variables) {
          node.attribs.class = [...new Set([...(node.attribs.class ?? "").split(/\s+/).filter(Boolean), "pebble-theme-text", ...(highlight ? ["pebble-theme-highlight"] : [])])].join(" ");
          node.attribs.style = `${node.attribs.style ?? ""}${node.attribs.style?.trim() ? "; " : ""}${cssVariables(variables)}`;
        }
      }
    }
    if (!skip) {
      const styles = styleMap(node.attribs.style ?? "");
      const highlight = node.name === "mark" ? node.attribs["data-color"] || styles.get("background-color") : ["td", "th"].includes(node.name) ? undefined : styles.get("background-color");
      const highlighted = highlight ? surfaceThemePair(highlight, childSurfaces) : null;
      walk(node.children, skip, highlighted ?? childSurfaces, styles.get("color") || inheritedText);
    } else walk(node.children, skip, childSurfaces, inheritedText);
  }
}

/** Call only after the content has passed the existing HTML sanitizer. */
export function addThemeColorsToSanitizedHtml(html: string): string {
  const document = parseDocument(html);
  walk(document.children);
  return render(document.children);
}
