import test from 'node:test';
import assert from 'node:assert/strict';
import {getSchema,Node} from '@tiptap/core';
import {EditorState,TextSelection} from '@tiptap/pm/state';
import {history,undo} from '@tiptap/pm/history';
import {RichTextStarterKit} from '../src/features/post/rich-text-starter-kit.ts';
import {CodeClipboard} from '../src/features/post/code-clipboard.ts';
const schema=getSchema([RichTextStarterKit.configure({codeBlock:false}),Node.create({name:'pebbleCode',group:'block',content:'text*',code:true})]);
const props=CodeClipboard.config.addProseMirrorPlugins.call({})[0].props;
function fixture(code=true) {
 const doc=schema.node('doc',null,[schema.node(code?'pebbleCode':'paragraph',null,schema.text('a < b\n\n한글')),schema.node('paragraph',null,schema.text('after'))]);
 let state=EditorState.create({schema,doc,selection:TextSelection.create(doc,1,doc.firstChild.nodeSize-1),plugins:[history()]});
 const view={editable:true,get state(){return state},dispatch(tr){state=state.apply(tr)}};
 return view;
}
function clipboard(values={}) {
 const data=new Map(Object.entries(values));let prevented=false;
 return {data,clipboardData:{getData:type=>data.get(type)||'',setData:(type,value)=>data.set(type,value),clearData:()=>data.clear()},preventDefault(){prevented=true},get prevented(){return prevented}};
}
test('copying code exports plain paragraphs and escaped text while preserving the source',()=>{
 const view=fixture(),before=view.state.doc,event=clipboard();
 assert.equal(props.handleDOMEvents.copy(view,event),true);
 assert.equal(event.data.get('text/plain'),'a < b\n\n한글');
 assert.equal(event.data.get('text/html'),'<p>a &lt; b<br><br>한글</p>');
 assert.equal(event.prevented,true);assert.ok(view.state.doc.eq(before));
});
test('cutting code is undoable and cannot remove content if clipboard write fails',()=>{
 const view=fixture(),before=view.state.doc;
 assert.equal(props.handleDOMEvents.cut(view,clipboard()),true);
 assert.equal(view.state.doc.firstChild.textContent,'');assert.equal(view.state.doc.lastChild.textContent,'after');
 assert.equal(undo(view.state,view.dispatch),true);assert.ok(view.state.doc.eq(before));
 const failed=clipboard();failed.clipboardData.setData=()=>{throw new Error('clipboard denied')};
 assert.equal(props.handleDOMEvents.cut(view,failed),false);assert.ok(view.state.doc.eq(before));
});
test('code pasted into prose becomes ordinary paragraphs, retains blank lines, and is undoable',()=>{
 for(const values of [{'application/x-pebble-code':'1'},{'text/html':'<pre><code>rich code</code></pre>'}]) {
  const view=fixture(false),before=view.state.doc;
  const event=clipboard({...values,'text/plain':'<root/>\r\n\r\n  끝'});
  assert.equal(props.handlePaste(view,event),true);
  assert.deepEqual(view.state.doc.content.content.map(n=>[n.type.name,n.textContent]),[['paragraph','<root/>'],['paragraph',''],['paragraph','  끝'],['paragraph','after']]);
  assert.equal(undo(view.state,view.dispatch),true);assert.ok(view.state.doc.eq(before));
 }
});
test('ordinary rich copy/paste and paste into code keep their existing handlers',()=>{
 const prose=fixture(false),code=fixture(),event=clipboard({'text/plain':'text','text/html':'<strong>rich</strong>'});
 assert.equal(props.handleDOMEvents.copy(prose,event),false);
 assert.equal(props.handlePaste(prose,event),false);
 event.data.set('application/x-pebble-code','1');assert.equal(props.handlePaste(code,event),false);
 code.editable=false;assert.equal(props.handleDOMEvents.cut(code,event),false);
 prose.editable=false;assert.equal(props.handlePaste(prose,event),false);
});
