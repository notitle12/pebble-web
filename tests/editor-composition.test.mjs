import test from 'node:test';
import assert from 'node:assert/strict';
import { installEditorCompositionBoundary } from '../src/features/post/editor-composition.ts';

function fixture() {
  const owner = new EventTarget(), doc = new EventTarget(), dom = new EventTarget();
  doc.defaultView = owner; doc.hidden = false; dom.ownerDocument = doc; dom.textContent = '한글 조합';
  let blurs = 0, commits = 0, ends = 0;
  const view = {dom, composing:true, isDestroyed:false};
  // Model ProseMirror's compositionend handler; the boundary must route through it.
  dom.addEventListener('compositionend', () => { ends++; view.composing = false; });
  dom.blur = () => { blurs++; dom.dispatchEvent(new Event('blur')); };
  const dispose = installEditorCompositionBoundary(view, () => commits++);
  return {owner, doc, dom, view, dispose, counts:()=>({blurs,commits,ends})};
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
