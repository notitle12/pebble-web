import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyImageHistory,commitImageEdit,undoImageEdit,redoImageEdit,replaceImageText} from '../src/features/post/image-edit-history.ts';
import {createTextOperation,placedImageTexts} from '../src/features/post/image-edit-model.ts';
const text={type:'text',id:'a',text:'처음 글씨',x:20,y:30,fontSize:20,color:'#000000',maxWidth:120};
test('text creation, re-edit and deletion each undo and redo without changing raster commands',()=>{
 const pen={type:'pen',color:'#fff',width:2,points:[{x:1,y:2}]};
 let history=commitImageEdit(emptyImageHistory(),[pen,text]);
 const original=history;
 history=commitImageEdit(history,replaceImageText(history.present,'a',{...text,text:'수정 글씨'}));
 assert.equal(history.present[1].text,'수정 글씨');assert.equal(history.present[0],pen);
 history=undoImageEdit(history);assert.deepEqual(history.present,original.present);
 history=redoImageEdit(history);assert.equal(history.present[1].text,'수정 글씨');
 history=commitImageEdit(history,replaceImageText(history.present,'a',null));assert.deepEqual(history.present,[pen]);
 history=undoImageEdit(history);assert.equal(history.present[1].text,'수정 글씨');
 history=redoImageEdit(history);assert.deepEqual(history.present,[pen]);
 assert.equal(original.present[1].text,'처음 글씨');
});
test('empty new text does not create an undo frame and editing after undo drops stale redo',()=>{
 const empty=emptyImageHistory();assert.equal(commitImageEdit(empty,replaceImageText([],null,null)),empty);
 let history=commitImageEdit(empty,[text]);history=undoImageEdit(history);
 history=commitImageEdit(history,[{...text,id:'b',text:'다른 글씨'}]);
 assert.equal(history.future.length,0);assert.equal(redoImageEdit(history),history);
 assert.equal(replaceImageText(history.present,'missing',text),history.present);
});
test('text selection coordinates track later crops and discard fully cropped-out text targets',()=>{
 const crop={type:'crop',x:10,y:15,width:150,height:100};
 const visible=placedImageTexts([text,crop],{width:300,height:200},(value,font)=>value.length*font/2);
 assert.equal(visible[0].x,10);assert.equal(visible[0].y,15);assert.equal(visible[0].offsetX,10);assert.equal(visible[0].offsetY,15);
 assert.deepEqual(visible[0].sourceSize,{width:300,height:200});
 assert.deepEqual(placedImageTexts([{...text,x:250},crop],{width:300,height:200},()=>10),[]);
});

test('reopening text reads ImageBitmap dimensions through their non-enumerable getters',()=>{
 const bitmap=Object.create(null,{width:{get:()=>1591},height:{get:()=>925}});
 const [region]=placedImageTexts([text],bitmap,(value,font)=>value.length*font/2);
 assert.deepEqual(region.sourceSize,{width:1591,height:925});
 const edited=createTextOperation('수정 후 유지',region.operation.x,region.operation.y,region.sourceSize,20,'#000000',region.width);
 assert.ok(Number.isFinite(edited.x));assert.ok(Number.isFinite(edited.y));
 assert.equal(edited.text,'수정 후 유지');
 assert.equal(createTextOperation('손상 데이터',0,0,{},20,'#000000'),null);
});
