import test from 'node:test';
import assert from 'node:assert/strict';
import {getSchema,Node} from '@tiptap/core';
import {EditorState,TextSelection} from '@tiptap/pm/state';
import {splitBlock} from '@tiptap/pm/commands';
import {history,undo,redo} from '@tiptap/pm/history';
import {TableKit} from '@tiptap/extension-table';
import {RichTextStarterKit} from '../src/features/post/rich-text-starter-kit.ts';
import {TextPanel} from '../src/features/post/editor-tools.ts';
import {textPanelExitTransaction} from '../src/features/post/text-panel-exit.ts';
import {columnExitTransaction} from '../src/features/post/column-exit.ts';
import {ImageTextLayout,ImageTextColumn} from '../src/features/post/image-text-columns.ts';
import {columnViewportKey,columnViewportPlugin} from '../src/features/post/column-viewport.ts';
const schema=getSchema([RichTextStarterKit,TextPanel,TableKit,ImageTextLayout,ImageTextColumn,Node.create({name:'image',group:'block',atom:true})]);
const p=text=>schema.node('paragraph',null,text?schema.text(text):null);
const panel=blocks=>schema.node('textPanel',null,blocks??p());
function fixture(nodes,find=node=>node.type.name==='paragraph',offset){
 const doc=schema.node('doc',null,nodes);let pos;
 doc.descendants((node,at)=>{if(pos===undefined&&find(node))pos=at+1+(offset??node.content.size);});
 let state=EditorState.create({schema,doc,selection:TextSelection.create(doc,pos),plugins:[history(),columnViewportPlugin()]});
 const editor={isEditable:true,view:{composing:false,dispatch:tr=>{state=state.apply(tr);}},get state(){return state;}};
 return {editor,keys:TextPanel.config.addKeyboardShortcuts.call({editor}),setState:next=>{state=next;}};
}
test('Enter after text creates an internal paragraph, then empty-paragraph Enter exits without losing text',()=>{
 const original=panel(p('hello')),f=fixture([original,p('following')]);
 assert.equal(f.keys.Enter(),false);assert.equal(splitBlock(f.editor.state,f.editor.view.dispatch),true);
 assert.equal(f.editor.state.doc.firstChild.childCount,2);assert.equal(f.editor.state.selection.$from.node(1).type.name,'textPanel');
 const beforeExit=f.editor.state.doc;assert.equal(f.keys.Enter(),true);
 assert.ok(f.editor.state.doc.firstChild.eq(original));assert.equal(f.editor.state.doc.child(1).content.size,0);
 assert.equal(f.editor.state.doc.lastChild.textContent,'following');assert.equal(f.editor.state.selection.$from.depth,1);
 assert.equal(undo(f.editor.state,f.editor.view.dispatch),true);assert.ok(f.editor.state.doc.eq(beforeExit));
 assert.equal(redo(f.editor.state,f.editor.view.dispatch),true);assert.ok(f.editor.state.doc.firstChild.eq(original));
});
test('middle empty paragraphs exit while preserving all other text and reuse an empty outside paragraph',()=>{
 const original=panel([p('before'),p(),p('after')]),f=fixture([original,p()],node=>node.type.name==='paragraph'&&node.content.size===0);
 assert.equal(f.keys.Enter(),true);assert.equal(f.editor.state.doc.childCount,2);
 assert.equal(f.editor.state.doc.firstChild.childCount,2);assert.equal(f.editor.state.doc.firstChild.textContent,'beforeafter');
 assert.equal(f.editor.state.selection.$from.depth,1);f.editor.state.doc.check();
});
test('a completely empty or nested panel stays valid and exits the nearest panel only',()=>{
 const f=fixture([panel()]);assert.equal(f.keys.Enter(),true);assert.equal(f.editor.state.doc.firstChild.type.name,'textPanel');
 assert.equal(f.editor.state.doc.childCount,2);assert.equal(f.editor.state.selection.$from.depth,1);f.editor.state.doc.check();
 const nested=fixture([panel(panel())]);assert.equal(nested.keys.Enter(),true);
 assert.equal(nested.editor.state.doc.childCount,1);assert.equal(nested.editor.state.doc.firstChild.childCount,2);
 assert.equal(nested.editor.state.doc.firstChild.firstChild.type.name,'textPanel');assert.equal(nested.editor.state.selection.$from.depth,2);
});
test('a panel inside columns keeps text Enter inside, exits the panel on an empty paragraph, then exits columns',()=>{
 const layout=schema.node('imageTextLayout',{ratio:'37:63'},[schema.node('imageTextColumn',null,schema.node('image')),schema.node('imageTextColumn',null,panel(p('inside')))]);
 const f=fixture([layout]);assert.equal(columnExitTransaction(f.editor.state),null);assert.equal(f.keys.Enter(),false);
 splitBlock(f.editor.state,f.editor.view.dispatch);assert.equal(columnExitTransaction(f.editor.state),null);assert.equal(f.keys.Enter(),true);
 assert.equal(f.editor.state.selection.$from.parent.type.name,'paragraph');assert.equal(f.editor.state.selection.$from.node(2).type.name,'imageTextColumn');
 assert.equal(columnViewportKey.getState(f.editor.state),false);
 const exit=columnExitTransaction(f.editor.state);assert.ok(exit);f.editor.view.dispatch(exit);
 assert.equal(f.editor.state.selection.$from.depth,1);assert.equal(f.editor.state.doc.firstChild.attrs.ratio,'37:63');assert.equal(f.editor.state.doc.firstChild.textContent,'inside');
});
test('content, whitespace, selections, code, table cells, lists, read-only and composition keep their existing Enter',()=>{
 for(const node of [p('text'),p(' '),schema.node('codeBlock'),schema.node('table',null,schema.node('tableRow',null,schema.node('tableCell',null,p()))),schema.node('bulletList',null,schema.node('listItem',null,p()))]){
  const f=fixture([panel(node)],node=>node.isTextblock);assert.equal(textPanelExitTransaction(f.editor.state),null);
 }
 for(const mode of ['readonly','composing']){
  const f=fixture([panel()]);if(mode==='readonly')f.editor.isEditable=false;else f.editor.view.composing=true;
  assert.equal(f.keys.Enter(),false);assert.equal(f.keys['Shift-Enter'],undefined);
 }
 const selected=fixture([panel(p('text'))]);selected.setState(selected.editor.state.apply(selected.editor.state.tr.setSelection(TextSelection.create(selected.editor.state.doc,2,4))));
 assert.equal(selected.keys.Enter(),false);
});
