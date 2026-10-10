import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPendingTags,parsePendingTagNames} from '../src/features/post/pending-tags.ts';
import {buildPostSaveBody,createEditorBlock} from '../src/features/post/post-editor-model.ts';
const draft=(names)=>({title:'태그 테스트',summary:'',tagIds:['10'],pendingTagNames:names,blocks:[createEditorBlock('HTML')]});
const response=(id,name)=>({data:{id,name,slug:name,displayOrder:0,status:'ACTIVE'}});
test('임시저장은 새 태그 이름을 서버 본문에 보내지 않고 발행 전 미해결 태그를 차단한다',()=>{
  const value=draft(['react']);
  assert.equal('pendingTagNames' in buildPostSaveBody(value,undefined,{draft:true}),false);
  assert.deepEqual(value.pendingTagNames,['react']);
  assert.throws(()=>buildPostSaveBody(value,undefined,{draft:false}),/새 태그/);
});
test('발행 시 남아 있는 태그만 생성하고 기존 ID와 응답 중복을 합친다',async()=>{
  const calls=[];
  const pending=createPendingTags();
  const value=await pending.resolve(draft(['react','typescript']),async(path,{body})=>{calls.push(body.name);return response('10',body.name);});
  assert.deepEqual(calls,['react','typescript']);assert.deepEqual(value.tagIds,['10']);assert.deepEqual(value.pendingTagNames,[]);
  assert.doesNotThrow(()=>buildPostSaveBody(value,undefined,{draft:false}));
});
test('발행 일부 실패 후 성공한 태그는 재요청하지 않고 삭제한 태그도 생성하지 않는다',async()=>{
  const pending=createPendingTags(),calls=[];let fail=true;
  const request=async(path,{body})=>{calls.push(body.name);if(body.name==='b'&&fail)throw Error('network');return response(body.name==='a'?'11':'12',body.name);};
  await assert.rejects(pending.resolve(draft(['a','b']),request));fail=false;
  const result=await pending.resolve(draft(['a','c']),request);
  assert.deepEqual(calls,['a','b','c']);assert.deepEqual(result.tagIds,['10','11','12']);
});
test('브라우저 임시 태그는 정상 이름 배열만 복원한다',()=>{
  assert.deepEqual(parsePendingTagNames(['한글','react']),['한글','react']);
  for(const value of [null,['two words'],['React'],['x','x'],[1]])assert.throws(()=>parsePendingTagNames(value));
});
