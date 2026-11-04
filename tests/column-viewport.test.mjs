import test from 'node:test';
import assert from 'node:assert/strict';
import {getSchema,Node} from '@tiptap/core';
import {EditorState,TextSelection} from '@tiptap/pm/state';
import {ImageTextLayout,ImageTextColumn} from '../src/features/post/image-text-columns.ts';
import {columnViewportKey,columnViewportPlugin} from '../src/features/post/column-viewport.ts';
import {columnAutoUnwrapPlugin} from '../src/features/post/column-auto-unwrap.ts';
import {placeBodyBlockBeside,movableBlocks} from '../src/features/post/block-move.ts';
import {unwrapColumnLayout} from '../src/features/post/column-layout.ts';
const schema=getSchema([ImageTextLayout,ImageTextColumn,Node.create({name:'doc',topNode:true,content:'block+'}),Node.create({name:'paragraph',group:'block',content:'text*'}),Node.create({name:'text',group:'inline'})]);
const p=text=>schema.node('paragraph',null,schema.text(text));
const makeState=doc=>EditorState.create({schema,doc,plugins:[columnViewportPlugin(),columnAutoUnwrapPlugin()]});
test('creating and explicitly unwrapping columns do not request scrolling to the mapped caret',()=>{
 let state=makeState(schema.node('doc',null,[p('first'),p('second')]));
 const second=movableBlocks(state.doc)[1];const create=placeBodyBlockBeside(state.tr,second.pos,0,'right');
 assert.equal(create.scrolledIntoView,false);state=state.apply(create);assert.equal(columnViewportKey.getState(state),true);
 const unwrap=unwrapColumnLayout(state.tr,0);assert.equal(unwrap.scrolledIntoView,false);state=state.apply(unwrap);assert.equal(columnViewportKey.getState(state),true);
 state=state.apply(state.tr.setSelection(TextSelection.create(state.doc,2)).scrollIntoView());assert.equal(columnViewportKey.getState(state),false);
});
test('automatic unwrap carries the no-scroll guard through appended transactions',()=>{
 let state=makeState(schema.node('doc',null,[schema.node('imageTextLayout',null,[schema.node('imageTextColumn',null,[p('left')]),schema.node('imageTextColumn',null,[p('right')])])]));
 const right=movableBlocks(state.doc).find(item=>item.node.textContent==='right'&&item.node.type.name==='paragraph');
 const result=state.applyTransaction(state.tr.delete(right.pos+1,right.end-1).scrollIntoView());
 assert.equal(result.state.doc.firstChild.type.name,'paragraph');assert.equal(columnViewportKey.getState(result.state),true);
 const plugin=result.state.plugins.find(plugin=>plugin.key===columnViewportKey.key);
 assert.equal(plugin.props.handleScrollToSelection({state:result.state}),true);
});
test('ordinary typing before a layout keeps normal caret scrolling enabled',()=>{
 const layout=schema.node('imageTextLayout',null,[schema.node('imageTextColumn',null,[p('left')]),schema.node('imageTextColumn',null,[p('right')])]);
 let state=makeState(schema.node('doc',null,[p('before'),layout]));
 state=state.apply(state.tr.insertText('more text',2).scrollIntoView());assert.equal(columnViewportKey.getState(state),false);
});

test('layout edits restore page and nested scroll offsets after DOM reflow; new scrolling cancels the deferred correction',()=>{
 class FakeWindow extends EventTarget {
  scrollX=0;scrollY=900;nextId=0;frames=new Map();
  scrollTo({left,top}){this.scrollX=left;this.scrollY=top;}
  requestAnimationFrame(callback){const id=++this.nextId;this.frames.set(id,callback);return id;}
  cancelAnimationFrame(id){this.frames.delete(id);}
  paint(){const frames=[...this.frames.values()];this.frames.clear();for(const frame of frames)frame();}
 }
 const win=new FakeWindow();
 const parent={parentElement:null,scrollTop:240,scrollLeft:12,scrollHeight:1000,clientHeight:400,scrollWidth:800,clientWidth:500,isConnected:true,scrollTo({left,top}){this.scrollLeft=left;this.scrollTop=top;}};
 const dom={ownerDocument:{defaultView:win,scrollingElement:null},parentElement:parent,getBoundingClientRect(){win.scrollY=400;parent.scrollTop=20;return {};}};
 let state=makeState(schema.node('doc',null,[p('first')]));const plugin=state.plugins.find(plugin=>plugin.key===columnViewportKey.key);
 const view={dom,state,isDestroyed:false},controller=plugin.spec.view(view);
 state=state.apply(state.tr.insertText('x',1).setMeta(columnViewportKey,true));view.state=state;controller.update(view);
 assert.equal(win.scrollY,900);assert.equal(parent.scrollTop,240);
 win.scrollY=400;parent.scrollTop=20;win.paint();assert.equal(win.scrollY,900);assert.equal(parent.scrollTop,240);
 state=state.apply(state.tr.insertText('y',1).setMeta(columnViewportKey,true));view.state=state;controller.update(view);
 win.dispatchEvent(new Event('wheel'));win.scrollY=1100;win.paint();assert.equal(win.scrollY,1100);
 controller.destroy();assert.equal(win.frames.size,0);
});
