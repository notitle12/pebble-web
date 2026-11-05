import test from 'node:test';
import assert from 'node:assert/strict';
import { getSchema, Node } from '@tiptap/core';
import { EditorState, TextSelection } from '@tiptap/pm/state';
import { TableKit } from '@tiptap/extension-table';
import { RichTextStarterKit } from '../src/features/post/rich-text-starter-kit.ts';
import { CodeBlockSelection } from '../src/features/post/code-block-selection.ts';
const TextPanel=Node.create({name:'textPanel',group:'block',content:'block+'});
const schema=getSchema([RichTextStarterKit.configure({codeBlock:false}),TextPanel,Node.create({name:'pebbleCode',group:'block',content:'text*',code:true})]);
const p=text=>schema.node('paragraph',null,text?schema.text(text):undefined);
const stateAt=(nodes,from,to=from)=>{const doc=schema.node('doc',null,nodes);return EditorState.create({schema,doc,selection:TextSelection.create(doc,from,to)});};

function codeSelectionFixture(state) {
 const editor={isEditable:true,view:{composing:false,dispatch(tr){state=state.apply(tr);}},get state(){return state;}};
 return {editor,keys:CodeBlockSelection.config.addKeyboardShortcuts.call({editor})};
}

test('Ctrl/Cmd+A selects only the current code contents, including repeated and partial selections',()=>{
 const text='first\n한글 second';
 const code=schema.node('pebbleCode',null,schema.text(text));
 const nodes=[p('before'),code,p('after'),schema.node('pebbleCode',null,schema.text('other code'))];
 const start=nodes[0].nodeSize+1,end=start+text.length;
 for(const [from,to] of [[start,start],[end,end],[start+3,start+8],[start+8,start+3]]) {
  const {editor,keys}=codeSelectionFixture(stateAt(nodes,from,to));
  const doc=editor.state.doc;
  for(const key of ['Mod-a','Ctrl-a','Mod-a']) {
   assert.equal(keys[key](),true);
   assert.ok(editor.state.selection instanceof TextSelection);
   assert.equal(editor.state.selection.from,start);
   assert.equal(editor.state.selection.to,end);
   assert.equal(editor.state.doc.textBetween(start,end),text);
   assert.ok(editor.state.doc.eq(doc));
  }
 }
});

test('select-all in an empty or nested code block stays inside that block',()=>{
 for(const text of ['', 'nested\ncode']) {
  for(const nested of [false,true]) {
   const code=schema.node('pebbleCode',null,text?schema.text(text):undefined);
   const nodes=[p('before'),nested?schema.node('textPanel',null,[p('inside'),code,p('following')]):code,p('after')];
   const start=nodes[0].nodeSize+(nested?1+p('inside').nodeSize:0)+1;
   const {editor,keys}=codeSelectionFixture(stateAt(nodes,start));
   for(const key of ['Mod-a','Ctrl-a']) {
    assert.equal(keys[key](),true);
    assert.equal(editor.state.selection.from,start);
    assert.equal(editor.state.selection.to,start+text.length);
    assert.equal(editor.state.selection.$from.parent.type.name,'pebbleCode');
   }
  }
 }
});

test('code select-all falls through for ordinary text, cross-block selections, read-only mode and IME',()=>{
 const nodes=[p('before'),schema.node('pebbleCode',null,schema.text('code')),p('after')];
 const start=nodes[0].nodeSize+1;
 const cases=[
  codeSelectionFixture(stateAt(nodes,2)),
  codeSelectionFixture(stateAt(nodes,start,start+nodes[1].nodeSize)),
  codeSelectionFixture(stateAt(nodes,2,start)),
  codeSelectionFixture(stateAt(nodes,start)),
  codeSelectionFixture(stateAt(nodes,start)),
 ];
 cases[3].editor.isEditable=false;
 cases[4].editor.view.composing=true;
 for(const {editor,keys} of cases) {
  const initial=editor.state;
  assert.equal(keys['Mod-a'](),false);
  assert.equal(keys['Ctrl-a'](),false);
  assert.equal(editor.state,initial);
 }
});

test('select-all inside a table cell selects the code text rather than the whole table',()=>{
 const tableSchema=getSchema([RichTextStarterKit.configure({codeBlock:false}),TableKit,CodeBlockSelection,Node.create({name:'pebbleCode',group:'block',content:'text*',code:true})]);
 const code=tableSchema.node('pebbleCode',null,tableSchema.text('cell code'));
 const cell=tableSchema.node('tableCell',null,code);
 const table=tableSchema.node('table',null,tableSchema.node('tableRow',null,cell));
 const doc=tableSchema.node('doc',null,table);
 const {editor,keys}=codeSelectionFixture(EditorState.create({schema:tableSchema,doc,selection:TextSelection.create(doc,4)}));
 assert.equal(keys['Mod-a'](),true);
 assert.ok(editor.state.selection instanceof TextSelection);
 assert.equal(editor.state.selection.from,4);
 assert.equal(editor.state.selection.to,4+'cell code'.length);
});
