import test from 'node:test';
import assert from 'node:assert/strict';
import {getSchema,Node} from '@tiptap/core';
import {EditorState,TextSelection} from '@tiptap/pm/state';
import {history,undo,redo} from '@tiptap/pm/history';
import {TableKit} from '@tiptap/extension-table';
import {RichTextStarterKit} from '../src/features/post/rich-text-starter-kit.ts';
import {TextPanel} from '../src/features/post/editor-tools.ts';
import {ImageTextColumn,ImageTextLayout} from '../src/features/post/image-text-columns.ts';
import {columnExitTransaction} from '../src/features/post/column-exit.ts';
import {columnAutoUnwrapPlugin} from '../src/features/post/column-auto-unwrap.ts';
import {columnViewportKey,columnViewportPlugin} from '../src/features/post/column-viewport.ts';
const Details=Node.create({name:'details',group:'block',content:'block+'});
const schema=getSchema([RichTextStarterKit,TextPanel,Details,TableKit,ImageTextColumn,ImageTextLayout,Node.create({name:'image',group:'block',atom:true})]);
const p=text=>schema.node('paragraph',null,text?schema.text(text):null);
const image=schema.node('image');
const row=(left=[image],right=[p('description')])=>schema.node('imageTextLayout',{ratio:'37:63'},[schema.node('imageTextColumn',null,left),schema.node('imageTextColumn',null,right)]);
function fixture(nodes,find=node=>node.type.name==='paragraph',offset){
 const doc=schema.node('doc',null,nodes);let pos;
 doc.descendants((node,at)=>{if(pos===undefined&&find(node))pos=at+1+(offset??node.content.size);});
 let state=EditorState.create({schema,doc,selection:TextSelection.create(doc,pos),plugins:[history(),columnAutoUnwrapPlugin(),columnViewportPlugin()]});
 const editor={isEditable:true,view:{composing:false,dispatch:tr=>{state=state.apply(tr);}},get state(){return state;}};
 const keys=ImageTextLayout.config.addKeyboardShortcuts.call({editor});
 return {editor,keys,setState:next=>{state=next;}};
}
test('Enter at either column end inserts a plain paragraph after the preserved layout with undo/redo',()=>{
 for(const side of ['left','right']){
  const layout=side==='left'?row([p('description')],[image]):row();
  const f=fixture([layout,p('following')]),original=f.editor.state.doc;
  assert.equal(f.keys.Enter(),true);assert.ok(f.editor.state.doc.firstChild.eq(layout));
  assert.equal(f.editor.state.doc.child(1).type.name,'paragraph');assert.equal(f.editor.state.doc.child(1).content.size,0);
  assert.equal(f.editor.state.doc.lastChild.textContent,'following');assert.equal(f.editor.state.selection.$from.depth,1);
  assert.equal(columnViewportKey.getState(f.editor.state),false);
  assert.equal(undo(f.editor.state,tr=>f.editor.view.dispatch(tr)),true);assert.ok(f.editor.state.doc.eq(original));
  assert.equal(redo(f.editor.state,tr=>f.editor.view.dispatch(tr)),true);assert.equal(f.editor.state.doc.childCount,3);
 }
});
test('an existing empty paragraph is reused and an empty column remains intact',()=>{
 const layout=row([image],[p()]),f=fixture([layout,p()]);assert.equal(f.keys.Enter(),true);
 assert.equal(f.editor.state.doc.childCount,2);assert.ok(f.editor.state.doc.firstChild.eq(layout));assert.equal(f.editor.state.selection.$from.depth,1);
});
test('the last paragraph inside a toggle exits into the layout parent',()=>{
 for(const kind of ['details']){
  const layout=row([image],[schema.node(kind,null,p('description'))]);
  const f=fixture([schema.node('textPanel',null,layout)]);assert.equal(f.keys.Enter(),true);
  assert.equal(f.editor.state.doc.firstChild.type.name,'textPanel');assert.ok(f.editor.state.doc.firstChild.firstChild.eq(layout));
  assert.equal(f.editor.state.doc.firstChild.lastChild.type.name,'paragraph');assert.equal(f.editor.state.selection.$from.parent.textContent,'');f.editor.state.doc.check();
 }
});
test('middle paragraphs, middle text, selected text and outside text keep normal Enter',()=>{
 const cases=[fixture([row([image],[p('first'),p('last')])]),fixture([row()],undefined,2),fixture([p('outside')])];
 const selected=fixture([row()]);selected.setState(selected.editor.state.apply(selected.editor.state.tr.setSelection(TextSelection.create(selected.editor.state.doc,selected.editor.state.selection.from-2,selected.editor.state.selection.from))));cases.push(selected);
 for(const f of cases){const original=f.editor.state;assert.equal(f.keys.Enter(),false);assert.equal(f.editor.state,original);}
});
test('code, table cells and list items retain their own Enter behavior',()=>{
 const contents=[schema.node('codeBlock',null,schema.text('code')),schema.node('table',null,schema.node('tableRow',null,schema.node('tableCell',null,p('cell')))),schema.node('bulletList',null,schema.node('listItem',null,p('item')))];
 for(const content of contents){
  const f=fixture([row([image],[content])],node=>node.isTextblock),original=f.editor.state.doc;
  assert.equal(columnExitTransaction(f.editor.state),null);assert.ok(f.editor.state.doc.eq(original));
 }
});
test('read-only and composition are protected; Shift+Enter is left to the existing hard-break binding',()=>{
 for(const mode of ['readonly','composing']){
  const f=fixture([row()]);if(mode==='readonly')f.editor.isEditable=false;else f.editor.view.composing=true;
  assert.equal(f.keys.Enter(),false);assert.equal(f.keys['Shift-Enter'],undefined);
 }
});
