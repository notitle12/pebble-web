import {columnViewportKey} from "./column-viewport.ts";
import {closeHistory} from "@tiptap/pm/history";
import { Fragment, type Node } from "@tiptap/pm/model";
import type { Transaction } from "@tiptap/pm/state";

export const movableContainerNames = new Set(["doc", "textPanel", "details", "imageTextColumn"]);

export type MovableBlock = { pos: number; end: number; parentPos: number; parentType: string; node: Node };
export type BlockGap = { parentPos: number; parentType: string; before: number | null; after: number | null; pos: number };

/** Whole blocks under document, text panel, and details parents; never table/list internals. */
export function movableBlocks(doc: Node): MovableBlock[] {
  const result: MovableBlock[] = [];
  const visit = (parent: Node, parentPos: number) => {
    if (parent.type.name === "imageTextLayout") {
      parent.forEach((column, offset) => visit(column, parentPos + 1 + offset));
      return;
    }
    if (!movableContainerNames.has(parent.type.name)) return;
    parent.forEach((node, offset) => {
      const pos = parentPos + 1 + offset;
      result.push({ pos, end: pos + node.nodeSize, parentPos, parentType: parent.type.name, node });
      if (movableContainerNames.has(node.type.name) || node.type.name === "imageTextLayout") visit(node, pos);
    });
  };
  visit(doc, -1);
  return result;
}

/** Resolve the deepest allowed parent and its direct child under a document position. */
export function blockGapContext(doc: Node, position: number): BlockGap | null {
  const $pos = doc.resolve(Math.max(0, Math.min(position, doc.content.size)));
  let parentDepth = -1;
  for (let depth = $pos.depth; depth >= 0; depth--) {
    if (movableContainerNames.has($pos.node(depth).type.name)) { parentDepth = depth; break; }
  }
  if (parentDepth < 0) return null;
  const parent = $pos.node(parentDepth);
  const parentPos = parentDepth === 0 ? -1 : $pos.before(parentDepth);
  if (parent.childCount === 0) return { parentPos, parentType: parent.type.name, before: null, after: null, pos: parentPos + 1 };

  const contentOffset = $pos.pos - $pos.start(parentDepth);
  let childIndex = 0, scanned = 0;
  while (childIndex < parent.childCount - 1 && scanned + parent.child(childIndex).nodeSize <= contentOffset) {
    scanned += parent.child(childIndex).nodeSize;
    childIndex++;
  }
  const child = parent.child(childIndex);
  const childPos = $pos.start(parentDepth) + scanned;
  return {
    parentPos,
    parentType: parent.type.name,
    before: childPos,
    after: childPos + child.nodeSize,
    pos: childPos,
  };
}

/** Move a block between allowed parents, keeping required block+ donors valid. */
export function moveBodyBlock(tr: Transaction, source: number, gap: number): Transaction | null {
  const doc = tr.doc;
  if (!Number.isSafeInteger(source) || !Number.isSafeInteger(gap) || source < 0 || gap < 0 || gap > doc.content.size) return null;
  const originalTarget = doc.resolve(gap);
  if (!movableContainerNames.has(originalTarget.parent.type.name)) return null;
  const sourceBlock = movableBlocks(doc).find(item => item.pos === source);
  const context = blockGapContext(doc, gap);
  if (!sourceBlock || !context) return null;
  const sourceEnd = sourceBlock.end;
  const targetParentStart = context.parentPos;
  let effectiveGap = gap;
  const trailing = doc.lastChild;
  if (context.parentType === "doc" && gap === doc.content.size && trailing?.type.name === "paragraph" && trailing.content.size === 0 && sourceBlock.node.type.name !== "paragraph") effectiveGap -= trailing.nodeSize;
  if (effectiveGap > source && effectiveGap < sourceEnd) return null;
  if (sourceBlock.parentPos === targetParentStart && (effectiveGap === source || effectiveGap === sourceEnd)) return null;

  // A container cannot be inserted into itself or one of its descendants.
  if (sourceBlock.node.type.name === "textPanel" || sourceBlock.node.type.name === "details") {
    if (targetParentStart === source || targetParentStart > source && targetParentStart < sourceEnd) return null;
  }
  if (sourceBlock.parentPos !== targetParentStart && sourceBlock.parentPos !== -1) {
    // Prevent invalid self nesting for any allowed node parent.
    let ancestor = targetParentStart;
    while (ancestor >= 0) {
      if (ancestor === source) return null;
      const item = movableBlocks(doc).find(candidate => candidate.pos === ancestor);
      ancestor = item?.parentPos ?? -1;
    }
  }

  const sourceParent = sourceBlock.parentPos === -1 ? doc : doc.nodeAt(sourceBlock.parentPos);
  if (!sourceParent) return null;
  const needsPlaceholder = sourceParent.type.name !== "doc" && sourceParent.childCount === 1;
  const nodeToMove = sourceBlock.node;
  if (needsPlaceholder) {
    const placeholder = nodeToMove.type.schema.nodes.paragraph?.createAndFill();
    if (!placeholder || !sourceParent.canReplace(0, 1, Fragment.from(placeholder))) return null;
    tr.replaceWith(source, sourceEnd, placeholder);
  } else tr.delete(source, sourceEnd);

  const mappedGap = tr.mapping.map(effectiveGap, effectiveGap > source ? 1 : -1);
  const finalGap = Math.max(0, Math.min(mappedGap, tr.doc.content.size));
  const target = tr.doc.resolve(finalGap);
  let targetDepth = -1;
  for (let depth = target.depth; depth >= 0; depth--) {
    if (movableContainerNames.has(target.node(depth).type.name)) { targetDepth = depth; break; }
  }
  if (targetDepth < 0 || targetDepth > 0 && !movableContainerNames.has(target.node(targetDepth).type.name)) return null;
  if (target.depth !== targetDepth) return null;
  const allowedParent = target.node(targetDepth);
  if (allowedParent.type.name !== context.parentType) return null;
  const actualParentPos = targetDepth === 0 ? -1 : target.before(targetDepth);
  const mappedParentPos = context.parentPos < 0 ? -1 : tr.mapping.map(context.parentPos, 1);
  if (actualParentPos !== mappedParentPos) return null;
  const childIndex = target.index(targetDepth);
  if (!allowedParent.canReplace(childIndex, childIndex, Fragment.from(nodeToMove))) return null;
  try {
    tr.insert(finalGap, nodeToMove);
  } catch {
    return null;
  }
  return tr.docChanged ? tr : null;
}

