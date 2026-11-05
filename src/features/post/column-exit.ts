import {closeHistory} from '@tiptap/pm/history';
import {TextSelection,type EditorState,type Transaction} from '@tiptap/pm/state';
import {columnViewportKey} from './column-viewport.ts';

/** 열의 마지막 일반 문단 끝에서 Enter를 누르면 배치 아래의 본문으로 이동한다. */
export function columnExitTransaction(state:EditorState):Transaction|null {
 const {selection}=state;
 if(!(selection instanceof TextSelection)||!selection.empty)return null;
 const {$from}=selection;
 if($from.parent.type.name!=='paragraph'||$from.parentOffset!==$from.parent.content.size)return null;
 let columnDepth=0;
 for(let depth=$from.depth-1;depth>0;depth--){
  const node=$from.node(depth);
  if($from.index(depth)!==node.childCount-1)return null;
  if(node.type.name==='imageTextColumn'){columnDepth=depth;break;}
  if(!['textPanel','details'].includes(node.type.name))return null;
 }
 if(!columnDepth||$from.node(columnDepth-1).type.name!=='imageTextLayout')return null;
 const layoutDepth=columnDepth-1,pos=$from.after(layoutDepth),parent=$from.node(layoutDepth-1);
 const next=state.doc.nodeAt(pos),paragraph=state.schema.nodes.paragraph;
 if(!paragraph)return null;
 const tr=closeHistory(state.tr);
 if(next?.type===paragraph&&next.content.size===0)tr.setNodeMarkup(pos,undefined,{...next.attrs,fontSize:'16px',id:null});
 else {
  const index=$from.indexAfter(layoutDepth-1);
  if(!parent.canReplaceWith(index,index,paragraph))return null;
  tr.insert(pos,paragraph.create({fontSize:'16px',id:null}));
 }
 return tr.setSelection(TextSelection.create(tr.doc,pos+1)).setStoredMarks(null).setMeta(columnViewportKey,false).scrollIntoView();
}
