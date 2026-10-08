import test from 'node:test';
import assert from 'node:assert/strict';
import {createPendingImages,pendingImagePrefix} from '../src/features/post/pending-images.ts';
const value=(src)=>({title:'test',summary:'',blocks:[{key:'one',type:'HTML',content:`<p>내용</p><img src="${src}" alt="이미지">`,language:null,title:null,valid:true}]});
const file=()=>new File(['jpeg'],'test.jpg',{type:'image/jpeg'});
test('selection only creates local preview; discard releases it without upload',()=>{
 const revoked=[];const pending=createPendingImages(()=> 'blob:local',url=>revoked.push(url));
 const staged=pending.stage(file());assert.ok(staged.src.startsWith(pendingImagePrefix));assert.equal(staged.previewUrl,'blob:local');
 assert.equal(pending.withoutPending(value(staged.src)).blocks[0].content,'<p>내용</p>');
 pending.dispose();assert.deepEqual(revoked,['blob:local']);
});
test('save uploads only referenced files, replaces stable refs and reuses successful upload on retry',async()=>{
 const pending=createPendingImages(()=> 'blob:local',()=>{});const used=pending.stage(file());pending.stage(file());let calls=0;
 const upload=async()=>{calls++;return {src:'https://api.example.com/images/12/content',previewUrl:'https://images.example.com/signed'};};
 const saved=await pending.resolve({...value(used.src),thumbnailImageSrc:used.src},upload);assert.equal(calls,1);assert.ok(!saved.blocks[0].content.includes(pendingImagePrefix));assert.ok(saved.blocks[0].content.includes('/12/content'));assert.equal(saved.thumbnailImageSrc,'https://api.example.com/images/12/content');
 await pending.resolve(value(used.src),upload);assert.equal(calls,1);
});
test('failed upload retains file for retry without replacing draft content',async()=>{
 const pending=createPendingImages(()=> 'blob:local',()=>{});const staged=pending.stage(file());const draft=value(staged.src);
 await assert.rejects(pending.resolve(draft,async()=>{throw Error('storage failure');}),/storage failure/);
 assert.ok(draft.blocks[0].content.includes(staged.src));
 assert.ok((await pending.resolve(draft,async()=>({src:'https://api.example.com/ok',previewUrl:'https://images.example.com/ok'}))).blocks[0].content.includes('/ok'));
});
test('restored draft with missing local files fails closed instead of storing temporary reference',async()=>{
 const pending=createPendingImages();await assert.rejects(pending.resolve(value(pendingImagePrefix+'missing'),async()=>{throw Error('should not upload');}),/다시 첨부/);
});
test('invalid file rejected before creating preview',()=>{
 let calls=0;const pending=createPendingImages(()=>{calls++;return 'blob:local';},()=>{});
 assert.throws(()=>pending.stage(new File(['svg'],'x.svg',{type:'image/svg+xml'})),/JPEG/);assert.equal(calls,0);
});
