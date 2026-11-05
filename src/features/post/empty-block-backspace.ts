import {Extension} from '@tiptap/core';
import {Fragment,type Node} from '@tiptap/pm/model';
import {closeHistory} from '@tiptap/pm/history';
import {NodeSelection,Selection,TextSelection,type EditorState,type Transaction} from '@tiptap/pm/state';
import {CellSelection} from '@tiptap/pm/tables';

const containerNames=new Set(['textPanel','table','details']);

/** 공백 문자·이미지·코드 등은 내용으로 보존하고 빈 문단만 허용한다. */
function emptyText(node:Node):boolean {
 if(!['paragraph','heading'].includes(node.type.name))return false;
 let empty=true;
 node.forEach(child=>{if(child.type.name!=='hardBreak')empty=false;});
 return empty;
}

export function isEmptyBodyContainer(node:Node):boolean {
 if(node.type.name==='table'){
  let empty=true;
  node.forEach(row=>row.forEach(cell=>cell.forEach(child=>{if(!emptyText(child))empty=false;})));
  return empty;
 }
 if(node.type.name!=='textPanel')return false;
 let empty=true;node.forEach(child=>{if(!emptyText(child))empty=false;});
 return empty;
}

function containerAtSelection(state:EditorState,types:readonly string[]):number|null {
 const {selection}=state;
 if(selection instanceof NodeSelection)return types.includes(selection.node.type.name)?selection.from:null;
 if(!(selection instanceof TextSelection&&selection.empty)&&!(selection instanceof CellSelection))return null;
 const $pos=selection instanceof CellSelection?selection.$anchorCell:selection.$from;
 for(let depth=$pos.depth;depth>0;depth--){
  const name=$pos.node(depth).type.name;
  if(containerNames.has(name))return types.includes(name)?$pos.before(depth):null;
 }
 return null;
}

/** 정확한 빈 컨테이너 하나만 제거하고 block+ 부모에는 빈 문단을 남긴다. */
export function deleteEmptyBodyContainer(state:EditorState,pos:number):Transaction|null {
 if(!Number.isSafeInteger(pos)||pos<0||pos>=state.doc.content.size)return null;
 const node=state.doc.nodeAt(pos);if(!node||!isEmptyBodyContainer(node))return null;
 const $pos=state.doc.resolve(pos),index=$pos.index(),parent=$pos.parent;
 const tr=closeHistory(state.tr);
 if(parent.canReplace(index,index+1,Fragment.empty))tr.delete(pos,pos+node.nodeSize);
 else {
  const paragraph=state.schema.nodes.paragraph?.createAndFill();
  if(!paragraph||!parent.canReplace(index,index+1,Fragment.from(paragraph)))return null;
  tr.replaceWith(pos,pos+node.nodeSize,paragraph);
 }
 const $next=tr.doc.resolve(Math.min(pos,tr.doc.content.size));
 tr.setSelection(Selection.findFrom($next,1,true)??Selection.findFrom($next,-1,true)??Selection.near($next));
 return tr.setStoredMarks(null);
}

function atContainerStart(state:EditorState,pos:number):boolean {
 const {selection}=state;
 if(!(selection instanceof TextSelection)||!selection.empty||selection.$from.parentOffset!==0||!['paragraph','heading'].includes(selection.$from.parent.type.name))return false;
 for(let depth=selection.$from.depth;depth>0;depth--){
  if(selection.$from.before(depth)===pos)return true;
  if(selection.$from.index(depth-1)!==0)return false;
 }
 return false;
}

export const EmptyBlockBackspace=Extension.create<{types:string[]}>({
 name:'emptyBlockBackspace',priority:1300,
 addOptions:()=>({types:['textPanel','table']}),
 addKeyboardShortcuts(){return {Backspace:()=>{
  if(!this.editor.isEditable||this.editor.view.composing)return false;
  const pos=containerAtSelection(this.editor.state,this.options.types);if(pos===null)return false;
  const tr=deleteEmptyBodyContainer(this.editor.state,pos);
  if(tr){this.editor.view.dispatch(tr);return true;}
  // 기본 joinBackward가 내용이 남은 일반 블록의 경계까지 풀지 않도록 한다.
  return this.editor.state.doc.nodeAt(pos)?.type.name!=='table'&&atContainerStart(this.editor.state,pos);
 }};},
});
