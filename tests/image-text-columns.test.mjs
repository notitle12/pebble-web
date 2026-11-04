import test from 'node:test';
import assert from 'node:assert/strict';
import {getSchema, Node} from '@tiptap/core';
import {EditorState} from '@tiptap/pm/state';
import {history,undo,redo} from '@tiptap/pm/history';
import {ImageTextLayout,ImageTextColumn,newImageTextLayout} from '../src/features/post/image-text-columns.ts';
import {moveBodyBlock,movableBlocks} from '../src/features/post/block-move.ts';
import {richContentHtml} from '../src/features/post/rich-content.ts';
import {htmlToMarkdown} from '../src/features/post/html-to-markdown.ts';
const schema=getSchema([ImageTextLayout,ImageTextColumn,Node.create({name:'doc',topNode:true,content:'block+'}),Node.create({name:'paragraph',group:'block',content:'text*'}),Node.create({name:'text',group:'inline'}),Node.create({name:'pebbleCode',group:'block',content:'text*'})]);
test('two columns preserve their fixed structure when moving code in and out with undo',()=>{
 const layout=schema.nodeFromJSON(newImageTextLayout());
 let state=EditorState.create({schema,doc:schema.node('doc',null,[layout,schema.node('pebbleCode',null,schema.text('code'))]),plugins:[history()]});
 const original=state.doc;
 const code=movableBlocks(state.doc).find(x=>x.node.type.name==='pebbleCode');
 state=state.apply(moveBodyBlock(state.tr,code.pos,2));
 assert.equal(state.doc.firstChild.firstChild.firstChild.type.name,'pebbleCode');
 assert.equal(state.doc.firstChild.childCount,2);
 const columnPos=1;
 assert.equal(moveBodyBlock(state.tr,columnPos,state.doc.content.size),null);
 assert.equal(moveBodyBlock(state.tr,0,1),null);
 assert.equal(undo(state,tr=>state=state.apply(tr)),true);assert.ok(state.doc.eq(original));
 assert.equal(redo(state,tr=>state=state.apply(tr)),true);
 const nestedCode=movableBlocks(state.doc).find(x=>x.node.type.name==='pebbleCode');
 state=state.apply(moveBodyBlock(state.tr,nestedCode.pos,state.doc.content.size));
 assert.equal(state.doc.firstChild.firstChild.firstChild.type.name,'paragraph');
});
test('safe HTML and Markdown retain columns, ratio, image and text while stripping unsafe attrs',()=>{
 const source='<div class="post-columns" data-ratio="1:2" onclick="evil()"><div class="post-column"><p><img src="https://example.test/image.webp"></p></div><div class="post-column"><p>설명</p></div></div>';
 const safe=richContentHtml(source,'HTML');
 assert.match(safe,/class="post-columns" data-ratio="1:2"/);
 assert.doesNotMatch(safe,/onclick/);
 const restored=richContentHtml(htmlToMarkdown(safe),'MARKDOWN');
 assert.match(restored,/post-columns/);assert.match(restored,/data-ratio="1:2"/);assert.match(restored,/설명/);assert.match(restored,/image.webp/);
 assert.doesNotMatch(richContentHtml(source.replace('1:2','evil'),'HTML'),/data-ratio/);
});

