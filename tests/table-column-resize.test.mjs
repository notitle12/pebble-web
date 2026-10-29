import test from 'node:test';
import assert from 'node:assert/strict';
import {getSchema} from '@tiptap/core';
import {TableKit} from '@tiptap/extension-table';
import {EditorState,TextSelection} from '@tiptap/pm/state';
import {CellSelection,TableMap,mergeCells} from '@tiptap/pm/tables';
import {RichTextStarterKit} from '../src/features/post/rich-text-starter-kit.ts';
import {freezeTableColumnWidths,tableGripCorridors,normalizeColumnWidths,pairedColumnWidths,resizeTableBoundary} from '../src/features/post/table-column-resize.ts';
import {setSelectedColumnWidth} from '../src/features/post/table-tools.ts';
const schema=getSchema([RichTextStarterKit,TableKit]);
function initial(){
 const cell=()=>schema.node('tableCell',null,schema.node('paragraph',null,schema.text('내용')));
 const row=()=>schema.node('tableRow',null,[cell(),cell(),cell()]);
 const doc=schema.node('doc',null,schema.node('table',null,[row(),row()]));
 return EditorState.create({schema,doc,selection:TextSelection.create(doc,4)});
}
test('setting a fixed column width retains the measured widths of its neighbors and the selection',()=>{
 let state=initial();const before=state.selection;
 state=state.apply(freezeTableColumnWidths(state,0,[280,300,320]));
 assert.ok(state.selection.eq(before));
 state=state.apply(setSelectedColumnWidth(state,360));
 state.doc.firstChild.forEach(row=>{assert.deepEqual(row.child(0).attrs.colwidth,[360]);assert.deepEqual(row.child(1).attrs.colwidth,[300]);assert.deepEqual(row.child(2).attrs.colwidth,[320]);});
 assert.equal(freezeTableColumnWidths(state,0,[360,300,320]),null);
});
test('freezing widths respects merged column spans and rejects incomplete measurements',()=>{
 let state=initial();const map=TableMap.get(state.doc.firstChild);
 state=state.apply(state.tr.setSelection(CellSelection.create(state.doc,1+map.map[0],1+map.map[1])));
 mergeCells(state,tr=>{state=state.apply(tr);});
 state=state.apply(freezeTableColumnWidths(state,0,[110,130,160]));
 assert.deepEqual(state.doc.firstChild.firstChild.firstChild.attrs.colwidth,[110,130]);
 assert.equal(freezeTableColumnWidths(state,0,[100]),null);assert.equal(freezeTableColumnWidths(state,0,[100,NaN,100]),null);
});
test('moving from a cell across the gutter to either grip keeps a continuous hit area',()=>{
 const table={left:100,top:100},cell={left:100,right:300,top:100,bottom:160};
 for(const x of [104,100,99,97,90,77])assert.equal(tableGripCorridors({x,y:130},table,cell).row,true);
 for(const y of [104,100,99,97,90,77])assert.equal(tableGripCorridors({x:200,y},table,cell).column,true);
 assert.deepEqual(tableGripCorridors({x:50,y:50},table,cell),{row:false,column:false});
});


test('dragging an internal boundary keeps the outer width and only trades width with its immediate neighbor',()=>{
 assert.deepEqual(pairedColumnWidths([200,300,250,150],0,-60),[140,360,250,150]);
 assert.deepEqual(pairedColumnWidths([200,300,250,150],1,80),[200,380,170,150]);
 assert.equal(pairedColumnWidths([200,300,250],2,100),null);
 for(const delta of [-10000,-10,0,10,10000]) {
  const result=pairedColumnWidths([200,300,250],0,delta);
  assert.equal(result.reduce((a,b)=>a+b,0),750);assert.equal(result[2],250);assert.ok(result.every(width=>width>=48));
 }
 assert.equal(normalizeColumnWidths([299.65625,299.65625,299.6875]).reduce((a,b)=>a+b,0),899);
});
test('paired resizing is one reversible document change and keeps cell content and selection',()=>{
 const before=initial(),tr=resizeTableBoundary(before,0,[200,300,250],0,-60),after=before.apply(tr);
 after.doc.firstChild.forEach(row=>{assert.deepEqual(row.child(0).attrs.colwidth,[140]);assert.deepEqual(row.child(1).attrs.colwidth,[360]);assert.deepEqual(row.child(2).attrs.colwidth,[250]);});
 assert.ok(after.selection.eq(before.selection));assert.equal(after.doc.textContent,before.doc.textContent);
 let restored=tr.doc;for(let i=tr.steps.length-1;i>=0;i--)restored=tr.steps[i].invert(tr.docs[i]).apply(restored).doc;
 assert.deepEqual(restored.toJSON(),before.doc.toJSON());
});
