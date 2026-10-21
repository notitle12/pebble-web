import test from 'node:test';
import assert from 'node:assert/strict';
import {buildNaverMapEmbed,parseNaverMapEmbed} from '../src/features/post/naver-map.ts';
import {richContentHtml,richEditorHtml,persistedRichHtml} from '../src/features/post/rich-content.ts';

test('네이버 지도는 좌표와 장소명을 저장하고 HTML·마크다운·재편집에서 보존한다',()=>{
 const location={latitude:37.5665,longitude:126.978,label:'서울시청 <광장>'};
 const src=buildNaverMapEmbed(location);
 assert.deepEqual(parseNaverMapEmbed(src),location);
 for(const format of ['HTML','MARKDOWN']){
  const html=richContentHtml(`<iframe src="${src.replaceAll('&','&amp;')}" onload="alert(1)" sandbox="allow-top-navigation"></iframe>`,format);
  assert.match(html,/<iframe/);assert.match(html,/title="네이버 지도"/);
  assert.match(html,/referrerpolicy="strict-origin-when-cross-origin"/);
  assert.doesNotMatch(html,/onload|allow-top-navigation|<광장>/);
  assert.equal(persistedRichHtml(richEditorHtml(html,'HTML')),html);
 }
});
test('좌표를 벗어나거나 임의 경로·외부 호스트·중복 인자·스크립트를 담은 지도는 거부한다',()=>{
 const bad=[
  '/maps/naver?lat=&lng=127&label=',
  '/maps/naver?lat=91&lng=127&label=',
  '/maps/naver?lat=37&lng=181&label=',
  '/maps/naver?lat=Infinity&lng=127&label=',
  '/maps/naver?lat=37&lng=127&label=x&lat=1',
  '/maps/naver?lat=37&lng=127&label=x&script=1',
  '/maps/naver?lat=37&lng=127&label=x#fragment',
  '/maps/naver?lat=37&lng=127&label=%00',
  'https://evil.test/maps/naver?lat=37&lng=127&label=x',
  '//evil.test/maps/naver?lat=37&lng=127&label=x',
  '/maps/naver?lat=37&lng=127&label=x\\evil',
  '/settings/account?lat=37&lng=127&label=x',
 ];
 for(const src of bad){assert.equal(parseNaverMapEmbed(src),null,src);assert.doesNotMatch(richContentHtml(`<iframe src="${src}"></iframe>`,'HTML'),/<iframe/,src);}
 assert.equal(buildNaverMapEmbed({latitude:NaN,longitude:127,label:''}),null);
 assert.equal(buildNaverMapEmbed({latitude:37,longitude:127,label:'x'.repeat(201)}),null);
});
test('지도 키 미설정·네트워크 오류는 처리 가능한 오류로 반환하고 재시도할 수 있다',async()=>{
 const original=globalThis.fetch;
 try{
  const {loadNaverMaps}=await import('../src/features/post/naver-maps-sdk.ts');
  globalThis.fetch=async()=>({ok:true,json:async()=>({clientId:''})});
  await assert.rejects(loadNaverMaps(),/연결을 준비/);
  globalThis.fetch=async()=>({ok:false});
  await assert.rejects(loadNaverMaps(),/지도 설정/);
 }finally{globalThis.fetch=original;}
});
