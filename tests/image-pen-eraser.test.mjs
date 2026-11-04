import test from 'node:test';
import assert from 'node:assert/strict';
import {eraseImagePen} from '../src/features/post/image-pen-eraser.ts';
import {emptyImageHistory,commitImageEdit,undoImageEdit,redoImageEdit} from '../src/features/post/image-edit-history.ts';
const pen={type:'pen',width:4,color:'#ff0000',points:[{x:0,y:20},{x:100,y:20}]};
const text={type:'text',text:'keep',x:20,y:20,fontSize:20,color:'#000000'};
const mosaic={type:'mosaic',x:0,y:0,width:100,height:40,blockSize:12};
test('eraser masks crossing pen segments without altering image crops, text or mosaics; undo restores ink',()=>{
 const operations=[pen,text,mosaic];
 const erased=eraseImagePen(operations,[{x:50,y:0},{x:50,y:40}],10);
 assert.equal(erased[1],text);assert.equal(erased[2],mosaic);
 assert.deepEqual(erased[0].erasures,[{points:[{x:50,y:0},{x:50,y:40}],width:10}]);
 assert.equal(pen.erasures,undefined);
 let history=commitImageEdit(emptyImageHistory(),operations);history=commitImageEdit(history,erased);
 assert.deepEqual(undoImageEdit(history).present,operations);
 assert.deepEqual(redoImageEdit(undoImageEdit(history)).present,erased);
});
test('eraser follows earlier pen strokes through crops, including a single-point dab',()=>{
 const crop={type:'crop',x:20,y:10,width:60,height:40};
 const erased=eraseImagePen([pen,crop],[{x:30,y:10}],8);
 assert.deepEqual(erased[0].erasures,[{points:[{x:50,y:20}],width:8}]);assert.equal(erased[1],crop);
});
test('eraser outside pen strokes or with invalid coordinates leaves history unchanged',()=>{
 const operations=[pen,text,mosaic];
 assert.equal(eraseImagePen(operations,[{x:50,y:100}],8),operations);
 assert.equal(eraseImagePen(operations,[],8),operations);
 assert.equal(eraseImagePen(operations,[{x:NaN,y:20}],8),operations);
});

test('clear all removes every pen stroke and its erasures as one reversible edit, preserving other tools',async()=>{
 const {clearImagePen}=await import('../src/features/post/image-edit-history.ts');
 const commands=[pen,text,{...pen,erasures:[{points:[{x:30,y:20}],width:8}]},mosaic];
 let history=commitImageEdit(emptyImageHistory(),commands);
 history=commitImageEdit(history,clearImagePen(commands));
 assert.deepEqual(history.present,[text,mosaic]);assert.deepEqual(undoImageEdit(history).present,commands);
 assert.deepEqual(redoImageEdit(undoImageEdit(history)).present,[text,mosaic]);
 assert.equal(clearImagePen(history.present),history.present);
});
