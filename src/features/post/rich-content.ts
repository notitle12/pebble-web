import { parseArchitectureSpec, parseTableSpec } from "./api/post-list.ts";
import { marked } from "marked";
import sanitizeHtml, { type IOptions } from "sanitize-html";

export type RichBodyFormat = "HTML" | "MARKDOWN" | "TEXT";

const allowedStyles: NonNullable<IOptions["allowedStyles"]> = {
  "*": {
    color: [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d.% ,]+\)$/i, /^[a-z]{3,20}$/i],
    "background-color": [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d.% ,]+\)$/i, /^[a-z]{3,20}$/i],
    "font-family": [/^[\w ,"'-]{1,80}$/],
    "font-size": [/^(?:[1-9]|[1-6][0-9])(?:px|pt|em|rem|%)$/],
    "text-align": [/^(?:left|right|center|justify)$/],
    width: [/^(?:[1-9]\d?|100)%$/],
  },
};

const sanitizerOptions: IOptions = {
  allowedTags: [
    "a", "abbr", "b", "blockquote", "br", "caption", "code", "del", "details", "div", "em", "figcaption", "figure", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "i", "img", "iframe", "li", "mark", "nav", "ol", "p", "pre", "s", "small", "span", "strong", "sub", "summary", "sup", "table", "tbody", "td", "th", "thead", "tr", "u", "ul",
  ],
  allowedAttributes: {
    a: ["href", "name", "target", "rel", "title"],
    img: ["src", "alt", "title", "width", "height", "data-media-src"],
    iframe: ["src", "width", "height", "title", "loading", "sandbox", "allowfullscreen", "referrerpolicy"],
    mark: ["data-color"],
    div: ["data-details-content", "data-pebble-type", "data-pebble-spec", "data-pebble-title"],
    pre: ["data-language"],
    "*": ["id", "class", "style", "colspan", "rowspan", "open", "aria-label", "data-level"],
  },
  allowedStyles,
  allowedClasses: { nav:["post-toc"], "*":[] },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { img: ["http", "https"] },
  allowedIframeHostnames: ["www.openstreetmap.org"],
  allowProtocolRelative: false,
  transformTags: {
    div: (_tagName, attrs) => {
      const type = attrs["data-pebble-type"];
      if (!type) return { tagName: "div", attribs: attrs };
      try {
        const value = JSON.parse(attrs["data-pebble-spec"] || "");
        const spec = type === "TABLE" ? parseTableSpec(value) : type === "ARCHITECTURE" ? parseArchitectureSpec(value) : null;
        if (!spec) throw new Error();
        return { tagName: "div", attribs: { "data-pebble-type": type, "data-pebble-spec": JSON.stringify(spec), ...(attrs["data-pebble-title"] ? { "data-pebble-title": attrs["data-pebble-title"].slice(0, 100) } : {}) } };
      } catch { return { tagName: "div", attribs: {} as sanitizeHtml.Attributes }; }
    },
    a: (_tagName,attrs)=>({tagName:"a",attribs:{...attrs,rel:"nofollow noopener noreferrer",...(attrs.href?.startsWith("#")?{target:"_self"}:{})}}),
    iframe: (_tagName, attrs) => {
      if (!isSafeOpenStreetMapEmbed(attrs.src || "")) return { tagName: "span", attribs: {} as sanitizeHtml.Attributes };
      return { tagName: "iframe", attribs: { src: attrs.src, width: "600", height: "450", title: "지도: OpenStreetMap", loading: "lazy", sandbox: "allow-scripts allow-same-origin", referrerpolicy: "no-referrer" } };
    },
  },
};

export function isSafeOpenStreetMapEmbed(src: string): boolean {
  try {
    const url = new URL(src);
    if (url.origin !== "https://www.openstreetmap.org" || url.pathname !== "/export/embed.html" || url.username || url.password) return false;
    const marker = url.searchParams.get("marker")?.split(",").map(Number);
    const bbox = url.searchParams.get("bbox")?.split(",").map(Number);
    return url.searchParams.get("layer") === "mapnik"
      && marker?.length === 2 && bbox?.length === 4
      && marker.every(Number.isFinite) && bbox.every(Number.isFinite)
      && marker[0] >= -90 && marker[0] <= 90 && marker[1] >= -180 && marker[1] <= 180
      && bbox[0] >= -180 && bbox[2] <= 180 && bbox[0] < bbox[2]
      && bbox[1] >= -90 && bbox[3] <= 90 && bbox[1] < bbox[3]
      && marker[0] >= bbox[1] && marker[0] <= bbox[3] && marker[1] >= bbox[0] && marker[1] <= bbox[2];
  } catch { return false; }
}

export function buildOpenStreetMapEmbed(latitude: number, longitude: number): string | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  const south = Math.max(-90, latitude - 0.01), north = Math.min(90, latitude + 0.01);
  const west = Math.max(-180, longitude - 0.01), east = Math.min(180, longitude + 0.01);
  const query = new URLSearchParams({ bbox: `${west},${south},${east},${north}`, layer: "mapnik", marker: `${latitude},${longitude}` });
  return `https://www.openstreetmap.org/export/embed.html?${query.toString()}`;
}

export function escapeRichText(text: string): string {
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  return escaped.split(/\n{2,}/).map(part => `<p>${part.replace(/\n/g, "<br>") || "<br>"}</p>`).join("");
}

function stableImages(html: string): string {
  return sanitizeHtml(html, {
    ...sanitizerOptions,
    transformTags: {
      ...sanitizerOptions.transformTags,
      img: (_tagName, attrs) => {
        const stableSrc = attrs["data-media-src"] || attrs.src || "";
        const { ["data-media-src"]: _mediaSrc, ...rest } = attrs;
        return { tagName: "img", attribs: { ...rest, src: stableSrc } };
      },
    },
  });
}

/** Safe HTML for preview/public rendering. Markdown output is always sanitized after parsing. */
export function richContentHtml(content: string, format: RichBodyFormat): string {
  if (format === "TEXT") return stableImages(escapeRichText(content));
  if (format === "MARKDOWN") return stableImages(marked.parse(content, { async: false, gfm: true, breaks: false }));
  return stableImages(content);
}

/** HTML to place in Tiptap: starts from sanitized content and substitutes short-lived owner previews. */
export function richEditorHtml(content: string, format: RichBodyFormat, imagePreviews: Record<string, string> = {}): string {
  const safe = richContentHtml(content, format);
  return sanitizeHtml(safe, {
    ...sanitizerOptions,
    transformTags: {
      ...sanitizerOptions.transformTags,
      img: (_tagName, attrs) => {
        const stableSrc = attrs.src || "";
        const preview = imagePreviews[stableSrc];
        return { tagName: "img", attribs: { ...attrs, ...(preview ? { src: preview } : {}), "data-media-src": stableSrc } };
      },
    },
  });
}

/** Tiptap can include a preview URL in img[src]; persist the stable API reference instead. */
export function persistedRichHtml(html: string): string {
  return stableImages(html);
}

export type TocHeading = { id: string; text: string; level: number };

export function buildTableOfContents(headings: TocHeading[]): string {
  if (headings.length === 0) return "";
  const items = headings.map(({ id, text, level }) => `<li data-level="${Math.max(1, Math.min(6, level))}"><a href="#${escapeAttr(id)}">${escapeRichText(text).replace(/^<p>|<\/p>$/g, "")}</a></li>`).join("");
  return `<nav class="post-toc" aria-label="목차"><h2>목차</h2><ol>${items}</ol></nav>`;
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function plainTextFromHtml(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, " ").trim();
}
