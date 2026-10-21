import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareImageAttachments} from '../src/features/post/image-attachments.ts';
import {createPendingImages} from '../src/features/post/pending-images.ts';

test('여러 이미지는 선택 순서로 준비하고 저장 전까지 로컬 미리보기로 보존한다',async()=>{
 const files=['a.jpg','b.jpg','c.jpg'].map(name=>new File(['jpeg'],name,{type:'image/jpeg'}));
 const pending=createPendingImages(file=>`blob:${file.name}`,()=>{});
 const result=await prepareImageAttachments(files,async file=>pending.stage(file));
 assert.deepEqual(result.errors,[]);
 assert.deepEqual(result.images.map(image=>image.name),files.map(file=>file.name));
 const draft={title:'test',summary:'',thumbnailImageSrc:result.images[1].src,blocks:[{key:'one',type:'HTML',content:result.images.map(image=>`<img src="${image.src}">`).join(''),language:null,title:null,valid:true}]};
 const uploaded=[];
 const saved=await pending.resolve(draft,async file=>{uploaded.push(file.name);return {src:`https://api.example.com/${file.name}`,previewUrl:`https://images.example.com/${file.name}`};});
 assert.deepEqual(uploaded,files.map(file=>file.name));
 assert.equal(saved.thumbnailImageSrc,'https://api.example.com/b.jpg');
 assert.ok(saved.blocks[0].content.indexOf('a.jpg')<saved.blocks[0].content.indexOf('c.jpg'));
});

test('잘못된 파일과 응답은 파일명과 함께 알리고 나머지 이미지는 계속 준비한다',async()=>{
 const files=['bad.jpg','unsafe.jpg','ok.jpg'].map(name=>new File(['jpeg'],name,{type:'image/jpeg'}));
 const result=await prepareImageAttachments(files,async file=>{
  if(file.name==='bad.jpg')throw Error('크기 초과');
  return {src:file.name==='unsafe.jpg'?'javascript:alert(1)':'https://api.example.com/ok',previewUrl:'blob:ok'};
 });
 assert.deepEqual(result.images.map(image=>image.name),['ok.jpg']);
 assert.match(result.errors[0],/bad.jpg: 크기 초과/);
 assert.match(result.errors[1],/unsafe.jpg: 이미지 응답 주소/);
});
