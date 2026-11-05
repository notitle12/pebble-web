import {closeHistory} from '@tiptap/pm/history';
import {TextSelection,type EditorState,type Transaction} from '@tiptap/pm/state';
import {columnViewportKey} from './column-viewport.ts';

/** 빈 문단 Enter만 일반 블록 밖으로 나가고 내용이 있는 줄은 기본 문단 나눔을 쓴다. */
export function textPanelExitTransaction(state:EditorState):Transaction|null {
 const {selection}=state;
 if(!(selection instanceof TextSelection)||!selection.empty)return null;
 const {$from}=selection,depth=$from.depth-1;
 if(depth<1||$from.parent.type.name!=='paragraph'||$from.parent.content.size!==0||$from.node(depth).type.name!=='textPanel')return null;
 const panel=$from.node(depth),parent=$from.node(depth-1),paragraph=state.schema.nodes.paragraph;
 const index=$from.indexAfter(depth-1);
 if(!paragraph||!parent.canReplaceWith(index,index,paragraph))return null;
 const tr=closeHistory(state.tr);
 // 비어 있는 문단만 제거하고 본문과 유일한 편집용 문단은 보존한다.
 if(panel.childCount>1)tr.delete($from.before(),$from.after());
 const pos=tr.mapping.map($from.after(depth)),next=tr.doc.nodeAt(pos);
 if(next?.type===paragraph&&next.content.size===0)tr.setNodeMarkup(pos,undefined,{...next.attrs,fontSize:'16px',id:null});
 else tr.insert(pos,paragraph.create({fontSize:'16px',id:null}));
 return tr.setSelection(TextSelection.create(tr.doc,pos+1)).setStoredMarks(null).setMeta(columnViewportKey,false).scrollIntoView();
}
