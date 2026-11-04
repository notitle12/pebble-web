import test from 'node:test';
import assert from 'node:assert/strict';
import { installEditorCompositionBoundary } from '../src/features/post/editor-composition.ts';

function fixture() {
  const owner = new EventTarget(), doc = new EventTarget(), dom = new EventTarget();
  doc.defaultView = owner; doc.hidden = false; dom.ownerDocument = doc; dom.textContent = '한글 조합';
  let blurs = 0, commits = 0, ends = 0;
  const pasted = [];
  const parent = {type:{spec:{code:true}}};
  const view = {dom, composing:true, isDestroyed:false, hasFocus:()=>true,
    state:{selection:{$from:{parent,sameParent:()=>true},$to:{}}},
    pasteText(text){pasted.push(text);dom.textContent+=text;return true;}};
  // Model ProseMirror's compositionend handler; the boundary must route through it.
  dom.addEventListener('compositionend', () => { ends++; view.composing = false; });
  dom.blur = () => { blurs++; dom.dispatchEvent(new Event('blur')); };
  const dispose = installEditorCompositionBoundary(view, () => commits++);
  return {owner, doc, dom, view, pasted, dispose, counts:()=>({blurs,commits,ends})};
}
const tick = () => new Promise(resolve => setTimeout(resolve, 10));

test('switching windows ends a stranded composition without rewriting text or refocusing', async () => {
  const f = fixture(); f.owner.dispatchEvent(new Event('blur')); await tick();
  assert.equal(f.view.composing, false);
  assert.equal(f.dom.textContent, '한글 조합');
  assert.deepEqual(f.counts(), {blurs:1,commits:1,ends:1});
  f.owner.dispatchEvent(new Event('blur')); await tick();
  assert.deepEqual(f.counts(), {blurs:1,commits:1,ends:1}); f.dispose();
});
test('hidden pages and editor blur finish compositions; native completion publishes after DOM flush', async () => {
  const f = fixture(); f.doc.hidden = true; f.doc.dispatchEvent(new Event('visibilitychange')); await tick();
  assert.equal(f.counts().commits, 1);
  f.view.composing = true; f.dom.dispatchEvent(new Event('blur')); await tick();
  assert.equal(f.counts().commits, 2);
  f.view.composing = true; f.dom.dispatchEvent(new Event('compositionend'));
  assert.equal(f.counts().commits, 2); await tick();
  assert.equal(f.counts().commits, 3); f.dispose();
});
test('cleanup cancels pending publication and detaches window listeners', async () => {
  const f = fixture(); f.dom.dispatchEvent(new Event('compositionend')); f.dispose(); await tick();
  assert.equal(f.counts().commits, 0);
  f.view.composing = true; f.owner.dispatchEvent(new Event('blur'));
  assert.equal(f.view.composing, true);
});

function pasteText(f, text) {
 const event=new Event('paste',{bubbles:true,cancelable:true});
 Object.defineProperty(event,'clipboardData',{value:{getData:()=>text}});
 f.dom.dispatchEvent(event);return event;
}
test('code paste settles a stranded composition before inserting text, without requiring blur',async()=>{
 const f=fixture();
 // Model the DOM reconciliation ProseMirror queues at compositionend.
 f.dom.addEventListener('compositionend',()=>queueMicrotask(()=>{f.dom.textContent+=' 완료';}));
 assert.equal(pasteText(f,'\r\nconst n = 1;').defaultPrevented,true);
 assert.equal(f.view.composing,false);assert.deepEqual(f.pasted,[]);
 await tick();
 assert.deepEqual(f.pasted,['\nconst n = 1;']);
 assert.equal(f.dom.textContent,'한글 조합 완료\nconst n = 1;');
 assert.equal(f.counts().blurs,0);assert.equal(f.counts().ends,1);f.dispose();
});
test('rapid deferred code pastes keep their order and ordinary paste is untouched',async()=>{
 const f=fixture();pasteText(f,'first');pasteText(f,'second');await tick();
 assert.deepEqual(f.pasted,['first','second']);
 assert.equal(pasteText(f,'native').defaultPrevented,false);f.dispose();
 const outside=fixture();outside.view.state.selection.$from.parent.type.spec.code=false;
 assert.equal(pasteText(outside,'body').defaultPrevented,false);
 assert.equal(outside.view.composing,true);assert.deepEqual(outside.pasted,[]);outside.dispose();
});
test('delayed code paste cannot write after cleanup, focus loss or moving to a paragraph',async()=>{
 for(const condition of ['cleanup','blur','paragraph']) {
  const f=fixture();pasteText(f,'code');
  if(condition==='cleanup')f.dispose();
  if(condition==='blur')f.view.hasFocus=()=>false;
  if(condition==='paragraph')f.view.state.selection.$from.parent.type.spec.code=false;
  await tick();assert.deepEqual(f.pasted,[]);f.dispose();
 }
});
