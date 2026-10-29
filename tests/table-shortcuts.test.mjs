import test from 'node:test';
import assert from 'node:assert/strict';
import {getSchema} from '@tiptap/core';
import {TableKit} from '@tiptap/extension-table';
import {EditorState,TextSelection} from '@tiptap/pm/state';
import {CellSelection} from '@tiptap/pm/tables';
import {RichTextStarterKit} from '../src/features/post/rich-text-starter-kit.ts';
import {TableShortcuts,tableShortcuts} from '../src/features/post/table-shortcuts.ts';
import {tableContext} from '../src/features/post/table-tools.ts';
const schema=getSchema([RichTextStarterKit,TableKit]);
function fixture(inTable=true) {
 const p=()=>schema.node('paragraph');const cell=()=>schema.node('tableCell',null,p());
 const row=()=>schema.node('tableRow',null,[cell(),cell()]);
 const doc=schema.node('doc',null,inTable?schema.node('table',null,[row(),row()]):p());
 let state=EditorState.create({schema,doc,selection:TextSelection.create(doc,inTable?4:1)});
 const editor={isEditable:true,view:{composing:false,dispatch(tr){state=state.apply(tr);}},get state(){return state;}};
 const keys=TableShortcuts.config.addKeyboardShortcuts.call({editor});
 return {editor,keys};
}

test('row/column insertion shortcuts modify the correct table axis',()=>{
 for (const [key,rows,cols] of [['Mod-Alt-ArrowDown',3,2],['Mod-Alt-ArrowUp',3,2],['Mod-Alt-ArrowLeft',2,3],['Mod-Alt-ArrowRight',2,3]]) {
  const {editor,keys}=fixture();assert.equal(keys[key](),true);
  assert.equal(editor.state.doc.firstChild.childCount,rows);
  assert.equal(editor.state.doc.firstChild.firstChild.childCount,cols);
 }
});
test('selection shortcuts and merge/split shortcuts perform their actions',()=>{
 const {editor,keys}=fixture();keys['Shift-Space']();assert.ok(editor.state.selection instanceof CellSelection);
 let count=0;editor.state.selection.forEachCell(()=>count++);assert.equal(count,2);
 keys['Mod-Shift-m']();assert.equal(editor.state.doc.firstChild.firstChild.firstChild.attrs.colspan,2);
 keys['Mod-Alt-Shift-m']();assert.equal(editor.state.doc.firstChild.firstChild.childCount,2);
 keys['Mod-Shift-Space']();assert.ok(editor.state.selection instanceof CellSelection);
 keys['Mod-Shift-r']();editor.state.selection.forEachCell(cell=>assert.equal(cell.attrs.align,'right'));
});
test('table shortcuts do not intercept plain text, read-only mode, or IME composition',()=>{
 const outside=fixture(false);for(const fn of Object.values(outside.keys))assert.equal(fn(),false);
 const f=fixture();f.editor.view.composing=true;assert.equal(f.keys['Shift-Space'](),false);
 f.editor.view.composing=false;f.editor.isEditable=false;assert.equal(f.keys['Mod-Alt-ArrowDown'](),false);
 assert.equal(tableContext(f.editor.state).map.height,2);
 assert.equal(new Set(tableShortcuts.map(s=>s.key)).size,tableShortcuts.length);
});

test('Ctrl/Cmd+A selects the entire current table from a caret and an existing cell selection',()=>{
 const {editor,keys}=fixture();assert.equal(keys['Mod-a'](),true);
 assert.ok(editor.state.selection instanceof CellSelection);
 let count=0;editor.state.selection.forEachCell(()=>count++);assert.equal(count,4);
 assert.equal(keys['Ctrl-a'](),true);count=0;editor.state.selection.forEachCell(()=>count++);assert.equal(count,4);
 const outside=fixture(false);assert.equal(outside.keys['Mod-a'](),false);
});
