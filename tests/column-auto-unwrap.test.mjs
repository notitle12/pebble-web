import test from 'node:test';
import assert from 'node:assert/strict';
import {getSchema,Node} from '@tiptap/core';
import {EditorState,TextSelection} from '@tiptap/pm/state';
import {history,undo,redo} from '@tiptap/pm/history';
import {ImageTextLayout,ImageTextColumn} from '../src/features/post/image-text-columns.ts';
import {columnAutoUnwrapPlugin} from '../src/features/post/column-auto-unwrap.ts';
import {unwrapEmptyColumnAtCursor} from '../src/features/post/column-layout.ts';
import {movableBlocks,moveBodyBlock,placeBodyBlockBeside} from '../src/features/post/block-move.ts';
const schema=getSchema([ImageTextLayout,ImageTextColumn,Node.create({name:'doc',topNode:true,content:'block+'}),Node.create({name:'paragraph',group:'block',content:'text*'}),Node.create({name:'text',group:'inline'}),Node.create({name:'image',group:'block',atom:true,addAttributes:()=>({src:{default:null},width:{default:null}})})]);
const p=value=>schema.node('paragraph',null,value?schema.text(value):null);
const image=schema.node('image',{src:'https://example.test/source.png',width:240});
const row=(left=[image],right=[p('설명')])=>schema.node('imageTextLayout',{ratio:'37:63'},[schema.node('imageTextColumn',null,left),schema.node('imageTextColumn',null,right)]);
const stateFor=(nodes)=>EditorState.create({schema,doc:schema.node('doc',null,nodes),plugins:[history(),columnAutoUnwrapPlugin()]});
const countLayouts=doc=>{let count=0;doc.descendants(node=>{if(node.type.name==='imageTextLayout')count++;});return count;};
test('moving the last block out removes the empty column layout in the same undo step',()=>{
 let state=stateFor([row(),p('after')]);const original=state.doc;
 const source=movableBlocks(state.doc).find(block=>block.node.type.name==='image');
 state=state.apply(moveBodyBlock(state.tr,source.pos,state.doc.content.size));
 assert.equal(countLayouts(state.doc),0);assert.equal(state.doc.textContent,'설명after');assert.ok(state.doc.lastChild.eq(image));state.doc.check();
 assert.equal(undo(state,tr=>state=state.apply(tr)),true);assert.ok(state.doc.eq(original));
 assert.equal(redo(state,tr=>state=state.apply(tr)),true);assert.equal(countLayouts(state.doc),0);assert.ok(state.doc.lastChild.eq(image));
});
test('deleting either last image or all text removes the wrapper and retains the other side',()=>{
 for(const side of ['image','paragraph']){
  let state=stateFor([row()]);const original=state.doc;
  const block=movableBlocks(state.doc).find(item=>item.parentType==='imageTextColumn'&&item.node.type.name===side);
  const tr=side==='image'?state.tr.replaceWith(block.pos,block.end,p()):state.tr.delete(block.pos+1,block.end-1);
  state=state.apply(tr);assert.equal(countLayouts(state.doc),0);
  if(side==='image')assert.equal(state.doc.textContent,'설명');else assert.ok(state.doc.firstChild.eq(image));
  assert.equal(undo(state,tr=>state=state.apply(tr)),true);assert.ok(state.doc.eq(original));
 }
});
test('multiple remaining blocks keep a column; newly made empty columns and undo are preserved',()=>{
 let state=stateFor([row([image,p('caption')])]);
 const src=movableBlocks(state.doc).find(item=>item.node.type.name==='image');state=state.apply(moveBodyBlock(state.tr,src.pos,state.doc.content.size));assert.equal(countLayouts(state.doc),1);
 state=stateFor([p(),image]);const source=movableBlocks(state.doc).find(item=>item.node.type.name==='image');
 state=state.apply(placeBodyBlockBeside(state.tr,source.pos,0,'left'));assert.equal(countLayouts(state.doc),1);
 const blank=movableBlocks(state.doc).find(item=>item.parentType==='imageTextColumn'&&item.node.type.name==='paragraph');
 const emptyLayout=state.doc;state=state.apply(state.tr.insertText('hello',blank.pos+1).setTime(Date.now()+1000));
 assert.equal(undo(state,tr=>state=state.apply(tr)),true);assert.ok(state.doc.eq(emptyLayout));assert.equal(countLayouts(state.doc),1);
});
test('Backspace/Delete in an already empty column unwraps but editing a nonempty column does not',()=>{
 let state=stateFor([row([image],[p()])]);const blank=movableBlocks(state.doc).find(item=>item.node.type.name==='paragraph');state=state.apply(state.tr.setSelection(TextSelection.create(state.doc,blank.pos+1)));
 assert.equal(unwrapEmptyColumnAtCursor(state,tr=>state=state.apply(tr)),true);assert.ok(state.doc.firstChild.eq(image));
 state=stateFor([row()]);const text=movableBlocks(state.doc).find(item=>item.node.type.name==='paragraph');state=state.apply(state.tr.setSelection(TextSelection.create(state.doc,text.pos+1)));
 assert.equal(unwrapEmptyColumnAtCursor(state),false);
});
test('IME temporary empty text does not collapse a layout mid-composition',()=>{
 let state=stateFor([row()]);const text=movableBlocks(state.doc).find(item=>item.node.type.name==='paragraph');
 state=state.apply(state.tr.delete(text.pos+1,text.end-1).setMeta('composition',1));assert.equal(countLayouts(state.doc),1);
});

test('pulling a column child above the layout preserves the block and unwraps the remaining side',()=>{
 let state=stateFor([row()]);const source=movableBlocks(state.doc).find(item=>item.node.type.name==='image'),original=state.doc;
 state=state.apply(moveBodyBlock(state.tr,source.pos,0));assert.equal(countLayouts(state.doc),0);assert.ok(state.doc.firstChild.eq(image));assert.equal(state.doc.lastChild.textContent,'설명');
 assert.equal(undo(state,tr=>state=state.apply(tr)),true);assert.ok(state.doc.eq(original));
});
