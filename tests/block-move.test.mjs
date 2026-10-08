import test from 'node:test';
import assert from 'node:assert/strict';
import {Schema} from '@tiptap/pm/model';
import {EditorState} from '@tiptap/pm/state';
import {history,undo,redo} from '@tiptap/pm/history';
import {moveBodyBlock} from '../src/features/post/block-move.ts';
const schema=new Schema({nodes:{doc:{content:'block+'},paragraph:{content:'text*',group:'block'},heading:{content:'text*',group:'block',attrs:{level:{default:1}}},tableSpec:{group:'block',atom:true,attrs:{spec:{default:null}}},text:{group:'inline'}}});
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
