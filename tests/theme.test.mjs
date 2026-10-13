import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {parseTheme,themeBootstrap} from '../src/features/appearance/theme.ts';
test('테마는 허용한 두 값만 읽고 본문 표시 전에 저장 설정을 적용한다',()=>{
 assert.equal(parseTheme('dark'),'dark');for(const v of ['light',null,'system','<script>'])assert.equal(parseTheme(v),'light');
 for(const [value,expected] of [['dark','dark'],['light','light'],['unknown','light']]){const document={documentElement:{dataset:{}}};vm.runInNewContext(themeBootstrap,{document,localStorage:{getItem:()=>value}});assert.equal(document.documentElement.dataset.theme,expected);}
 const document={documentElement:{dataset:{}}};vm.runInNewContext(themeBootstrap,{document,localStorage:{getItem:()=>{throw new Error('blocked')}}});assert.equal(document.documentElement.dataset.theme,'light');
});
