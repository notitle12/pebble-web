import test from 'node:test';
import assert from 'node:assert/strict';
import {getSchema} from '@tiptap/core';
import {TableKit} from '@tiptap/extension-table';
import {EditorState, TextSelection} from '@tiptap/pm/state';
import {CellSelection, TableMap, tableEditing, tableEditingKey} from '@tiptap/pm/tables';
import {RichTextStarterKit} from '../src/features/post/rich-text-starter-kit.ts';
import {tableCellInteractions} from '../src/features/post/table-cell-interactions.ts';
const schema = getSchema([RichTextStarterKit, TableKit]);
class Events {
  listeners = new Map();
  addEventListener(type, fn) {if (!this.listeners.has(type)) this.listeners.set(type,new Set());this.listeners.get(type).add(fn);}
  removeEventListener(type,fn) {this.listeners.get(type)?.delete(fn);}
  emit(type,event={}) {for(const fn of this.listeners.get(type)??[]) fn(event);}
}
function setup() {
  const row = () => schema.node('tableRow',null,[0,1,2].map(i=>schema.node('tableCell',null,schema.node('paragraph',null,i===0?schema.text('내용'):undefined))));
  const table = schema.node('table',null,[row(),row(),row()]);
  const doc = schema.node('doc',null,table), map = TableMap.get(table);
  const plugin = tableCellInteractions(), owner = new Events(), root = new Events();
  root.defaultView = owner;root.elementFromPoint=()=>null;
  const cells = map.map.map(offset=>({nodeType:1,pos:1+offset,textContent:table.nodeAt(offset).textContent,closest(){return this;}}));
  const view = {state:EditorState.create({schema,doc,selection:TextSelection.create(doc,4),plugins:[tableEditing()]}),editable:true,composing:false,isDestroyed:false,
    dom:{ownerDocument:root,contains:cell=>cells.includes(cell)},posAtDOM:cell=>cell.pos+1,focus(){},dispatch(tr){this.state=this.state.apply(tr);}};
  const lifecycle=plugin.spec.view(view);
  const event = (index,extra={})=>({target:cells[index],button:0,buttons:1,detail:1,clientX:10+index*20,clientY:10,preventDefault(){this.prevented=true;},...extra});
  return {view,root,owner,cells,event,down:e=>plugin.props.handleDOMEvents.mousedown(view,e),double:e=>plugin.props.handleDOMEvents.dblclick(view,e),dispose:lifecycle.destroy};
}
const count = view => {let n=0;view.state.selection.forEachCell(()=>n++);return n;};

test('dragging between actual cell elements selects the rectangle, including tall empty padding',()=>{
 const f=setup();f.down(f.event(1));f.root.emit('mousemove',f.event(8));
 assert.ok(f.view.state.selection instanceof CellSelection);assert.equal(count(f.view),6);
 f.root.emit('mouseup',f.event(8,{buttons:0}));assert.equal(count(f.view),6);
 assert.equal(tableEditingKey.getState(f.view.state),null);
 // Reverse and repeat the gesture without the native coordinate-to-text hit test.
 f.down(f.event(8));f.root.emit('mousemove',f.event(0));f.root.emit('mouseup',f.event(0,{buttons:0}));assert.equal(count(f.view),9);f.dispose();
});
test('double clicks on empty cells and populated text consistently select exactly one cell',()=>{
 const f=setup();
 for(const index of [1,0,8,0,1,1]) {
   const cell=f.cells[index];
   const textTarget={nodeType:1,closest:()=>cell};
   const e=f.event(index,{detail:2,target:textTarget});
   f.down(e);f.root.emit('mouseup',e);f.double(e);
   assert.ok(f.view.state.selection instanceof CellSelection);assert.equal(count(f.view),1);
   assert.equal(f.view.state.selection.$anchorCell.pos,cell.pos);
 }
 f.dispose();
});
test('single clicks return to editing and window blur cancels only the active drag',()=>{
 const f=setup();f.down(f.event(1));f.root.emit('mouseup',f.event(1,{buttons:0}));assert.ok(f.view.state.selection instanceof TextSelection);
 f.down(f.event(0));f.root.emit('mousemove',f.event(4));assert.equal(count(f.view),4);
 f.owner.emit('blur');f.root.emit('mousemove',f.event(8));assert.equal(count(f.view),4);
 f.dispose();assert.equal(f.root.listeners.get('mousemove').size,0);
});
