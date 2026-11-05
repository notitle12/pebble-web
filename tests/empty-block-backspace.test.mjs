import test from 'node:test';
import assert from 'node:assert/strict';
import {getSchema,Node} from '@tiptap/core';
import {EditorState,TextSelection} from '@tiptap/pm/state';
import {history,undo,redo} from '@tiptap/pm/history';
import {TableKit} from '@tiptap/extension-table';
import {CellSelection} from '@tiptap/pm/tables';
import {RichTextStarterKit} from '../src/features/post/rich-text-starter-kit.ts';
import {TextPanel} from '../src/features/post/editor-tools.ts';
import {EmptyBlockBackspace} from '../src/features/post/empty-block-backspace.ts';
const schema=getSchema([RichTextStarterKit,TextPanel,TableKit,Node.create({name:'image',group:'block',atom:true})]);
const p=text=>schema.node('paragraph',null,text?schema.text(text):null);
const panel=content=>schema.node('textPanel',null,content??p());
function fixture(nodes,find=node=>node.type.name==='paragraph'){
 const doc=schema.node('doc',null,nodes);let pos;
 doc.descendants((node,offset)=>{if(pos===undefined&&find(node))pos=offset+1;});
 let state=EditorState.create({schema,doc,selection:TextSelection.create(doc,pos),plugins:[history()]});
 const editor={isEditable:true,view:{composing:false,dispatch:tr=>{state=state.apply(tr);}},get state(){return state;}};
 const keys=EmptyBlockBackspace.config.addKeyboardShortcuts.call({editor,options:EmptyBlockBackspace.config.addOptions()});
 return {editor,keys,setState:next=>{state=next;}};
}
test('Backspace removes one empty general block and supports independent undo/redo',()=>{
 const f=fixture([panel([p(),p()]),p('after')]),original=f.editor.state.doc;
 assert.equal(f.keys.Backspace(),true);assert.equal(f.editor.state.doc.childCount,1);assert.equal(f.editor.state.doc.textContent,'after');
 assert.equal(f.editor.state.selection.$from.parent.type.name,'paragraph');
 assert.equal(undo(f.editor.state,tr=>f.editor.view.dispatch(tr)),true);assert.ok(f.editor.state.doc.eq(original));
 assert.equal(redo(f.editor.state,tr=>f.editor.view.dispatch(tr)),true);assert.equal(f.editor.state.doc.textContent,'after');
});
const table=(values=[['',''],['','']])=>schema.node('table',null,values.map(row=>schema.node('tableRow',null,row.map(text=>schema.node('tableCell',null,p(text))))));
test('Backspace from any empty cell removes the entire empty table in one undo step',()=>{
 for(const cellIndex of [0,1,2,3]){
  const f=fixture([table(),p('after')]);const positions=[];f.editor.state.doc.descendants((node,pos)=>{if(node.type.name==='tableCell')positions.push(pos);});
  f.setState(f.editor.state.apply(f.editor.state.tr.setSelection(TextSelection.create(f.editor.state.doc,positions[cellIndex]+2))));
  const original=f.editor.state.doc;assert.equal(f.keys.Backspace(),true);assert.equal(f.editor.state.doc.textContent,'after');assert.equal(f.editor.state.doc.childCount,1);
  assert.equal(undo(f.editor.state,tr=>f.editor.view.dispatch(tr)),true);assert.ok(f.editor.state.doc.eq(original));
  assert.equal(redo(f.editor.state,tr=>f.editor.view.dispatch(tr)),true);assert.equal(f.editor.state.doc.firstChild.type.name,'paragraph');
 }
});
test('a sole empty table and cell selections leave an editable paragraph',()=>{
 const f=fixture([table()]);f.setState(f.editor.state.apply(f.editor.state.tr.setSelection(CellSelection.create(f.editor.state.doc,2))));
 assert.equal(f.keys.Backspace(),true);assert.equal(f.editor.state.doc.firstChild.type.name,'paragraph');f.editor.state.doc.check();
});
test('content in another cell or an embedded image/code protects the whole table',()=>{
 for(const filled of [table([['',''],['','last']]),table([['',' ']]),schema.node('table',null,schema.node('tableRow',null,[schema.node('tableCell',null,p()),schema.node('tableCell',null,schema.node('image'))])),schema.node('table',null,schema.node('tableRow',null,[schema.node('tableCell',null,p()),schema.node('tableCell',null,schema.node('codeBlock'))]))]){
  const f=fixture([panel(filled)]),original=f.editor.state.doc;assert.equal(f.keys.Backspace(),false);assert.ok(f.editor.state.doc.eq(original));
 }
});
test('a sole or nested general block leaves valid editable content and deletes only the nearest wrapper',()=>{
 for(const nodes of [[panel()],[panel([panel()])]]){
  const f=fixture(nodes);assert.equal(f.keys.Backspace(),true);f.editor.state.doc.check();
  assert.equal(f.editor.state.selection.$from.parent.type.name,'paragraph');
  assert.equal(f.editor.state.doc.firstChild.type.name,nodes[0].firstChild.type.name==='textPanel'?'textPanel':'paragraph');
 }
});
test('characters, whitespace, images and code protect a general block, including empty first paragraphs',()=>{
 for(const content of [[p('text')],[p(' ')],[p(),p('later')],[p(),schema.node('image')],[p(),schema.node('codeBlock')]]){
  const f=fixture([panel(content)]),original=f.editor.state.doc;
  f.keys.Backspace();assert.ok(f.editor.state.doc.eq(original));
 }
});
test('ordinary text, selected text, read-only mode and composing input keep their normal handling',()=>{
 const plain=fixture([p('outside')]);assert.equal(plain.keys.Backspace(),false);
 for(const mode of ['readonly','composing']){
  const f=fixture([panel()]);if(mode==='readonly')f.editor.isEditable=false;else f.editor.view.composing=true;
  assert.equal(f.keys.Backspace(),false);assert.equal(f.editor.state.doc.firstChild.type.name,'textPanel');
 }
 const f=fixture([panel(p('select'))]);f.setState(f.editor.state.apply(f.editor.state.tr.setSelection(TextSelection.create(f.editor.state.doc,2,5))));
 assert.equal(f.keys.Backspace(),false);
});
