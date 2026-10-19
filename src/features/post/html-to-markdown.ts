import { parseDocument } from "htmlparser2";
import type { ChildNode, Element, Text } from "domhandler";
import type { EditorBlock } from "./post-editor-model.ts";
import { escapeRichText, richContentHtml } from "./rich-content.ts";

function isElement(node: ChildNode): node is Element {
  return node.type === "tag" || node.type === "script" || node.type === "style";
}

function isText(node: ChildNode): node is Text {
  return node.type === "text";
}

function escapeMarkdownText(text: string): string {
  return text
    .replace(/&nbsp;|\u00a0/gi, " ")
    // Escape CommonMark/GFM punctuation in literal text so it cannot become
    // formatting, a heading, a list item, or a link after conversion.
    .replace(/([\\`*_{}[\]()#+.!>~-])/g, "\\$1");
}

function escapeMarkdownDestination(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/</g, "%3C").replace(/>/g, "%3E").replace(/\s/g, "%20");
}

function escapeHtmlText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeHtmlAttribute(value: string): string {
  return escapeHtmlText(value).replace(/"/g, "&quot;");
}

function serializeRawHtml(node: ChildNode): string {
  if (isText(node)) return escapeHtmlText(node.data);
  if (!isElement(node)) return "";
  const attrs = Object.entries(node.attribs)
    .map(([name, value]) => ` ${name}="${escapeHtmlAttribute(value)}"`)
    .join("");
  const tag = node.name.toLowerCase();
  if (["br", "hr", "img", "input"].includes(tag)) return `<${tag}${attrs}>`;
  return `<${tag}${attrs}>${node.children.map(serializeRawHtml).join("")}</${tag}>`;
}

function textContent(nodes: ChildNode[]): string {
  return nodes.map(node => isText(node) ? node.data : isElement(node) ? textContent(node.children) : "").join("");
}

function inlineCodeSpan(content: string): string {
  const runs = content.match(/`+/g) ?? [];
  const delimiter = "`".repeat(Math.max(1, ...runs.map(run => run.length + 1)));
  const needsPadding = content.startsWith("`") || content.endsWith("`") || (content.startsWith(" ") && content.endsWith(" ") && /[^ ]/.test(content));
  const padding = needsPadding ? " " : "";
  return `${delimiter}${padding}${content}${padding}${delimiter}`;
}

function codeFence(content: string): string {
  const runs = content.match(/`+/g) ?? [];
  return "`".repeat(Math.max(3, ...runs.map(run => run.length + 1)));
}

type ListContext = {
  type: "ul" | "ol";
  index: number;
  depth: number;
};

export function htmlToMarkdown(html: string): string {
  if (!html || !html.trim()) return "";

  // Strip Pebble legacy comments if any
  const cleanedHtml = html.replace(/<!--\s*Pebble HTML content\s*-->/gi, "").trim();
  if (!cleanedHtml) return "";

  const document = parseDocument(cleanedHtml, { lowerCaseTags: true });
  const lines: string[] = [];

  function getAlignment(node: Element): "left" | "center" | "right" | null {
    const alignAttr = node.attribs["data-align"] || node.attribs["align"];
    if (alignAttr === "left" || alignAttr === "center" || alignAttr === "right") {
      return alignAttr;
    }
    const style = node.attribs["style"] || "";
    const match = style.match(/text-align:\s*(left|center|right)/i);
    return match ? (match[1].toLowerCase() as "left" | "center" | "right") : null;
  }

  function serializeChildren(children: ChildNode[], listCtx?: ListContext): string {
    return children.map(child => serializeNode(child, listCtx)).join("");
  }

  function serializeNode(node: ChildNode, listCtx?: ListContext): string {
    if (isText(node)) {
      return escapeMarkdownText(node.data);
    }
    if (!isElement(node)) {
      return "";
    }

    const tag = node.name.toLowerCase();

    // Custom Pebble Blocks - preserve as raw HTML div
    if (tag === "div" && node.attribs["data-pebble-type"]) {
      const type = node.attribs["data-pebble-type"];
      const spec = node.attribs["data-pebble-spec"] || "{}";
      const title = node.attribs["data-pebble-title"];
      const align = node.attribs["data-align"];
      const titleAttr = title ? ` data-pebble-title="${escapeHtmlAttribute(title)}"` : "";
      const alignAttr = ["left", "center", "right"].includes(align || "") ? ` data-align="${align}"` : "";
      return `\n\n<div data-pebble-type="${escapeHtmlAttribute(type)}" data-pebble-spec="${escapeHtmlAttribute(spec)}"${titleAttr}${alignAttr}></div>\n\n`;
    }

    // Embeds (like iframes for Naver / OpenStreetMap)
    if (tag === "iframe") {
      const src = node.attribs["src"] || "";
      const width = node.attribs["width"] || "600";
      const height = node.attribs["height"] || "450";
      const title = node.attribs["title"] || "지도";
      return `\n\n<iframe src="${escapeHtmlAttribute(src)}" width="${escapeHtmlAttribute(width)}" height="${escapeHtmlAttribute(height)}" title="${escapeHtmlAttribute(title)}"></iframe>\n\n`;
    }

    // Headings
    if (/^h[1-6]$/.test(tag)) {
      const level = Number(tag.slice(1));
      const content = serializeChildren(node.children).trim();
      if (!content) return "";
      return `\n\n${"#".repeat(level)} ${content}\n\n`;
    }

    // Paragraphs
    if (tag === "p") {
      const content = serializeChildren(node.children).trim();
      if (!content) return "\n\n";
      return `\n\n${content}\n\n`;
    }

    // Line breaks
    if (tag === "br") {
      return "\n";
    }

    // Horizontal rule
    if (tag === "hr") {
      return "\n\n---\n\n";
    }

    // Bold
    if (tag === "strong" || tag === "b") {
      const content = serializeChildren(node.children);
      if (!content.trim()) return content;
      // Handle leading/trailing spaces cleanly
      const leadingSpace = content.match(/^\s*/)?.[0] ?? "";
      const trailingSpace = content.match(/\s*$/)?.[0] ?? "";
      const trimmed = content.trim();
      return `${leadingSpace}**${trimmed}**${trailingSpace}`;
    }

    // Italic
    if (tag === "em" || tag === "i") {
      const content = serializeChildren(node.children);
      if (!content.trim()) return content;
      const leadingSpace = content.match(/^\s*/)?.[0] ?? "";
      const trailingSpace = content.match(/\s*$/)?.[0] ?? "";
      const trimmed = content.trim();
      return `${leadingSpace}*${trimmed}*${trailingSpace}`;
    }

    // Strikethrough
    if (tag === "s" || tag === "del" || tag === "strike") {
      const content = serializeChildren(node.children);
      if (!content.trim()) return content;
      const leadingSpace = content.match(/^\s*/)?.[0] ?? "";
      const trailingSpace = content.match(/\s*$/)?.[0] ?? "";
      const trimmed = content.trim();
      return `${leadingSpace}~~${trimmed}~~${trailingSpace}`;
    }

    // Underline
    if (tag === "u") {
      const content = serializeChildren(node.children);
      if (!content.trim()) return content;
      return `<u>${content}</u>`;
    }

    // Inline code or code block inside <pre>
    if (tag === "code") {
      return inlineCodeSpan(textContent(node.children));
    }

    // Pre / Code blocks
    if (tag === "pre") {
      let lang = node.attribs["data-language"] || "";
      const align = getAlignment(node);
      let codeText = "";
      for (const child of node.children) {
        if (isElement(child) && child.name.toLowerCase() === "code") {
          if (!lang) {
            const cls = child.attribs["class"] || "";
            const match = cls.match(/language-([a-z0-9_-]+)/i);
            if (match) lang = match[1];
          }
          codeText += textContent(child.children);
        } else if (isText(child)) {
          codeText += child.data;
        }
      }
      codeText = codeText.replace(/\r\n/g, "\n");
      if (codeText.endsWith("\n")) codeText = codeText.slice(0, -1);
      if (align) {
        return `\n\n<pre data-language="${escapeHtmlAttribute(lang)}" data-align="${align}"><code>${escapeHtmlText(codeText)}</code></pre>\n\n`;
      }
      const fence = codeFence(codeText);
      return `\n\n${fence}${lang}\n${codeText}\n${fence}\n\n`;
    }

    // Blockquote
    if (tag === "blockquote") {
      const inner = serializeChildren(node.children).trim();
      const quoted = inner
        .split("\n")
        .map(line => (line.trim() ? `> ${line}` : ">"))
        .join("\n");
      return `\n\n${quoted}\n\n`;
    }

    // Lists
    if (tag === "ul" || tag === "ol") {
      const depth = listCtx ? listCtx.depth + 1 : 0;
      let itemIndex = 0;
      const items: string[] = [];
      for (const child of node.children) {
        if (isElement(child) && child.name.toLowerCase() === "li") {
          itemIndex++;
          const childCtx: ListContext = { type: tag, index: itemIndex, depth };
          const prefix = tag === "ul" ? "- " : `${itemIndex}. `;
          const indent = "  ".repeat(depth);
          // Split li children into inline content and nested lists
          const inlineChildren: ChildNode[] = [];
          const nestedLists: Element[] = [];
          for (const liChild of child.children) {
            if (isElement(liChild) && (liChild.name.toLowerCase() === "ul" || liChild.name.toLowerCase() === "ol")) {
              nestedLists.push(liChild);
            } else {
              inlineChildren.push(liChild);
            }
          }
          let itemText = serializeChildren(inlineChildren, childCtx).trim();
          itemText = itemText.replace(/\n{2,}/g, "\n");
          let rendered = `${indent}${prefix}${itemText}`;
          for (const nested of nestedLists) {
            const nestedText = serializeNode(nested, childCtx).replace(/^\n+|\n+$/g, "");
            if (nestedText) {
              rendered += `\n${nestedText}`;
            }
          }
          items.push(rendered);
        }
      }
      return `\n\n${items.join("\n")}\n\n`;
    }

    // Tables
    if (tag === "table") {
      const rows: { cells: string[]; alignments: ("left" | "center" | "right" | null)[]; isHeader: boolean }[] = [];
      const traverseTable = (tableChildren: ChildNode[], inThead = false) => {
        for (const child of tableChildren) {
          if (!isElement(child)) continue;
          const childTag = child.name.toLowerCase();
          if (childTag === "thead") {
            traverseTable(child.children, true);
          } else if (childTag === "tbody" || childTag === "tfoot") {
            traverseTable(child.children, false);
          } else if (childTag === "tr") {
            const cells: string[] = [];
            const alignments: ("left" | "center" | "right" | null)[] = [];
            let rowHasTh = inThead;
            for (const cell of child.children) {
              if (!isElement(cell)) continue;
              const cellTag = cell.name.toLowerCase();
              if (cellTag === "th" || cellTag === "td") {
                if (cellTag === "th") rowHasTh = true;
                const cellText = serializeChildren(cell.children).replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
                cells.push(cellText);
                alignments.push(getAlignment(cell));
              }
            }
            if (cells.length) {
              rows.push({ cells, alignments, isHeader: rowHasTh });
            }
          }
        }
      };
      traverseTable(node.children);

      if (!rows.length) return "";

      const colCount = Math.max(...rows.map(r => r.cells.length));
      if (colCount === 0) return "";

      // Ensure first row is header
      const headerRow = rows[0];
      const dataRows = rows.slice(1);

      const formatRow = (cells: string[]) => {
        const padded = [...cells];
        while (padded.length < colCount) padded.push("");
        return `| ${padded.join(" | ")} |`;
      };

      const formatDivider = (alignments: ("left" | "center" | "right" | null)[]) => {
        const cols: string[] = [];
        for (let i = 0; i < colCount; i++) {
          const a = alignments[i];
          if (a === "center") cols.push(":---:");
          else if (a === "right") cols.push("---:");
          else cols.push("---");
        }
        return `| ${cols.join(" | ")} |`;
      };

      const tableLines: string[] = [
        formatRow(headerRow.cells),
        formatDivider(headerRow.alignments),
        ...dataRows.map(r => formatRow(r.cells)),
      ];

      return `\n\n${tableLines.join("\n")}\n\n`;
    }

    // Links
    if (tag === "a") {
      const href = node.attribs["href"] || "";
      const text = serializeChildren(node.children).trim();
      if (!href) return text;
      return `[${text || escapeMarkdownText(href)}](<${escapeMarkdownDestination(href)}>)`;
    }

    // Images
    if (tag === "img") {
      const src = node.attribs["data-media-src"] || node.attribs["src"] || "";
      const alt = node.attribs["alt"] || "";
      if (!src) return "";
      return `![${escapeMarkdownText(alt)}](<${escapeMarkdownDestination(src)}>)`;
    }

    // Keep the editor's validated TOC atom as its existing HTML marker. The
    // Markdown renderer sanitizes this block and Tiptap recognizes nav.post-toc.
    if (tag === "nav" && (node.attribs["class"] || "").split(/\s+/).includes("post-toc")) {
      const items: string[] = [];
      const list = node.children.find(child => isElement(child) && child.name.toLowerCase() === "ol");
      if (list && isElement(list)) {
        for (const child of list.children) {
          if (!isElement(child) || child.name.toLowerCase() !== "li") continue;
          const anchor = child.children.find(item => isElement(item) && item.name.toLowerCase() === "a");
          if (!anchor || !isElement(anchor)) continue;
          const href = anchor.attribs["href"] || "";
          const id = href.startsWith("#") ? href.slice(1) : "";
          if (!/^[\w-]+$/.test(id)) continue;
          const level = Math.max(1, Math.min(6, Number(child.attribs["data-level"]) || 1));
          const label = anchor.children.map(serializeRawHtml).join("");
          items.push(`<li data-level="${level}"><a href="#${escapeHtmlAttribute(id)}">${label}</a></li>`);
        }
      }
      return `\n\n<nav class="post-toc" aria-label="목차"><h2>목차</h2><ol>${items.join("")}</ol></nav>\n\n`;
    }

    // Details / Collapsible
    if (tag === "details") {
      let summary: ChildNode[] = [];
      const otherChildren: ChildNode[] = [];
      for (const child of node.children) {
        if (isElement(child) && child.name.toLowerCase() === "summary") {
          summary = child.children;
        } else {
          otherChildren.push(child);
        }
      }
      const isOpen = node.attribs["open"] !== undefined;
      const summaryHtml = summary.length ? summary.map(serializeRawHtml).join("") : "접는 글";
      const body = otherChildren.map(serializeRawHtml).join("");
      return `\n\n<details${isOpen ? " open" : ""}>\n<summary>${summaryHtml}</summary>${body}</details>\n\n`;
    }

    // Default inline tags (span, mark, etc.)
    return serializeChildren(node.children, listCtx);
  }

  const rawMarkdown = serializeChildren(document.children);

  // Clean up excess newlines (max 2 consecutive newlines)
  return rawMarkdown
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function blocksToHtml(blocks: EditorBlock[], fallbackHtml?: string): string {
  if (!blocks.length) return fallbackHtml ?? "";
  if (blocks.length === 1) {
    const first = blocks[0];
    if (first.type === "MARKDOWN") return richContentHtml(first.content, "MARKDOWN");
    if (first.type === "HTML") return first.content;
    if (first.type === "TEXT") return escapeRichText(first.content);
  }
  return blocks.map(block => {
    if (block.type === "CODE") {
      const lang = block.language || "TYPESCRIPT";
      const align = block.alignment === "CENTER" ? ' data-align="center"' : block.alignment === "RIGHT" ? ' data-align="right"' : "";
      return `<pre data-language="${lang}"${align}><code>${escapeHtml(block.content)}</code></pre>`;
    }
    if (block.type === "TABLE" || block.type === "ARCHITECTURE" || block.type === "DB_SCHEMA") {
      const align = block.alignment === "CENTER" ? ' data-align="center"' : block.alignment === "RIGHT" ? ' data-align="right"' : "";
      const title = block.title ? ` data-pebble-title="${escapeHtml(block.title)}"` : "";
      return `<div data-pebble-type="${block.type}" data-pebble-spec="${escapeAttr(block.content)}"${title}${align}></div>`;
    }
    if (block.type === "MARKDOWN") {
      return richContentHtml(block.content, "MARKDOWN");
    }
    if (block.type === "TEXT") {
      return escapeRichText(block.content);
    }
    return block.content;
  }).join("\n\n");
}

export function blocksToMarkdown(blocks: EditorBlock[], fallbackHtml?: string): string {
  if (!blocks.length) return fallbackHtml ? htmlToMarkdown(fallbackHtml) : "";
  if (blocks.length === 1 && blocks[0].type === "MARKDOWN") {
    return blocks[0].content;
  }
  const html = blocksToHtml(blocks, fallbackHtml);
  return htmlToMarkdown(html);
}
