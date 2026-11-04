import assert from "node:assert/strict";
import { test } from "node:test";
import { clampCropRect, createMosaicOperation, safeBitmapSize } from "../src/features/post/image-edit-model.ts";

test("bitmap dimensions follow the API edge and pixel limits", () => {
  assert.equal(safeBitmapSize(8000, 2500), true);
  assert.equal(safeBitmapSize(5000, 5000), false);
  assert.equal(safeBitmapSize(8001, 1), false);
});

test("mosaic operations retain bounded pixel block sizes", () => {
  const rect = clampCropRect(1, 1, 50, 30, { width: 100, height: 80 });
  assert.deepEqual(createMosaicOperation(rect, 18), { type: "mosaic", x: 1, y: 1, width: 49, height: 29, blockSize: 18 });
  assert.equal(createMosaicOperation(rect, 100).blockSize, 48);
  assert.equal(createMosaicOperation(rect, 0).blockSize, 4);
});

test("crop geometry is normalized and clamped to bitmap pixels", () => {
  assert.deepEqual(clampCropRect(90, 70, 10, 20, { width: 100, height: 80 }), { type: "crop", x: 10, y: 20, width: 80, height: 50 });
  assert.deepEqual(clampCropRect(-10, 10, 40, 100, { width: 100, height: 80 }), { type: "crop", x: 0, y: 10, width: 40, height: 70 });
  assert.equal(clampCropRect(1, 1, 2, 2, { width: 100, height: 80 }), null);
});
