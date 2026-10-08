import test from 'node:test';
import assert from 'node:assert/strict';
import {blocksToDocument, documentToBlocks, blocksSignature} from '../src/features/post/writer-document.ts';
import {richContentHtml} from '../src/features/post/rich-content.ts';
import {BlockAlignment} from '../src/features/post/block-alignment.ts';
const spec={schemaVersion:1,tableName:'users',columns:[{name:'id',dataType:'BIGINT',primaryKey:true,nullable:false}]};
const architecture={schemaVersion:1,groups:[],nodes:[{id:'client',type:'CLIENT',label:'클라이언트',icon:'CLIENT',position:{x:56,y:80}}],edges:[]};
const rich=text=>({type:'paragraph',content:[{type:'text',text}]});
const parse=block=>({type:'doc',content:JSON.parse(block.content)});
const render=doc=>JSON.stringify(doc.content);
test('본문 사이의 코드·명세·아키텍처는 저장과 재편집에서 순서와 내용을 보존한다',()=>{
 const blocks=[{type:'HTML',content:JSON.stringify([rich('앞')])},{type:'CODE',language:'JAVA',content:'<script>safe text</script>\n  return 1;'}, {type:'TABLE',content:JSON.stringify(spec)},{type:'ARCHITECTURE',content:JSON.stringify(architecture)}, {type:'HTML',content:JSON.stringify([rich('뒤')])}].map((b,i)=>({key:String(i),title:null,language:null,valid:true,...b}));
 const saved=documentToBlocks(blocksToDocument(blocks,parse),render);
 assert.equal(blocksSignature(saved),blocksSignature(blocks));
 assert.equal(blocksSignature(documentToBlocks(blocksToDocument(saved,parse),render)),blocksSignature(saved));
});
test('코드·테이블 명세·아키텍처 정렬은 저장과 재편집 사이에 보존한다',()=>{
 const blocks=[{key:'code',type:'CODE',content:'x',language:'JAVA',title:null,valid:true,alignment:'CENTER'}, {key:'table',type:'TABLE',content:JSON.stringify(spec),language:null,title:null,valid:true,alignment:'RIGHT'}, {key:'architecture',type:'ARCHITECTURE',content:JSON.stringify(architecture),language:null,title:null,valid:true,alignment:'CENTER'}];
 const saved=documentToBlocks(blocksToDocument(blocks,parse),render);
 assert.deepEqual(saved.map(block=>block.alignment),['CENTER','RIGHT','CENTER']);
});
test('table alignment parses and renders only the supported HTML values',()=>{
 const attribute=BlockAlignment.config.addGlobalAttributes.call(BlockAlignment)[0].attributes.align;
 const element={getAttribute:name=>name==='data-align'?'right':null};
 assert.equal(attribute.parseHTML(element),'right');
 assert.deepEqual(attribute.renderHTML({align:'right'}),{'data-align':'right'});
 assert.equal(attribute.parseHTML({getAttribute:()=> 'fixed'}),'left');
 assert.deepEqual(attribute.renderHTML({align:'fixed'}),{'data-align':'left'});
});
test('인용 안에 붙여 넣은 구조 블록도 누락 없이 저장한다',()=>{
 const result=documentToBlocks({type:'doc',content:[{type:'blockquote',content:[rich('앞'),{type:'pebbleCode',attrs:{language:'SQL'},content:[{type:'text',text:'SELECT 1;'}]},rich('뒤')]}]},render);
 assert.deepEqual(result.map(b=>b.type),['HTML','CODE','HTML']); assert.equal(result[1].content,'SELECT 1;'); assert.match(result[2].content,/뒤/);
});
test('HTML·마크다운 모드의 유효한 구조 마커는 보존하고 잘못된 마커와 실행 코드는 제거한다',()=>{
 const marker=`<div data-pebble-type="TABLE" data-pebble-spec="${JSON.stringify(spec).replaceAll('"','&quot;')}"></div>`;
 for(const format of ['HTML','MARKDOWN']){
 const output=richContentHtml(marker+'<script>alert(1)</script>',format);
 assert.match(output,/data-pebble-spec/); assert.doesNotMatch(output,/<script/);
 assert.doesNotMatch(richContentHtml('<div data-pebble-type="TABLE" data-pebble-spec="{}" onclick="evil()">invalid</div>',format),/data-pebble|onclick/);
 }
});
