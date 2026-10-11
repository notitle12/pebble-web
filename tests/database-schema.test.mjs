import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDatabaseSchema,updateDbColumn,removeDbTable,removeDbColumn,newDatabaseSchema,schemaTableSpec} from '../src/features/post/database-schema.ts';
import {blocksToDocument,documentToBlocks,blocksSignature} from '../src/features/post/writer-document.ts';
import {richContentHtml} from '../src/features/post/rich-content.ts';
import {validateEditorValue,buildPostBody} from '../src/features/post/post-editor-model.ts';
const col=(id,name,primaryKey=false,reference=null)=>({id,name,dataType:'BIGINT',primaryKey,nullable:!primaryKey,unique:false,description:'',reference});
const schema=()=>({schemaVersion:1,display:'BOTH',tables:[{id:'users',name:'사용자',description:'회원 정보',position:{x:32,y:32},columns:[col('id','id',true)]},{id:'posts',name:'posts',description:'',position:{x:400,y:32},columns:[col('id','id',true),col('user-id','user_id',false,{tableId:'users',columnId:'id'})]}]});
test('ERD/FK and specifications read the same stable references through renames',()=>{
 let s=parseDatabaseSchema(schema());s={...s,tables:s.tables.map(t=>t.id==='users'?{...t,name:'members'}:t)};s=updateDbColumn(s,'users','id',{name:'member_id'});
 assert.equal(schemaTableSpec(s,s.tables[1]).columns[1].foreignKey,'members.member_id');assert.deepEqual(s.tables[1].columns[1].reference,{tableId:'users',columnId:'id'});parseDatabaseSchema(s);
});
test('column and table deletion clean incoming references, including self-table references',()=>{
 let s=schema();assert.equal(removeDbTable(s,'users').tables[0].columns[1].reference,null);
 assert.equal(removeDbColumn(s,'users','id').tables[1].columns[1].reference,null);
 s.tables[0].columns.push(col('parent','parent_id',false,{tableId:'users',columnId:'id'}));parseDatabaseSchema(s);
 assert.equal(removeDbColumn(s,'users','id').tables[0].columns[0].reference,null);
});
test('changing a referenced unique key clears invalid FKs and PK forces not null',()=>{
 let s=updateDbColumn(schema(),'users','id',{primaryKey:false});assert.equal(s.tables[1].columns[1].reference,null);
 s=updateDbColumn(schema(),'posts','user-id',{primaryKey:true,nullable:true});assert.equal(s.tables[1].columns[1].nullable,false);
});
test('invalid references, duplicate names/IDs, nullable PK and unsupported payloads are rejected',()=>{
 for(const change of [s=>s.tables[1].columns[1].reference.columnId='missing',s=>s.tables[1].columns[1].reference.tableId='missing',s=>s.tables[1].columns[1].reference={tableId:'posts',columnId:'user-id'},s=>s.tables[0].columns[0].nullable=true,s=>s.tables[1].name=' 사용자 ',s=>s.tables[1].id='users',s=>s.tables[1].columns[1].name='ID',s=>s.tables[1].columns[1].id='id',s=>s.tables[0].position.x=NaN,s=>s.tables[0].position.x=1.5,s=>s.tables[0].extra=true,s=>s.tables[0].columns[0].description='\ud800',s=>s.tables[0].columns[0].reference={tableId:'posts',columnId:'id',extra:true},s=>s.tables=[]]){let s=schema();change(s);assert.throws(()=>parseDatabaseSchema(s));}
});
test('composite PK is preserved but a single component is not implicitly a unique FK target',()=>{
 let s=schema();s.tables[0].columns.push(col('tenant','tenant_id',true));assert.throws(()=>parseDatabaseSchema(s));s.tables[0].columns[0].unique=true;parseDatabaseSchema(s);
});
test('schema limits and Unicode lengths match the API contract',()=>{
 let s=schema();s.tables[0].name='😀'.repeat(100);parseDatabaseSchema(s);s.tables[0].name+='😀';assert.throws(()=>parseDatabaseSchema(s));
 s=schema();s.tables[0].columns=Array.from({length:51},(_,i)=>col(`c-${i}`,`c${i}`));assert.throws(()=>parseDatabaseSchema(s));
 s=schema();s.tables=Array.from({length:21},(_,i)=>({...s.tables[0],id:`t-${i}`,name:`t${i}`}));assert.throws(()=>parseDatabaseSchema(s));
 s=schema();s.tables[0].position.x=6001;assert.throws(()=>parseDatabaseSchema(s));
});
test('DB schema persists through writer serialization and reload, with display mode and layout',()=>{
 for(const display of ['BOTH','ERD','SPEC']){const s={...schema(),display};const blocks=[{key:'db',type:'DB_SCHEMA',content:JSON.stringify(s),title:'데이터 구조',language:null,valid:true,alignment:'CENTER'}];const doc=blocksToDocument(blocks,()=>({type:'doc'}));assert.equal(doc.content[0].type,'databaseSchema');const saved=documentToBlocks(doc,()=>'<p></p>');assert.equal(blocksSignature(saved),blocksSignature(blocks));assert.equal(validateEditorValue({title:'설계',summary:'',tags:[],blocks:saved}).length,0);}
});
test('unfinished DB block remains editable and cannot be published',()=>{
 const s=newDatabaseSchema();assert.throws(()=>parseDatabaseSchema(s));const blocks=[{key:'db',type:'DB_SCHEMA',content:JSON.stringify(s),title:null,language:null,valid:false}];const saved=documentToBlocks(blocksToDocument(blocks,()=>({type:'doc'})),()=>'<p></p>');assert.deepEqual(JSON.parse(saved[0].content),s);assert.equal(saved[0].valid,false);assert.ok(validateEditorValue({title:'a',summary:'',blocks:saved}).length);
});
test('HTML and markdown preserve valid DB markers and strip executable or invalid markers',()=>{
 const marker=s=>`<div data-pebble-type="DB_SCHEMA" data-pebble-spec="${JSON.stringify(s).replaceAll('"','&quot;')}"></div>`;
 for(const format of ['HTML','MARKDOWN']){assert.match(richContentHtml(marker(schema())+'<script>bad()</script>',format),/data-pebble-type="DB_SCHEMA"/);assert.doesNotMatch(richContentHtml(marker(schema())+'<script>bad()</script>',format),/<script/);assert.doesNotMatch(richContentHtml(marker({...schema(),schemaVersion:2}),format),/data-pebble-spec/);}
});
test('specification-first editor tab survives local writer roundtrip without leaking into API JSON',()=>{
 const block={key:'spec',type:'DB_SCHEMA',content:JSON.stringify(schema()),language:null,title:null,valid:true,editorTab:'SPEC'};
 const saved=documentToBlocks(blocksToDocument([block],()=>({type:'doc'})),()=>'<p></p>');assert.equal(saved[0].editorTab,'SPEC');assert.equal('editorTab' in buildPostBody({title:'설계',summary:'',tags:[],blocks:saved}).blocks[0],false);
});