test('dropping either side of a paragraph creates equal columns without duplicating blocks, with undo/redo',async()=>{
 const {placeBodyBlockBeside,sideOfBlockDrop}=await import('../src/features/post/block-move.ts');
 for(const side of ['left','right'])for(const reverse of [false,true]){
  const paragraph=schema.node('paragraph',null,schema.text('본문 설명'));
  const code=schema.node('pebbleCode',null,schema.text('code'));
  let state=EditorState.create({schema,doc:schema.node('doc',null,reverse?[code,paragraph]:[paragraph,code]),plugins:[history()]});
  const original=state.doc,items=movableBlocks(state.doc),source=items.find(item=>item.node.type.name==='pebbleCode'),target=items.find(item=>item.node.type.name==='paragraph');
  const tr=placeBodyBlockBeside(state.tr,source.pos,target.pos,side);assert.ok(tr);state=state.apply(tr);
  assert.equal(state.doc.childCount,1);assert.equal(state.doc.firstChild.attrs.ratio,'1:1');
  assert.equal(state.doc.firstChild.child(side==='left'?0:1).firstChild.type.name,'pebbleCode');
  assert.equal(state.doc.textContent,side==='left'?'code본문 설명':'본문 설명code');
  assert.equal(undo(state,tr=>state=state.apply(tr)),true);assert.ok(state.doc.eq(original));
  assert.equal(redo(state,tr=>state=state.apply(tr)),true);state.doc.check();
 }
 const rect={left:100,right:900,top:100,bottom:140};
 assert.equal(sideOfBlockDrop(110,120,rect),'left');assert.equal(sideOfBlockDrop(890,120,rect),'right');
 assert.equal(sideOfBlockDrop(500,120,rect),null);assert.equal(sideOfBlockDrop(110,101,rect),null);assert.equal(sideOfBlockDrop(60,120,rect),null);
});
test('side placement moves the last column child out safely and rejects self/ancestor nesting',async()=>{
 const {placeBodyBlockBeside}=await import('../src/features/post/block-move.ts');
 const code=schema.node('pebbleCode',null,schema.text('nested'));
 const row=schema.node('imageTextLayout',null,[schema.node('imageTextColumn',null,[code]),schema.node('imageTextColumn',null,[schema.node('paragraph')])]);
 const state=EditorState.create({schema,doc:schema.node('doc',null,[row,schema.node('paragraph',null,schema.text('target'))])});
 const items=movableBlocks(state.doc),source=items.find(item=>item.node.type.name==='pebbleCode'),target=items.at(-1);
 const tr=placeBodyBlockBeside(state.tr,source.pos,target.pos,'right');assert.ok(tr);tr.doc.check();
 assert.equal(tr.doc.firstChild.firstChild.firstChild.type.name,'paragraph');
 assert.equal(placeBodyBlockBeside(state.tr,0,source.pos,'left'),null);
 assert.equal(placeBodyBlockBeside(state.tr,source.pos,source.pos,'left'),null);
});

test('custom column widths round-trip through safe HTML and Markdown, with bounded geometry',async()=>{
 const {safeColumnRatio,columnRatioParts,ratioAtPointer,ratioFromPercent}=await import('../src/features/post/column-ratio.ts');
 assert.equal(ratioAtPointer(312,0,624),'50:50');assert.equal(ratioAtPointer(-100,0,624),'20:80');assert.equal(ratioAtPointer(900,0,624),'80:20');
 assert.equal(ratioFromPercent(NaN),'50:50');assert.equal(safeColumnRatio('1:2'),'1:2');
 for(const bad of ['0:100','19:81','99:1','40:40','40:60;evil','calc(50%)'])assert.equal(columnRatioParts(bad),null);
 const raw='<div class="post-columns" data-ratio="37:63"><div class="post-column"><p>왼쪽</p></div><div class="post-column"><p>오른쪽</p></div></div>';
 const safe=richContentHtml(raw,'HTML');assert.match(safe,/data-ratio="37:63"/);assert.match(safe,/--column-left:37fr/);assert.match(safe,/--column-right:63fr/);
 const restored=richContentHtml(htmlToMarkdown(safe),'MARKDOWN');assert.match(restored,/data-ratio="37:63"/);assert.match(restored,/--column-left:37fr/);
 assert.doesNotMatch(richContentHtml(raw.replace('37:63','evil'),'HTML'),/data-ratio/);
});

test('unwrap a saved layout keeps all blocks and code in reading order, and undo/redo restores its ratio',async()=>{
 const {unwrapColumnLayout}=await import('../src/features/post/column-layout.ts');
 const p=value=>schema.node('paragraph',null,value?schema.text(value):null);
 const code=schema.node('pebbleCode',null,schema.text('keep code'));
 const row=schema.node('imageTextLayout',{ratio:'37:63'},[schema.node('imageTextColumn',null,[p('left'),p(''),code]),schema.node('imageTextColumn',null,[p('right')])]);
 let state=EditorState.create({schema,doc:schema.node('doc',null,[row]),plugins:[history()]});
 const original=state.doc;state=state.apply(unwrapColumnLayout(state.tr,0));
 assert.deepEqual(state.doc.content.toJSON(),[p('left'),p(''),code,p('right')].map(node=>node.toJSON()));state.doc.check();
 assert.equal(undo(state,tr=>state=state.apply(tr)),true);assert.ok(state.doc.eq(original));
 assert.equal(redo(state,tr=>state=state.apply(tr)),true);assert.equal(state.doc.childCount,4);
 assert.equal(unwrapColumnLayout(state.tr,0),null);assert.equal(unwrapColumnLayout(state.tr,-1),null);
});
test('unwrapping empty columns leaves a valid writable paragraph and skips only empty column placeholders',async()=>{
 const {unwrapColumnLayout}=await import('../src/features/post/column-layout.ts');
 const empty=schema.nodeFromJSON(newImageTextLayout());
 let state=EditorState.create({schema,doc:schema.node('doc',null,[empty])});
 const tr=unwrapColumnLayout(state.tr,0);tr.doc.check();assert.equal(tr.doc.childCount,1);assert.equal(tr.doc.firstChild.type.name,'paragraph');
 const row=schema.node('imageTextLayout',null,[empty.firstChild,schema.node('imageTextColumn',null,[schema.node('pebbleCode',null,schema.text('only'))])]);
 state=EditorState.create({schema,doc:schema.node('doc',null,[row])});assert.equal(unwrapColumnLayout(state.tr,0).doc.childCount,1);
});

