import assert from "node:assert/strict";
import { test } from "node:test";
import { imageCornerWidthDelta, normalizeImageDisplaySize, resizedImageDimensions } from "../src/features/post/image-display-size.ts";

test("persisted image dimensions accept bounded integer sizes and clear malformed pairs", () => {
  assert.deepEqual(normalizeImageDisplaySize("640", "480"), { width: 640, height: 480 });
  for (const pair of [[0, 300], [1601, 900], [640, "auto"], ["1e3", 800], [640, 16001]]) {
    assert.deepEqual(normalizeImageDisplaySize(...pair), { width: null, height: null });
  }
});

test("resizing clamps width while preserving aspect ratio", () => {
  assert.deepEqual(resizedImageDimensions(300, 16 / 9), { width: 300, height: 169 });
  assert.deepEqual(resizedImageDimensions(2000, 4 / 3), { width: 1600, height: 1200 });
  assert.deepEqual(resizedImageDimensions(20, 1, 500), { width: 80, height: 80 });
  assert.deepEqual(resizedImageDimensions(300, 1 / 200), { width: 80, height: 16000 });
  assert.deepEqual(resizedImageDimensions(NaN, 1), { width: 80, height: 80 });
});

for (const [corner, x, y] of [["top-left",-1,-1],["top-right",1,-1],["bottom-left",-1,1],["bottom-right",1,1]]) {
  test(`${corner} resizes along both axes without reversing inward/outward movement`, () => {
    assert.equal(imageCornerWidthDelta(60*x, 30*y, 2, corner), 60);
    assert.equal(imageCornerWidthDelta(-60*x, -30*y, 2, corner), -60);
    assert.equal(imageCornerWidthDelta(0, 50*y, 1, corner), 25);
    assert.equal(imageCornerWidthDelta(0, 0, 2, corner), 0);
  });
}
