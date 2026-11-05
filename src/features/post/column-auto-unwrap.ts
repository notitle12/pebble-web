import {Plugin,PluginKey} from '@tiptap/pm/state';
import {Mapping} from '@tiptap/pm/transform';
import {isHistoryTransaction} from '@tiptap/pm/history';
import {columnIsEmpty,emptyColumnLayoutAtCursor,unwrapColumnLayout} from './column-layout.ts';

export function columnAutoUnwrapPlugin():Plugin {
 return new Plugin({
  key:new PluginKey('columnAutoUnwrap'),
  appendTransaction(transactions,oldState,newState){
   if(!transactions.some(tr=>tr.docChanged)||transactions.some(tr=>isHistoryTransaction(tr)||tr.getMeta('composition')!==undefined))return null;
   const mapping=new Mapping();for(const tr of transactions)mapping.appendMapping(tr.mapping);
   const candidates:number[]=[];
   oldState.doc.descendants((old,pos)=>{
    if(old.type.name!=='imageTextLayout')return;
    const mapped=mapping.mapResult(pos,1);if(mapped.deleted)return;
    const current=newState.doc.nodeAt(mapped.pos);
    if(current?.type.name!=='imageTextLayout'||current.childCount!==2)return;
    for(let index=0;index<2;index++)if(!columnIsEmpty(old.child(index))&&columnIsEmpty(current.child(index))){candidates.push(mapped.pos);break;}
   });
   if(!candidates.length)return null;
   const tr=newState.tr;
   for(const pos of candidates.sort((a,b)=>b-a))unwrapColumnLayout(tr,tr.mapping.map(pos),{isolate:false,select:false});
   return tr.docChanged?tr:null;
  },
  props:{handleDOMEvents:{compositionend(view){
   // Do not unwrap an IME's temporary empty paragraph while it is replacing syllables.
   queueMicrotask(()=>{
    if(view.isDestroyed||view.composing)return;
    const pos=emptyColumnLayoutAtCursor(view.state);if(pos===null)return;
    const tr=unwrapColumnLayout(view.state.tr,pos,{isolate:false,select:false});if(tr)view.dispatch(tr);
   });return false;
  }}},
 });
}