test('Delete of a selected layout unwraps content; ordinary text selection does not change',async()=>{
 const {NodeSelection}=await import('@tiptap/pm/state');
 const {unwrapSelectedColumnLayout}=await import('../src/features/post/column-layout.ts');
 const row=schema.node('imageTextLayout',null,[schema.node('imageTextColumn',null,[schema.node('paragraph',null,schema.text('left'))]),schema.node('imageTextColumn',null,[schema.node('pebbleCode',null,schema.text('right'))])]);
 let state=EditorState.create({schema,doc:schema.node('doc',null,[row]),plugins:[history()]});
 assert.equal(unwrapSelectedColumnLayout(state),false);
 state=state.apply(state.tr.setSelection(NodeSelection.create(state.doc,0)));
 assert.equal(unwrapSelectedColumnLayout(state,tr=>state=state.apply(tr)),true);assert.equal(state.doc.textContent,'leftright');assert.equal(state.doc.firstChild.type.name,'paragraph');
 assert.equal(undo(state,tr=>state=state.apply(tr)),true);assert.equal(state.doc.firstChild.type.name,'imageTextLayout');
});
test('creating columns starts a separate undo step from immediately preceding typing',async()=>{
 const {placeBodyBlockBeside}=await import('../src/features/post/block-move.ts');
 let state=EditorState.create({schema,doc:schema.node('doc',null,[schema.node('paragraph',null,schema.text('text')),schema.node('pebbleCode',null,schema.text('code'))]),plugins:[history()]});
 state=state.apply(state.tr.insertText('!',5));const typed=state.doc,code=movableBlocks(state.doc).find(item=>item.node.type.name==='pebbleCode');
 state=state.apply(placeBodyBlockBeside(state.tr,code.pos,0,'right'));
 assert.equal(undo(state,tr=>state=state.apply(tr)),true);assert.ok(state.doc.eq(typed));
 assert.equal(undo(state,tr=>state=state.apply(tr)),true);assert.equal(state.doc.firstChild.textContent,'text');
});

test('unwrapping nested columns preserves image attributes and the surrounding block',async()=>{
 const {unwrapColumnLayout}=await import('../src/features/post/column-layout.ts');
 const nested=getSchema([ImageTextLayout,ImageTextColumn,Node.create({name:'doc',topNode:true,content:'block+'}),Node.create({name:'paragraph',group:'block',content:'text*'}),Node.create({name:'text',group:'inline'}),Node.create({name:'textPanel',group:'block',content:'block+',addAttributes:()=>({title:{default:'keep title'}})}),Node.create({name:'image',group:'block',atom:true,addAttributes:()=>({src:{default:null},width:{default:null},alt:{default:null}})})]);
 const image=nested.node('image',{src:'https://example.test/edited.png',width:240,alt:'보존할 사진'}),text=nested.node('paragraph',null,nested.text('설명'));
 const row=nested.node('imageTextLayout',{ratio:'64:36'},[nested.node('imageTextColumn',null,[image]),nested.node('imageTextColumn',null,[text])]);
 const state=EditorState.create({schema:nested,doc:nested.node('doc',null,[nested.node('textPanel',{title:'keep title'},[row])])});
 const tr=unwrapColumnLayout(state.tr,1);tr.doc.check();assert.equal(tr.doc.firstChild.attrs.title,'keep title');assert.ok(tr.doc.firstChild.firstChild.eq(image));assert.ok(tr.doc.firstChild.lastChild.eq(text));
});
