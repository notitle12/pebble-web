import test from 'node:test';
import assert from 'node:assert/strict';
import {representativeImageSrc,postImageSources,bodyImageId} from '../src/features/post/post-images.ts';
const a='https://api.pebble-log.com/api/v1/posts/1/images/2/content';
const b='https://api.pebble-log.com/api/v1/posts/1/images/3/content';
const blocks=[{type:'HTML',content:`<img src="${a}"><img src="${b}">`}];
test('first body image is default; explicit image survives reorder and removal falls back',()=>{
  assert.equal(representativeImageSrc(blocks),a);
  assert.equal(representativeImageSrc(blocks,b),b);
  assert.equal(representativeImageSrc([{type:'HTML',content:`<img src="${a}">`}],b),a);
  assert.equal(representativeImageSrc([],a),null);
});
test('representative candidates exclude code, commented or unsafe HTML, and remote URLs',()=>{
  assert.deepEqual(postImageSources([{type:'CODE',content:`<img src="${a}">`},{type:'HTML',content:`<!-- <img src="${a}"> --><img src="https://example.com/image.png"><img src="javascript:alert(1)"><img src="${b}">`}]),[b]);
  assert.equal(bodyImageId('javascript:alert(1)'),null);
});
test('markdown image order and local preview stable references are supported',()=>{
  const local='https://pebble.local.invalid/images/test-file';
  assert.equal(representativeImageSrc([{type:'MARKDOWN',content:`![local](${local})\n![saved](${a})`}]),local);
});

test('save sends chosen body image ID and restore preserves selection from server',async()=>{
  const {buildPostBody,editorValueFromPost}=await import('../src/features/post/post-editor-model.ts');
  assert.equal(buildPostBody({title:'글',summary:'',blocks,thumbnailImageSrc:b}).thumbnailImageId,'3');
  const restored=editorValueFromPost({title:'글',summary:null,urlKey:'1',thumbnailImageId:'3',tags:[],blocks:[{...blocks[0],displayOrder:0,language:null,title:null}],imagePreviews:undefined});
  assert.equal(restored.thumbnailImageSrc,b);
});
