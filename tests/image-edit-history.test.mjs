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

test('mosaic targets follow crops, re-edit in source pixels and retain undo/redo',async()=>{
 const {placedImageMosaics,replaceImageMosaic}=await import('../src/features/post/image-edit-model.ts');
 const mosaic={type:'mosaic',x:20,y:30,width:100,height:80,blockSize:12};
 const crop={type:'crop',x:40,y:20,width:150,height:100};
 const commands=[mosaic,crop,text];
 const [region]=placedImageMosaics(commands,{width:300,height:200});
 assert.deepEqual({x:region.x,y:region.y,width:region.width,height:region.height},{x:0,y:10,width:80,height:80});
 const rect={type:'crop',x:5,y:15,width:60,height:50};
 const edited=replaceImageMosaic(commands,0,rect,24,{x:region.offsetX,y:region.offsetY});
 assert.deepEqual(edited[0],{type:'mosaic',x:45,y:35,width:60,height:50,blockSize:24});
 assert.equal(edited[1],crop);assert.equal(edited[2],text);assert.equal(commands[0],mosaic);
 let history=commitImageEdit(emptyImageHistory(),commands);history=commitImageEdit(history,edited);
 assert.deepEqual(undoImageEdit(history).present,commands);
 assert.deepEqual(redoImageEdit(undoImageEdit(history)).present,edited);
 const deleted=replaceImageMosaic(edited,0,null,12);assert.deepEqual(deleted,[crop,text]);
 assert.equal(replaceImageMosaic(commands,2,rect,24),commands);
 assert.deepEqual(placedImageMosaics([mosaic,{...crop,x:200}],{width:300,height:200}),[]);
});

test('image text position and box dimensions stay editable after a crop and round-trip through undo',async()=>{
 const {resizeImageTextBox}=await import('../src/features/post/image-text-box.ts');
 const crop={type:'crop',x:20,y:30,width:400,height:300};
 const original={...text,x:80,y:90,maxWidth:140,boxHeight:60,autoSize:false};
 const source={width:600,height:400},commands=[original,crop];
 const [region]=placedImageTexts(commands,source,()=>40);
 assert.equal(region.height,60);
 const moved=resizeImageTextBox({x:region.x,y:region.y,width:region.width,height:region.height},'move',25,15,{width:400,height:300},20);
 const resized=resizeImageTextBox(moved,'se',40,30,{width:400,height:300},20);
 const operation={...createTextOperation(original.text,resized.x+region.offsetX,resized.y+region.offsetY,region.sourceSize,20,original.color,resized.width,resized.height),id:original.id,autoSize:false};
 let history=commitImageEdit(emptyImageHistory(),commands);history=commitImageEdit(history,replaceImageText(history.present,original.id,operation));
 const [edited]=placedImageTexts(history.present,source,()=>40);assert.deepEqual({x:edited.x,y:edited.y,width:edited.width,height:edited.height},resized);
 assert.deepEqual(undoImageEdit(history).present,commands);assert.deepEqual(redoImageEdit(undoImageEdit(history)).present,history.present);assert.equal(original.x,80);
});
