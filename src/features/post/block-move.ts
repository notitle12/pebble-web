import type { Node } from "@tiptap/pm/model";
import type { Transaction } from "@tiptap/pm/state";

/** Move one whole top-level block to a gap, preserving node attributes/content. */
export function moveBodyBlock(tr: Transaction, source: number, gap: number): Transaction | null {
  const boundaries = new Set<number>([tr.doc.content.size]);
  tr.doc.forEach((_node, pos) => boundaries.add(pos));
  if (!boundaries.has(source) || !boundaries.has(gap)) return null;
  const node: Node | null = tr.doc.nodeAt(source);
  // 맨 뒤의 빈 입력 문단을 건너뛰지 않아 이동할 때마다 새 문단이 늘지 않게 한다.
  const trailing=tr.doc.lastChild;
  if(node && node.type.name!=="paragraph" && gap===tr.doc.content.size && trailing?.type.name==="paragraph" && trailing.content.size===0)gap-=trailing.nodeSize;
  if (!node || gap === source || gap === source + node.nodeSize) return null;
  const size = node.nodeSize;
  tr.delete(source, source + size);
  tr.insert(gap > source ? gap - size : gap, node);
  return tr;
}
