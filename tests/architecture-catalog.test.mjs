import test from 'node:test';
import assert from 'node:assert/strict';
import { ARCHITECTURE_TECHNOLOGIES } from '../src/features/post/architecture-catalog.ts';
import { architectureGroupLabel, architectureGroupPresentation, normalizeArchitectureGroups } from '../src/features/post/architecture-groups.ts';
import { architectureLayout } from '../src/features/post/architecture-layout.ts';
import { parseArchitectureSpec } from '../src/features/post/api/post-list.ts';
import { techStackLogo } from '../src/features/blog-home/tech-stack-logos.ts';
import { existsSync } from 'node:fs';
const base={schemaVersion:1,groups:[],nodes:[{id:'n',type:'APP',label:'App'}],edges:[]};
test('all expanded technology IDs are unique, accepted and use existing local logo assets',()=>{
 assert.ok(ARCHITECTURE_TECHNOLOGIES.length>=80);
 assert.equal(new Set(ARCHITECTURE_TECHNOLOGIES.map(x=>x.id)).size,ARCHITECTURE_TECHNOLOGIES.length);
 for(const tech of ARCHITECTURE_TECHNOLOGIES){
  assert.doesNotThrow(()=>parseArchitectureSpec({...base,nodes:[{...base.nodes[0],icon:tech.id}]}));
  const logo=techStackLogo(tech.title);if(logo)assert.ok(existsSync(new URL('../public'+logo,import.meta.url)),logo);
 }
});
test('legacy vendor details survive category normalization without repeated prefixes',()=>{
 const legacy={...base,groups:[{id:'c',type:'ORACLE_CLOUD',label:'Production'},{id:'d',type:'DOCKER',label:'Docker',parentId:'c'}],nodes:[{...base.nodes[0],groupId:'d'}]};
 const next=normalizeArchitectureGroups(legacy);
 assert.deepEqual(architectureGroupPresentation(legacy.groups[0]),{category:'CLOUD',detail:'Oracle Cloud / Production'});
 assert.equal(next.groups[0].type,'CLOUD');assert.equal(next.groups[1].type,'CONTAINER');
 assert.deepEqual(normalizeArchitectureGroups(next),next);
 assert.deepEqual(architectureLayout(next),architectureLayout(legacy));
 assert.doesNotThrow(()=>parseArchitectureSpec(next));
});
test('blank optional group details are accepted but invalid nesting and oversized details are rejected',()=>{
 const spec={...base,groups:[{id:'c',type:'CUSTOM',typeLabel:'VPC',label:''},{id:'d',type:'CONTAINER',parentId:'c',label:''}]};
 assert.doesNotThrow(()=>parseArchitectureSpec(spec));
 assert.equal(architectureGroupLabel(spec.groups[0]),"VPC");
 assert.throws(()=>parseArchitectureSpec({...spec,groups:[{...spec.groups[0],type:'CONTAINER',typeLabel:null},spec.groups[1]]}));
 assert.throws(()=>parseArchitectureSpec({...spec,groups:[{...spec.groups[0],label:'a'.repeat(101)}]}));
 assert.throws(()=>parseArchitectureSpec({...base,nodes:[{...base.nodes[0],icon:'https://example.com/icon.svg'}]}));
});
