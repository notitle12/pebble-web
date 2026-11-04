import test from 'node:test';
import assert from 'node:assert/strict';
import {Schema} from '@tiptap/pm/model';
import {EditorState} from '@tiptap/pm/state';
import {history,undo,redo} from '@tiptap/pm/history';
import {blockGapContext,moveBodyBlock} from '../src/features/post/block-move.ts';
const schema=new Schema({nodes:{doc:{content:'block+'},paragraph:{content:'text*',group:'block'},heading:{content:'text*',group:'block',attrs:{level:{default:1}}},textPanel:{content:'block+',group:'block'},details:{content:'block+',group:'block'},pebbleCode:{content:'text*',group:'block',code:true},tableSpec:{group:'block',atom:true,attrs:{spec:{default:null}}},text:{group:'inline'}}});
const p=text=>schema.node('paragraph',null,text?schema.text(text):undefined);
const spec={tableName:'users',columns:[{name:'id',description:'테스트'}]};
const doc=schema.node('doc',null,[p('앞'),schema.node('tableSpec',{spec}),schema.node('heading',{level:2},schema.text('제목')),p('뒤')]);
const positions=[];doc.forEach((node,pos)=>positions.push(pos));
test('move structured block preserves spec and ordered body, with undo/redo',()=>{
 let state=EditorState.create({schema,doc,plugins:[history()]});
 state=state.apply(moveBodyBlock(state.tr,positions[1],doc.content.size));
 assert.deepEqual(state.doc.content.content.map(n=>n.type.name),['paragraph','heading','paragraph','tableSpec']);
 assert.deepEqual(state.doc.lastChild.attrs.spec,spec);
 assert.equal(undo(state,tr=>{state=state.apply(tr)}),true);assert.ok(state.doc.eq(doc));
 assert.equal(redo(state,tr=>{state=state.apply(tr)}),true);assert.equal(state.doc.lastChild.type.name,'tableSpec');
});
test('moving first/last blocks uses gap coordinates and rejects nested/unchanged gaps',()=>{
 const state=EditorState.create({schema,doc});
 const moved=moveBodyBlock(state.tr,positions[3],0);assert.equal(moved.doc.firstChild.textContent,'뒤');
 assert.equal(moveBodyBlock(state.tr,positions[1],positions[1]),null);
 assert.equal(moveBodyBlock(state.tr,positions[1],positions[2]),null);
 assert.equal(moveBodyBlock(state.tr,1,positions[3]),null);
 assert.equal(moveBodyBlock(state.tr,positions[0],1),null);
});

test('반복해서 맨 아래로 옮겨도 마지막 빈 입력 문단을 재사용한다',()=>{
 const initial=schema.node('doc',null,[p('앞'),schema.node('tableSpec',{spec}),p()]);
 let state=EditorState.create({schema,doc:initial});
 for(let i=0;i<5;i++){
  const tr=moveBodyBlock(state.tr,3,state.doc.content.size);if(tr)state=state.apply(tr);
  assert.equal(state.doc.childCount,3);assert.equal(state.doc.lastChild.type.name,'paragraph');assert.equal(state.doc.lastChild.content.size,0);
 }
 assert.ok(state.doc.eq(initial));
 const another=schema.node('doc',null,[schema.node('tableSpec',{spec}),p('뒤'),p()]);
 state=EditorState.create({schema,doc:another});state=state.apply(moveBodyBlock(state.tr,0,state.doc.content.size));
 assert.deepEqual(state.doc.content.content.map(node=>node.type.name),['paragraph','tableSpec','paragraph']);
});

