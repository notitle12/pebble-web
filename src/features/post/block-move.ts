import type { Node } from "@tiptap/pm/model";
import type { Transaction } from "@tiptap/pm/state";

/** Move one whole top-level block to a gap, preserving node attributes/content. */
export function moveBodyBlock(tr: Transaction, source: number, gap: number): Transaction | null {
  const boundaries = new Set<number>([tr.doc.content.size]);
  tr.doc.forEach((_node, pos) => boundaries.add(pos));
  if (!boundaries.has(source) || !boundaries.has(gap)) return null;
  const node: Node | null = tr.doc.nodeAt(source);
  if (!node || gap === source || gap === source + node.nodeSize) return null;
  const size = node.nodeSize;
  tr.delete(source, source + size);
  tr.insert(gap > source ? gap - size : gap, node);
  return tr;
}