export function canPlaceBodyBlockBeside(source:MovableBlock,target:MovableBlock):boolean {
  return source.pos!==target.pos && source.node.type.name!=="imageTextLayout" && target.node.type.name!=="imageTextLayout"
    && target.parentType!=="imageTextColumn"
    && !(source.pos<target.end&&target.pos<source.end);
}

/** Wrap two independent blocks in a 50:50 layout as a single undoable move. */
export function placeBodyBlockBeside(tr:Transaction,source:number,target:number,side:"left"|"right"):Transaction|null {
  const items=movableBlocks(tr.doc),from=items.find(item=>item.pos===source),to=items.find(item=>item.pos===target);
  if(!from||!to||!canPlaceBodyBlockBeside(from,to))return null;
  const schema=tr.doc.type.schema,column=schema.nodes.imageTextColumn,layout=schema.nodes.imageTextLayout;
  if(!column||!layout)return null;
  const parent=from.parentPos<0?tr.doc:tr.doc.nodeAt(from.parentPos);
  if(!parent)return null;
  const needsPlaceholder=parent.type.name!=="doc"&&parent.childCount===1;
  closeHistory(tr).setMeta(columnViewportKey,true);
  try {
    if(needsPlaceholder){
      const placeholder=schema.nodes.paragraph?.createAndFill();
      if(!placeholder||!parent.canReplace(0,1,Fragment.from(placeholder)))return null;
      tr.replaceWith(from.pos,from.end,placeholder);
    }else tr.delete(from.pos,from.end);
    const mappedTarget=tr.mapping.map(to.pos,1),targetNode=tr.doc.nodeAt(mappedTarget);
    if(!targetNode?.eq(to.node))return null;
    const children=side==="left"?[from.node,targetNode]:[targetNode,from.node];
    const columns=children.map(node=>column.create(null,node));
    const row=layout.create({ratio:"1:1"},columns);
    const $target=tr.doc.resolve(mappedTarget),index=$target.index();
    if(!$target.parent.canReplace(index,index+1,Fragment.from(row)))return null;
    tr.replaceWith(mappedTarget,mappedTarget+targetNode.nodeSize,row);
    tr.doc.check();return tr;
  }catch{return null;}
}

/** Require an intentional move into the side of a block, away from its top/bottom gaps. */
export function sideOfBlockDrop(x:number,y:number,rect:{left:number;right:number;top:number;bottom:number}):"left"|"right"|null {
  const width=rect.right-rect.left,height=rect.bottom-rect.top,inset=Math.min(8,height/4),edge=Math.min(40,width*.2);
  if(width<80||y<rect.top+inset||y>rect.bottom-inset||x<rect.left-8||x>rect.right+8)return null;
  return x<=rect.left+edge?"left":x>=rect.right-edge?"right":null;
}
