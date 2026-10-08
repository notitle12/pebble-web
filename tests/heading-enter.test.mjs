import test from 'node:test';
import assert from 'node:assert/strict';
import {Schema} from '@tiptap/pm/model';
import {EditorState,TextSelection} from '@tiptap/pm/state';
import {headingEnterTransaction} from '../src/features/post/heading-enter.ts';
const schema=new Schema({nodes:{doc:{content:'block+'},paragraph:{group:'block',content:'text*',attrs:{fontSize:{default:null},id:{default:null}}},heading:{group:'block',content:'text*'},bulletList:{group:'block',content:'listItem+'},listItem:{content:'paragraph block*'},blockquote:{group:'block',content:'block+'},tableSpec:{group:'block',atom:true},text:{group:'inline'}}});
const h=()=>schema.node('heading',null,schema.text('제목'));
const p=text=>schema.node('paragraph',null,text?schema.text(text):undefined);
const list=schema.node('bulletList',null,schema.node('listItem',null,p('목록')));
for(const next of [list,schema.node('tableSpec'),p('뒤 본문'),null,p('')]){
 test('heading Enter preserves '+(next?.type.name??'document end'),()=>{
  const doc=schema.node('doc',null,[h(),...(next?[next]:[])]);
  const state=EditorState.create({schema,doc,selection:TextSelection.create(doc,1+2)});
  const tr=headingEnterTransaction(state);tr.doc.check();
  assert.equal(tr.doc.child(0).type.name,'heading');assert.equal(tr.doc.child(1).type.name,'paragraph');
  assert.equal(tr.doc.child(1).textContent,'');assert.equal(tr.doc.child(1).attrs.fontSize,'16px');
  assert.equal(tr.doc.childCount,next && next.textContent!=='' || next?.type.name!=='paragraph' && next ?3:2);
  if(next && !(next.type.name==='paragraph' && !next.content.size))assert.ok(tr.doc.child(2).eq(next));
  assert.equal(tr.selection.$from.parent.type.name,'paragraph');
 });
}
test('nested heading Enter keeps the quote and ignores a mid-heading cursor',()=>{
 const doc=schema.node('doc',null,schema.node('blockquote',null,[h(),list]));
 const state=EditorState.create({schema,doc,selection:TextSelection.create(doc,4)});
 const tr=headingEnterTransaction(state);tr.doc.check();assert.equal(tr.doc.firstChild.child(1).type.name,'paragraph');assert.ok(tr.doc.firstChild.lastChild.eq(list));
 const middle=EditorState.create({schema,doc,selection:TextSelection.create(doc,3)});assert.equal(headingEnterTransaction(middle),null);
});
