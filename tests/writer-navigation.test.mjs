import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceWriterNavigation, safeWriterReturnHref, writerReturnHref, observeWriterNavigation} from '../src/lib/writer-navigation.ts';
const empty=()=>({current:null,returnTo:null});

for (const writer of ['/posts/new','/projects/new','/posts/123/edit','/projects/123/edit']) {
 test(`${writer} returns to the entry page including search, pagination and fragment`,()=>{
  const origin='/blogs/pebble?boardId=7&page=3&keyword=react#posts';
  const state=advanceWriterNavigation(advanceWriterNavigation(empty(),origin),writer);
  assert.equal(state.returnTo,origin);
  assert.equal(advanceWriterNavigation(state,writer).returnTo,origin);
 });
}
test('saving new content and reloading its edit URL preserve the entry page',()=>{
 for(const kind of ['posts','projects']) {
  let state=advanceWriterNavigation(empty(),'/search?keyword=hello&page=2');
  state=advanceWriterNavigation(state,`/${kind}/new`);
  state=advanceWriterNavigation(state,`/${kind}/123/edit`);
  state=advanceWriterNavigation(JSON.parse(JSON.stringify(state)),`/${kind}/123/edit`);
  assert.equal(state.returnTo,'/search?keyword=hello&page=2');
 }
});
test('a later writing session uses its own entry page instead of a stale origin',()=>{
 let state=advanceWriterNavigation(empty(),'/');
 state=advanceWriterNavigation(state,'/posts/new');
 state=advanceWriterNavigation(state,'/projects?page=4');
 state=advanceWriterNavigation(state,'/projects/new');
 assert.equal(state.returnTo,'/projects?page=4');
});
test('login callbacks do not replace the page before writing',()=>{
 let state=advanceWriterNavigation(empty(),'/blogs/pebble?boardId=2');
 for(const path of ['/auth/naver/callback?code=sample','/login?returnTo=%2Fposts%2Fnew','/agreements?returnTo=%2Fposts%2Fnew','/settings/profile?returnTo=%2Fposts%2Fnew'])state=advanceWriterNavigation(state,path);
 assert.equal(advanceWriterNavigation(state,'/posts/new').returnTo,'/blogs/pebble?boardId=2');
});
test('direct visits use a safe same-origin referrer; writer and unsafe return targets are rejected',()=>{
 assert.equal(advanceWriterNavigation(empty(),'/posts/new','/posts?page=5').returnTo,'/posts?page=5');
 assert.equal(advanceWriterNavigation(empty(),'/posts/new').returnTo,null);
 for(const value of [null,'https://outside.example','//outside.example','/a/..//outside.example','/\\outside.example','/posts/new','/projects/1/edit','/auth/naver/callback','/login?returnTo=/','/bad\npath'])assert.equal(safeWriterReturnHref(value),null,value);
});
test('tab storage survives a page reload and a new -> edit history replacement',()=>{
 const originalWindow=globalThis.window,originalDocument=globalThis.document;
 const data=new Map();
 try {
  globalThis.document={referrer:''};
  globalThis.window={location:{origin:'https://pebble.local',pathname:'/projects',search:'?page=6',hash:'#list'},sessionStorage:{getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)}};
  observeWriterNavigation();
  window.location={...window.location,pathname:'/posts/new',search:'',hash:''};
  observeWriterNavigation();
  window.location.pathname='/posts/123/edit';
  assert.equal(writerReturnHref('/me/posts'),'/projects?page=6#list');
  const stored=JSON.parse([...data.values()][0]);
  assert.deepEqual(stored,{current:'/posts/123/edit',returnTo:'/projects?page=6#list'});
 } finally {globalThis.window=originalWindow;globalThis.document=originalDocument;}
});
