import test from 'node:test';
import assert from 'node:assert/strict';
import {getSchema,Node} from '@tiptap/core';
import {EditorState,TextSelection} from '@tiptap/pm/state';
import {history,undo,redo} from '@tiptap/pm/history';
import {RichTextStarterKit} from '../src/features/post/rich-text-starter-kit.ts';
import {TextPanel} from '../src/features/post/editor-tools.ts';
import {EmptyBlockBackspace} from '../src/features/post/empty-block-backspace.ts';
const schema=getSchema([RichTextStarterKit,TextPanel,Node.create({name:'image',group:'block',atom:true})]);
const p=text=>schema.node('paragraph',null,text?schema.text(text):null);
const panel=content=>schema.node('textPanel',null,content??p());
function fixture(nodes,find=node=>node.type.name==='paragraph'){
 const doc=schema.node('doc',null,nodes);let pos;
 doc.descendants((node,offset)=>{if(pos===undefined&&find(node))pos=offset+1;});
 let state=EditorState.create({schema,doc,selection:TextSelection.create(doc,pos),plugins:[history()]});
 const editor={isEditable:true,view:{composing:false,dispatch:tr=>{state=state.apply(tr);}},get state(){return state;}};
 const keys=EmptyBlockBackspace.config.addKeyboardShortcuts.call({editor,options:{types:['textPanel']}});
 return {editor,keys,setState:next=>{state=next;}};
}
test('Backspace removes one empty general block and supports independent undo/redo',()=>{
 const f=fixture([panel([p(),p()]),p('after')]),original=f.editor.state.doc;
 assert.equal(f.keys.Backspace(),true);assert.equal(f.editor.state.doc.childCount,1);assert.equal(f.editor.state.doc.textContent,'after');
 assert.equal(f.editor.state.selection.$from.parent.type.name,'paragraph');
 assert.equal(undo(f.editor.state,tr=>f.editor.view.dispatch(tr)),true);assert.ok(f.editor.state.doc.eq(original));
 assert.equal(redo(f.editor.state,tr=>f.editor.view.dispatch(tr)),true);assert.equal(f.editor.state.doc.textContent,'after');
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
