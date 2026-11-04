import {Fragment} from '@tiptap/pm/model';
import {NodeSelection,Selection,type EditorState,type Transaction} from '@tiptap/pm/state';
import {closeHistory} from '@tiptap/pm/history';

/** Remove only the layout wrappers, preserving each column's blocks in reading order. */
export function unwrapColumnLayout(tr:Transaction,pos:number):Transaction|null {
 if(!Number.isSafeInteger(pos)||pos<0||pos>=tr.doc.content.size)return null;
 const node=tr.doc.nodeAt(pos);if(node?.type.name!=='imageTextLayout')return null;
 const blocks=[];
 for(let columnIndex=0;columnIndex<node.childCount;columnIndex++){
  const column=node.child(columnIndex);
  if(column.childCount===1&&column.firstChild?.type.name==='paragraph'&&column.firstChild.content.size===0)continue;
  for(let index=0;index<column.childCount;index++)blocks.push(column.child(index));
 }
 if(!blocks.length){const empty=tr.doc.type.schema.nodes.paragraph?.createAndFill();if(!empty)return null;blocks.push(empty);}
 const fragment=Fragment.fromArray(blocks),$pos=tr.doc.resolve(pos),index=$pos.index();
 if(!$pos.parent.canReplace(index,index+1,fragment))return null;
 closeHistory(tr).replaceWith(pos,pos+node.nodeSize,fragment);
 tr.setSelection(Selection.near(tr.doc.resolve(Math.min(pos+1,tr.doc.content.size))));
 return tr.scrollIntoView();
}

export function unwrapSelectedColumnLayout(state:EditorState,dispatch?:(tr:Transaction)=>void):boolean {
 const {selection}=state;
 if(!(selection instanceof NodeSelection)||selection.node.type.name!=='imageTextLayout')return false;
 const tr=unwrapColumnLayout(state.tr,selection.from);if(!tr)return false;
 dispatch?.(tr);return true;
}
