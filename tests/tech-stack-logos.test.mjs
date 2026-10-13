import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TECH_STACK_GROUPS} from '../src/features/blog-home/tech-stack-catalog.ts';
import {techStackLogo} from '../src/features/blog-home/tech-stack-logos.ts';
test('선택 가능한 모든 기술은 로컬 SVG 로고를 갖고 임의 입력은 외부 URL을 만들지 않는다',()=>{
 for(const group of TECH_STACK_GROUPS)for(const name of group.names){
  const logo=techStackLogo(name);assert.ok(logo,name);
  const svg=readFileSync(new URL(`../public${logo}`,import.meta.url),'utf8');assert.match(svg,/<svg/);assert.doesNotMatch(svg,/<script|javascript:|<foreignObject/i);
 }
 assert.equal(techStackLogo('  DOCKER  '),'/tech/docker.svg');assert.equal(techStackLogo('springboot'),'/tech/spring.svg');assert.equal(techStackLogo('https://evil.invalid'),null);
});
