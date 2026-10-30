import test from 'node:test';
import assert from 'node:assert/strict';
import {getSchema} from '@tiptap/core';
import {TableKit} from '@tiptap/extension-table';
import {EditorState,TextSelection} from '@tiptap/pm/state';
import {CellSelection,TableMap,mergeCells,columnResizing,columnResizingPluginKey} from '@tiptap/pm/tables';
import {RichTextStarterKit} from '../src/features/post/rich-text-starter-kit.ts';
import {freezeTableColumnWidths,tableGripCorridors,normalizeColumnWidths,resizeColumnWidths,resizeTableBoundary,stableTableColumnResizing} from '../src/features/post/table-column-resize.ts';
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


test('internal column shrinking keeps the outer width and growth consumes neighbor space before expanding',()=>{
 assert.deepEqual(resizeColumnWidths([200,300,250,150],0,-60),[140,360,250,150]);
 assert.deepEqual(resizeColumnWidths([200,300,250,150],1,80),[200,380,170,150]);
 for(const delta of [-10000,-10,0,10,200]) {
  const result=resizeColumnWidths([200,300,250],0,delta);
  assert.equal(result.reduce((a,b)=>a+b,0),750);assert.equal(result[2],250);assert.ok(result.every(width=>width>=48));
 }
 assert.deepEqual(resizeColumnWidths([48,48,250],0,100),[148,48,250]);
 assert.deepEqual(resizeColumnWidths([200,300,250],2,100),[200,300,350]);
 assert.deepEqual(resizeColumnWidths([200,300,250],2,-1000),[200,300,48]);
 assert.equal(normalizeColumnWidths([299.65625,299.65625,299.6875]).reduce((a,b)=>a+b,0),899);
});
test('paired resizing is one reversible document change and keeps cell content and selection',()=>{
 const before=initial(),tr=resizeTableBoundary(before,0,[200,300,250],0,-60),after=before.apply(tr);
 after.doc.firstChild.forEach(row=>{assert.deepEqual(row.child(0).attrs.colwidth,[140]);assert.deepEqual(row.child(1).attrs.colwidth,[360]);assert.deepEqual(row.child(2).attrs.colwidth,[250]);});
 assert.ok(after.selection.eq(before.selection));assert.equal(after.doc.textContent,before.doc.textContent);
 let restored=tr.doc;for(let i=tr.steps.length-1;i>=0;i--)restored=tr.steps[i].invert(tr.docs[i]).apply(restored).doc;
 assert.deepEqual(restored.toJSON(),before.doc.toJSON());
});

test('one drag can expand then retreat while committing the grown outline and original selection',()=>{
 class Events {
  listeners=new Map();
  addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);}
  removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}
  emit(type,event){for(const fn of this.listeners.get(type)??[])fn(event);}
 }
 const before=initial(),owner=new Events(),doc=new Events();doc.defaultView=owner;
 const colgroup={children:[48,48,100].map(width=>({style:{},getBoundingClientRect:()=>({width})}))};
 const table={querySelector:()=>colgroup,style:{},isConnected:true};
 const cell={closest:()=>table,getBoundingClientRect:()=>({right:100})};
 const view={state:EditorState.create({schema,doc:before.doc,selection:before.selection,plugins:[columnResizing()]}),
  editable:true,composing:false,isDestroyed:false,dom:{ownerDocument:doc},nodeDOM:()=>cell,
  dispatch(tr){this.state=this.state.apply(tr);}};
 const handle=1+TableMap.get(view.state.doc.firstChild).map[0];
 view.dispatch(view.state.tr.setMeta(columnResizingPluginKey,{setHandle:handle}));
 const selection=view.state.selection,plugin=stableTableColumnResizing(),lifecycle=plugin.spec.view(view);
 const event=x=>({button:0,buttons:1,clientX:x,preventDefault(){}});
 assert.equal(plugin.props.handleDOMEvents.mousedown(view,event(99)),true);
 doc.emit('mousemove',event(199));
 doc.emit('mousemove',event(119));
 doc.emit('mouseup',event(119));
 view.state.doc.firstChild.forEach(row=>{assert.deepEqual(row.child(0).attrs.colwidth,[68]);assert.deepEqual(row.child(1).attrs.colwidth,[128]);assert.deepEqual(row.child(2).attrs.colwidth,[100]);});
 assert.ok(view.state.selection.eq(selection));assert.equal(view.state.doc.textContent,before.doc.textContent);
 assert.equal(columnResizingPluginKey.getState(view.state).dragging,null);
 lifecycle.destroy();assert.equal(doc.listeners.get('mousemove').size,0);
});
