import { clampDiagramWidth } from "./diagram-width.ts";

// Preserve display size in an ordinary Mermaid comment across CODE, HTML and Markdown.
const widthComment = /^%% pebble-display-width: (\d{2,3})\r?\n/;

export function readMermaidSource(content: string) {
  const match = content.match(widthComment);
  return match ? { source: content.slice(match[0].length), width: clampDiagramWidth(Number(match[1])) }
    : { source: content, width: 100 };
}

export function writeMermaidSource(source: string, width: number) {
  const size = clampDiagramWidth(width);
  return size === 100 ? source : `%% pebble-display-width: ${size}\n${source}`;
}
