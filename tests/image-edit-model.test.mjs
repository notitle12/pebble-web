import assert from "node:assert/strict";
import { test } from "node:test";
import { imageTextLines, adjustCrop, fullImageCrop, hasCropChanges, clampCropRect, createMosaicOperation, createPenOperation, createTextOperation, safeBitmapSize } from "../src/features/post/image-edit-model.ts";

test("bitmap dimensions follow the API edge and pixel limits", () => {
  assert.equal(safeBitmapSize(8000, 2500), true);
  assert.equal(safeBitmapSize(5000, 5000), false);
  assert.equal(safeBitmapSize(8001, 1), false);
});

test("pen operations store bounded source-pixel coordinates and a safe color", () => {
  assert.deepEqual(createPenOperation([{ x: -5, y: 100 }, { x: 20.4, y: 10.2 }], { width: 50, height: 60 }, 200, "#ABCDEF"), {
    type: "pen", points: [{ x: 0, y: 60 }, { x: 20, y: 10 }], width: 128, color: "#abcdef",
  });
  assert.equal(createPenOperation([], { width: 1, height: 1 }, 4, "#000000"), null);
});

test("text operation keeps safe plain text and bounded color, position and font size", () => {
  assert.deepEqual(createTextOperation("  Hello <img>  ", -5, 99, { width: 100, height: 80 }, 500, "not-a-color"), {
    type: "text", text: "Hello <img>", x: 0, y: 80, fontSize: 160, color: "#ffffff",
  });
  assert.equal(createTextOperation("  ", 0, 0, { width: 10, height: 10 }, 32, "#000000"), null);
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

test('crop handles start at the image perimeter and keep opposite edges within the bitmap',()=>{
 const size={width:100,height:80},full=fullImageCrop(size);
 assert.equal(hasCropChanges(full,size),false);
 const selected=adjustCrop(full,'nw',20,10,size);
 assert.deepEqual(selected,{type:'crop',x:20,y:10,width:80,height:70});
 assert.equal(hasCropChanges(selected,size),true);
 assert.deepEqual(adjustCrop(selected,'se',-200,-200,size),{type:'crop',x:20,y:10,width:2,height:2});
 assert.deepEqual(adjustCrop(selected,'move',-500,500,size),{...selected,x:0,y:10});
 assert.deepEqual(adjustCrop(selected,'e',500,0,size),selected);
 assert.equal(adjustCrop(selected,'n',NaN,1,size),selected);
});

test('placed text retains its box width, blank lines and whole graphemes without font compression',()=>{
 const operation=createTextOperation('가나다라\n\n마바',10,20,{width:100,height:100},24,'#123456',40);
 assert.equal(operation.maxWidth,40);
 assert.deepEqual(imageTextLines(operation.text,20,text=>Array.from(text).length*10),['가나','다라','','마바']);
 assert.deepEqual(imageTextLines('👩‍💻X',20,text=>Array.from(text).length*10),['👩‍💻','X']);
 assert.equal(createTextOperation('text',0,0,{width:100,height:100},24,'#123456',999).maxWidth,100);
});