const named=(type,content)=>schema.node(type,null,content);
const find=(doc,type,text)=>{
 let found=null;doc.descendants((node,pos)=>{if(!found&&node.type.name===type&&(!text||node.textContent===text))found=pos;});return found;
};
const children=(doc,pos)=>doc.nodeAt(pos).content.content.map(node=>node.type.name);
test('표와 코드를 textPanel과 details 사이에서 이동하고 재배치한다',()=>{
 const table=named('tableSpec',[ ]);
 const code=schema.node('pebbleCode',null,schema.text('const x = 1'));
 let doc=schema.node('doc',null,[p('앞'),named('textPanel',[p('패널'),code]),named('details',[p('접기')]),table,p('뒤')]);
 let state=EditorState.create({schema,doc,plugins:[history()]});
 let source=find(state.doc,'tableSpec'),panel=find(state.doc,'textPanel');
 state=state.apply(moveBodyBlock(state.tr,source,panel+state.doc.nodeAt(panel).nodeSize-1));
 panel=find(state.doc,'textPanel');
 assert.deepEqual(children(state.doc,panel).slice(-1),['tableSpec']);
 source=find(state.doc,'pebbleCode');let details=find(state.doc,'details');
 state=state.apply(moveBodyBlock(state.tr,source,details+state.doc.nodeAt(details).nodeSize-1));
 details=find(state.doc,'details');
 assert.deepEqual(children(state.doc,details),['paragraph','pebbleCode']);
 source=find(state.doc,'tableSpec');details=find(state.doc,'details');
 state=state.apply(moveBodyBlock(state.tr,source,details+1));
 details=find(state.doc,'details');
 assert.deepEqual(children(state.doc,details),['tableSpec','paragraph','pebbleCode']);
 assert.equal(find(state.doc,'pebbleCode')!==null,true);
});

test('only-child donor gets an empty paragraph; nested reorder supports undo and redo',()=>{
 const table=named('tableSpec',[]),panel=named('textPanel',[table]);
 const code=schema.node('pebbleCode',null,schema.text('x'));
 const details=named('details',[p('one'),code,p('three')]);
 const original=schema.node('doc',null,[panel,details,p('tail')]);
 let state=EditorState.create({schema,doc:original,plugins:[history()]});
 const source=find(state.doc,'tableSpec');
 state=state.apply(moveBodyBlock(state.tr,source,state.doc.content.size));
 const movedPanel=find(state.doc,'textPanel');
 assert.deepEqual(children(state.doc,movedPanel),['paragraph']);
 const codePos=find(state.doc,'pebbleCode');
 const detailPos=find(state.doc,'details');
 state=state.apply(moveBodyBlock(state.tr,codePos,detailPos+1));
 assert.deepEqual(children(state.doc,detailPos),['pebbleCode','paragraph','paragraph']);
 assert.equal(undo(state,tr=>{state=state.apply(tr)}),true);
 assert.deepEqual(children(state.doc,find(state.doc,'details')),['paragraph','pebbleCode','paragraph']);
 assert.equal(redo(state,tr=>{state=state.apply(tr)}),true);
 assert.deepEqual(children(state.doc,find(state.doc,'details')),['pebbleCode','paragraph','paragraph']);
});

test('rejects invalid table-internal gaps and self/descendant drops',()=>{
 const panel=named('textPanel',[p('inside')]),details=named('details',[p('fold')]);
 const doc=schema.node('doc',null,[panel,details,p('tail')]);
 const state=EditorState.create({schema,doc});
 const panelPos=find(doc,'textPanel'),childPos=panelPos+1;
 assert.equal(moveBodyBlock(state.tr,childPos,childPos+1),null);
 assert.equal(moveBodyBlock(state.tr,panelPos,childPos),null);
 assert.equal(moveBodyBlock(state.tr,panelPos,childPos+1),null);
 assert.equal(moveBodyBlock(state.tr,find(doc,'paragraph','tail'),childPos+2),null);
 for(const gap of [-1,doc.content.size+1,NaN,1.5])assert.equal(moveBodyBlock(state.tr,find(doc,'paragraph','tail'),gap),null);
 assert.equal(blockGapContext(doc,childPos)?.parentType,'textPanel');
});
