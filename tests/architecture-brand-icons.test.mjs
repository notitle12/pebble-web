import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ARCHITECTURE_BRAND_ICONS,architectureBrandIcon,searchArchitectureIcons} from '../src/features/post/architecture-brand-icons.ts';
import {toolboxIcon,newArchitectureNode} from '../src/features/post/architecture-tools.ts';
import {parseArchitectureSpec} from '../src/features/post/api/post-list.ts';
test('only reviewed commercial artwork is offered; unknown IDs and URLs cannot resolve to brand assets',()=>{
 assert.deepEqual(ARCHITECTURE_BRAND_ICONS.map(icon=>icon.value),['GIT','RUST']);
 for(const value of ['DOCKER','GO','PYTHON','POSTGRESQL','https://example.com/a.svg','<svg/>',null])assert.equal(architectureBrandIcon(value),undefined);
 for(const icon of ARCHITECTURE_BRAND_ICONS){
  assert.equal(toolboxIcon(icon.value),icon.value);
  assert.ok(['CC BY 3.0','CC BY 4.0'].includes(icon.license));
  assert.match(icon.asset,/^\/technology-icons\/[a-z]+\.(svg|png)$/);
  assert.ok(readFileSync(new URL(`../public${icon.asset}`,import.meta.url)).length>100);
  const node={...newArchitectureNode('n',icon.value,0),label:'직접 입력한 이름'};
  const spec={schemaVersion:1,groups:[{id:'g',type:'CUSTOM',label:'영역',icon:icon.value}],nodes:[node],edges:[]};
  assert.deepEqual(parseArchitectureSpec(spec),spec);
  const notices=readFileSync(new URL('../public/technology-icons/NOTICE.txt',import.meta.url),'utf8');
  for(const value of [icon.author,icon.source,icon.policy,icon.licenseUrl])assert.ok(notices.includes(value));
 }
 assert.equal(newArchitectureNode('n','GIT',0).label,'');
});
test('icon search accepts Korean aliases, case and whitespace without modifying the approved catalog',()=>{
 assert.equal(searchArchitectureIcons(ARCHITECTURE_BRAND_ICONS,' 러 스트 ')[0].value,'RUST');
 assert.equal(searchArchitectureIcons(ARCHITECTURE_BRAND_ICONS,'gIt')[0].value,'GIT');
 assert.equal(searchArchitectureIcons(ARCHITECTURE_BRAND_ICONS,'깃')[0].value,'GIT');
 assert.deepEqual(searchArchitectureIcons(ARCHITECTURE_BRAND_ICONS,'Docker'),[]);
 assert.equal(searchArchitectureIcons(ARCHITECTURE_BRAND_ICONS,'  ').length,2);
});
