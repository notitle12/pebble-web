import type { EditorBlock } from "./post-editor-model.ts";
import sanitizeHtml from "sanitize-html";
import { richContentHtml } from "./rich-content.ts";

const EXCERPT_LIMIT = 200;

const nonProseTags = new Set(["script", "style", "noscript", "template", "svg", "math", "pre", "code"]);


function decodeEntities(value: string): string {
  return value.replace(/&(#(?:x[\da-f]+|\d+)|amp|lt|gt|quot|apos|nbsp);/gi, (match, entity: string) => {
    const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
    if (entity[0] !== "#") return named[entity.toLowerCase()] ?? match;
    const hex = entity[1]?.toLowerCase() === "x";
    const cp = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
    return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : "";
  });
}

function htmlText(source: string): string {
  // Exclude subtrees before collecting text; a textFilter on the first pass would
  // see text even in a frame that exclusiveFilter later removes.
  const proseHtml = sanitizeHtml(source, {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, "nav", "div", "br"],
    allowedAttributes: { nav: ["class"], div: ["data-pebble-type"] },
    nonTextTags: [...nonProseTags],
    exclusiveFilter: frame => nonProseTags.has(frame.tag)
      || frame.tag === "nav" && frame.attribs.class?.split(/\s+/).includes("post-toc") === true
      || frame.tag === "div" && ["TABLE", "ARCHITECTURE"].includes(frame.attribs["data-pebble-type"] ?? ""),
  });
  const separated = proseHtml.replace(/<(?:\/)?(?:p|h[1-6]|li|div|br|td|th|blockquote)\b[^>]*>/gi, " ");
  return decodeEntities(sanitizeHtml(separated, { allowedTags: [], allowedAttributes: {} }));
}

/** Creates a compact plain-text summary from readable prose blocks only. */
export function derivePostExcerpt(blocks: EditorBlock[], limit = EXCERPT_LIMIT): string | null {
  const prose = blocks.filter(block => block.type === "HTML" || block.type === "TEXT" || block.type === "MARKDOWN")
    .map(block => block.type === "HTML" ? htmlText(richContentHtml(block.content, "HTML")) : block.type === "MARKDOWN" ? htmlText(richContentHtml(block.content, "MARKDOWN")) : block.content)
    .join(" ")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\s+/gu, " ")
    .trim();
  if (!prose) return null;
  return Array.from(prose).slice(0, Math.max(0, limit)).join("").trimEnd() || null;
}
