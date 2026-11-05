import test from 'node:test';
import assert from 'node:assert/strict';
import {imageCropWorkspace,replaceImageCrop,sameImageCrop} from '../src/features/post/image-crop-session.ts';
import {fullImageCrop,placedImageTexts,placedImageMosaics} from '../src/features/post/image-edit-model.ts';
import {emptyImageHistory,commitImageEdit,undoImageEdit,redoImageEdit} from '../src/features/post/image-edit-history.ts';

const source={width:600,height:400};
const crop={type:'crop',x:100,y:50,width:300,height:200};
const text={type:'text',id:'label',text:'crop後にも保持',x:20,y:30,fontSize:24,color:'#000000',maxWidth:160,boxHeight:32};
const mosaic={type:'mosaic',x:30,y:40,width:80,height:60,blockSize:12};

test('reopening a crop retains edits outside it and restores the whole source workspace',()=>{
 const commands=[text,crop,mosaic];
 const workspace=imageCropWorkspace(commands,source);
 assert.deepEqual(workspace.crop,crop);
 assert.deepEqual(workspace.operations,[text,{...mosaic,x:130,y:90}]);
 assert.deepEqual(commands,[text,crop,mosaic]);
 assert.equal(workspace.operations.some(op=>op.type==='crop'),false);
});

test('multiple crops translate later text, mosaic, pen and erasures into original coordinates',()=>{
 const pen={type:'pen',points:[{x:5,y:6}],color:'#ff0000',width:8,erasures:[{points:[{x:7,y:8}],width:12}]};
 const nextCrop={type:'crop',x:10,y:15,width:150,height:100};
 const commands=[crop,pen,nextCrop,{...text,maxWidth:undefined},mosaic];
 const workspace=imageCropWorkspace(commands,source);
 assert.deepEqual(workspace.crop,{...nextCrop,x:110,y:65});
 assert.deepEqual(workspace.operations[0],{...pen,points:[{x:105,y:56}],erasures:[{points:[{x:107,y:58}],width:12}]});
 assert.deepEqual(workspace.operations[1],{...text,x:130,y:95,maxWidth:130});
 assert.deepEqual(workspace.operations[2],{...mosaic,x:140,y:105});
 assert.equal(pen.points[0].x,5);
});

test('expanding an existing crop replaces it and preserves text wrapping and annotation targets',()=>{
 const larger={type:'crop',x:50,y:20,width:500,height:350};
 const commands=replaceImageCrop([crop,text,mosaic],larger,source);
 assert.equal(commands.filter(op=>op.type==='crop').length,1);
 assert.deepEqual(commands.at(-1),larger);
 const [label]=placedImageTexts(commands,source,()=>20),[patch]=placedImageMosaics(commands,source);
 assert.equal(label.x,70);assert.equal(label.y,60);assert.equal(label.width,160);
 assert.equal(patch.x,80);assert.equal(patch.y,70);
 assert.deepEqual(imageCropWorkspace(commands,source).operations,imageCropWorkspace([crop,text,mosaic],source).operations);
});

test('restoring the full image removes only the crop and is reversible as one history step',()=>{
 const original=[crop,text,mosaic],full=fullImageCrop(source);
 let history=commitImageEdit(emptyImageHistory(),original);
 history=commitImageEdit(history,replaceImageCrop(history.present,full,source));
 assert.equal(history.present.some(op=>op.type==='crop'),false);
 assert.equal(history.present.length,2);
 assert.deepEqual(undoImageEdit(history).present,original);
 assert.deepEqual(redoImageEdit(undoImageEdit(history)).present,history.present);
 assert.ok(sameImageCrop(imageCropWorkspace(history.present,source).crop,full));
 assert.equal(sameImageCrop(crop,full),false);
});

test('repeated crop reopening is stable and supports non-enumerable bitmap dimensions',()=>{
 const bitmap=Object.create(null,{width:{get:()=>600},height:{get:()=>400}});
 const commands=replaceImageCrop([crop,text,mosaic],crop,bitmap);
 assert.deepEqual(replaceImageCrop(commands,crop,bitmap),commands);
 assert.deepEqual(imageCropWorkspace([],bitmap).crop,fullImageCrop(source));
});
