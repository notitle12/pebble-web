import test from 'node:test';
import assert from 'node:assert/strict';
import {diagramZoomScroll, diagramFitScale} from '../src/features/post/diagram-viewport.ts';

test('zoom keeps the same diagram point under the cursor when the padded canvas opens', () => {
  const before = {scroll: 100, anchor: 250, scale: .5, padding: 0};
  const afterScale = .8;
  const nextPadding = 48;
  const nextScroll = diagramZoomScroll(before.scroll, before.anchor, afterScale / before.scale, before.padding, nextPadding);
  assert.equal((before.scroll + before.anchor - before.padding) / before.scale,
    (nextScroll + before.anchor - nextPadding) / afterScale);
});

test('zoom keeps the canvas center stable with existing padding and clamps to the scroll origin', () => {
  assert.equal(diagramZoomScroll(200, 300, 2, 48), 652);
  assert.equal(diagramZoomScroll(0, 300, .5, 48), 0);
  assert.equal(diagramZoomScroll(200, 300, 2), 700);
});

test('expanded diagram fit includes both unscaled gutters without overflowing the viewport', () => {
  const scale = diagramFitScale(1200, 800, 900, 600, 48);
  assert.ok(1200 * scale + 96 <= 900);
  assert.ok(800 * scale + 96 <= 600);
  assert.equal(diagramFitScale(1200, 800, 900, 420), .525);
  assert.equal(diagramFitScale(100, 100, 900, 600, 48), 1);
});
