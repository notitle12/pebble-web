import test from 'node:test';
import assert from 'node:assert/strict';
import {ARCHITECTURE_ICONS,connectionMarkers,newArchitectureNode,newArchitectureGroup} from '../src/features/post/architecture-tools.ts';
import {parseArchitectureSpec} from '../src/features/post/api/post-list.ts';
import {moveArchitectureNode,moveArchitectureGroup} from '../src/features/post/architecture-editing.ts';
const base=()=>({schemaVersion:1,groups:[{...newArchitectureGroup('area','CLOUD'),label:'운영 영역',typeLabel:'요청 처리',bounds:{x:0,y:0,width:600,height:400}}],nodes:[{...newArchitectureNode('person','PERSON',0),label:'방문자',typeLabel:'이용자',groupId:'area'},{...newArchitectureNode('db','DATABASE',1),label:'기록 저장',groupId:'area'}],edges:[{id:'link',source:'person',target:'db',direction:'BOTH'}]});
test('generic icons create editable empty names; named documents round-trip with group roles and directions',()=>{
 assert.equal(newArchitectureNode('a','PERSON',0).label,'');
 for(const icon of ARCHITECTURE_ICONS){const spec=base();spec.nodes[0].icon=icon.value;spec.groups[0].icon=icon.value;assert.deepEqual(parseArchitectureSpec(JSON.parse(JSON.stringify(spec))),spec);}
});
test('missing direction remains a forward arrow; line and bidirectional markers differ',()=>{
 assert.deepEqual(connectionMarkers(undefined),{start:false,end:true});assert.deepEqual(connectionMarkers(null),{start:false,end:true});
 assert.deepEqual(connectionMarkers('NONE'),{start:false,end:false});assert.deepEqual(connectionMarkers('BOTH'),{start:true,end:true});
});
test('invalid group icons and connection directions fail closed',()=>{
 for(const icon of ['https://evil.test/logo.svg','<svg/>',42]){const spec=base();spec.groups[0].icon=icon;assert.throws(()=>parseArchitectureSpec(spec));}
 for(const direction of ['REVERSE',1,{}]){const spec=base();spec.edges[0].direction=direction;assert.throws(()=>parseArchitectureSpec(spec));}
});
test('moving elements preserves freely entered labels, group icons and edge directions',()=>{
 const spec=base();const moved=moveArchitectureGroup(moveArchitectureNode(spec,'person',{x:60,y:80}),'area',{x:30,y:30});
 assert.equal(moved.groups[0].icon,'CLOUD');assert.equal(moved.groups[0].typeLabel,'요청 처리');assert.equal(moved.nodes[0].label,'방문자');assert.equal(moved.edges[0].direction,'BOTH');assert.doesNotThrow(()=>parseArchitectureSpec(moved));
});
