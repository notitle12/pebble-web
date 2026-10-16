import test from 'node:test';
import assert from 'node:assert/strict';
import {policyHref,policyReturnTo,safePolicyReturnTo} from '../src/features/legal/navigation.ts';

test('약관을 반복해서 이동해도 처음 서비스 페이지와 검색 조건으로 돌아간다',()=>{
 for(const entry of ['/', '/posts?page=2&query=개발', '/projects?status=IN_PROGRESS', '/blogs/my-blog/posts/hello-world']) {
  let url=new URL(entry,'https://pebble.invalid');
  const expected=`${url.pathname}${url.search}`;
  for(const policy of ['/terms','/privacy','/terms','/privacy']) {
   url=new URL(policyHref(policy,policyReturnTo(url.pathname,url.searchParams)),url);
   assert.equal(policyReturnTo(url.pathname,url.searchParams),expected);
  }
  // 새로고침하거나 링크를 새 탭에 열어도 URL만으로 복귀 경로를 복원한다.
  const reopened=new URL(url.href);
  assert.equal(policyReturnTo(reopened.pathname,reopened.searchParams),expected);
 }
});
test('약관 탐색을 마친 뒤 새 서비스 화면에서 진입하면 복귀 경로도 갱신한다',()=>{
 assert.equal(policyReturnTo('/projects',new URLSearchParams()),'/projects');
 assert.equal(policyReturnTo('/posts',new URLSearchParams('page=3')),'/posts?page=3');
});
test('직접 진입과 외부·약관·인증 콜백 복귀 경로는 홈으로 대체한다',()=>{
 for(const value of [null,'','//evil.example','https://evil.example','javascript:alert(1)','/\\evil.example','/%2f%2fevil.example','/terms','/privacy?returnTo=/terms','/posts/../terms','/auth/naver/callback?code=secret','/api/v1/members/me'])assert.equal(safePolicyReturnTo(value),'/');
 assert.equal(policyReturnTo('/privacy',new URLSearchParams()),'/');
 assert.equal(policyReturnTo('/terms',new URLSearchParams('returnTo=//evil.example')),'/');
});
