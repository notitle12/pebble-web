import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDatabaseSchema,updateDbColumn,removeDbTable,removeDbColumn,newDatabaseSchema,schemaTableSpec,newDbPresetColumn,moveDbColumnOrder,autoLayoutDbTables,getDatabaseContentBounds,sortDbColumns,reorderDbColumns} from '../src/features/post/database-schema.ts';
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

test('relation settings stay backward compatible and persist through writer serialization',()=>{
 for(const notation of ['IE','BARKER','CHEN']){
  const s=schema();s.tables[1].columns[1].reference={tableId:'users',columnId:'id',notation,sourceRequired:true};
  parseDatabaseSchema(s);
  const block={key:'settings',type:'DB_SCHEMA',content:JSON.stringify(s),language:null,title:null,valid:true};
  const saved=documentToBlocks(blocksToDocument([block],()=>({type:'doc'})),()=>'<p></p>');
  assert.deepEqual(JSON.parse(saved[0].content).tables[1].columns[1].reference,s.tables[1].columns[1].reference);
 }
 for(const patch of [{notation:'OTHER'},{notation:null},{sourceRequired:'false'},{sourceRequired:null}]){
  const s=schema();Object.assign(s.tables[1].columns[1].reference,patch);assert.throws(()=>parseDatabaseSchema(s));
 }
});

test('preset columns, column reordering, auto-layout, and content bounds produce valid schemas',()=>{
 let s=schema();
 const created=newDbPresetColumn('created_at',s.tables[0].columns);
 const updated=newDbPresetColumn('updated_at',[...s.tables[0].columns,created]);
 const dupId=newDbPresetColumn('id',s.tables[0].columns);
 assert.equal(created.name,'created_at');
 assert.equal(created.dataType,'TIMESTAMP');
 assert.equal(updated.name,'updated_at');
 assert.equal(dupId.name,'id_2');
 assert.equal(dupId.primaryKey,false);
 assert.equal(dupId.unique,true);

 s.tables[0].columns.push(created,updated);
 s=moveDbColumnOrder(s,'users',updated.id,'UP');
 assert.equal(s.tables[0].columns[1].id,updated.id);
 assert.equal(s.tables[0].columns[2].id,created.id);

 s=autoLayoutDbTables(s);
 parseDatabaseSchema(s);
 const bounds=getDatabaseContentBounds(s);
 assert.ok(bounds.width>=280&&bounds.height>0);
});

test('column ordering enforces PK-top and FK-middle with drag-drop reordering, default values, and auto-increment',()=>{
 const pk1 = { id: 'pk-1', name: 'id', dataType: 'BIGINT', nullable: false, primaryKey: true, unique: true, description: 'PK 1', reference: null, defaultValue: '', autoIncrement: true };
 const pk2 = { id: 'pk-2', name: 'tenant_id', dataType: 'BIGINT', nullable: false, primaryKey: true, unique: true, description: 'PK 2', reference: null, defaultValue: '1', autoIncrement: false };
 const fk1 = { id: 'fk-1', name: 'parent_id', dataType: 'BIGINT', nullable: true, primaryKey: false, unique: false, description: 'FK 1', reference: { tableId: 'users', columnId: 'pk-1' } };
 const col1 = { id: 'c-1', name: 'name', dataType: 'VARCHAR(100)', nullable: true, primaryKey: false, unique: false, description: '이름', reference: null, defaultValue: '익명' };
 const col2 = { id: 'c-2', name: 'age', dataType: 'INT', nullable: true, primaryKey: false, unique: false, description: '나이', reference: null, defaultValue: '0' };

 const cols = [col1, fk1, pk2, col2, pk1];
 const sorted = sortDbColumns(cols);
 assert.deepEqual(sorted.map(c => c.id), ['pk-2', 'pk-1', 'fk-1', 'c-1', 'c-2']);

 const reorderedCols = reorderDbColumns(sorted, 'c-2', 'c-1');
 assert.deepEqual(reorderedCols.map(c => c.id), ['pk-2', 'pk-1', 'fk-1', 'c-2', 'c-1']);

 const reorderedPks = reorderDbColumns(sorted, 'pk-1', 'pk-2');
 assert.deepEqual(reorderedPks.map(c => c.id), ['pk-1', 'pk-2', 'fk-1', 'c-1', 'c-2']);

 const s = {
  schemaVersion: 1,
  display: 'BOTH',
  tables: [
   {
    id: 'users',
    name: 'users',
    description: '',
    position: { x: 32, y: 32 },
    columns: [pk1, fk1, col1],
   },
  ],
 };
 const parsed = parseDatabaseSchema(s);
 assert.equal(parsed.tables[0].columns[0].autoIncrement, true);
 assert.equal(parsed.tables[0].columns[2].defaultValue, '익명');

 const spec = schemaTableSpec(parsed, parsed.tables[0]);
 assert.equal(spec.columns[0].autoIncrement, true);
 assert.equal(spec.columns[2].defaultValue, '익명');
});

test('logicalName (속성명) is validated, stored on presets, and preserved in schema parsing', () => {
 const idCol = newDbPresetColumn('id');
 const created = newDbPresetColumn('created_at');
 const updated = newDbPresetColumn('updated_at');
 assert.equal(idCol.logicalName, '식별자');
 assert.equal(created.logicalName, '생성일시');
 assert.equal(updated.logicalName, '수정일시');

 const s = {
  schemaVersion: 1,
  display: 'BOTH',
  tables: [
   {
    id: 'users',
    name: 'users',
    description: '',
    position: { x: 32, y: 32 },
    columns: [
     { ...idCol, logicalName: '회원 번호' },
     { id: 'c-1', name: 'email', logicalName: '이메일 주소', dataType: 'VARCHAR(255)', nullable: false, primaryKey: false, unique: true, description: '', reference: null },
    ],
   },
  ],
 };
 const parsed = parseDatabaseSchema(s);
 assert.equal(parsed.tables[0].columns[0].logicalName, '회원 번호');
 assert.equal(parsed.tables[0].columns[1].logicalName, '이메일 주소');

 // Over 100 chars should throw
 s.tables[0].columns[1].logicalName = 'a'.repeat(101);
 assert.throws(() => parseDatabaseSchema(s));
});


test('optional column metadata survives writer reload and rejects invalid API values',()=>{
 const s=schema();Object.assign(s.tables[0].columns[0],{logicalName:'회원 번호',defaultValue:'1',autoIncrement:true});
 const block={key:'metadata',type:'DB_SCHEMA',content:JSON.stringify(s),title:null,language:null,valid:true};
 const restored=documentToBlocks(blocksToDocument([block],()=>({type:'doc'})),()=>'<p></p>');
 assert.deepEqual(JSON.parse(restored[0].content),s);
 assert.equal(schemaTableSpec(s,s.tables[0]).columns[0].logicalName,'회원 번호');
 for(const patch of [{logicalName:null},{defaultValue:null},{defaultValue:1},{defaultValue:'😀'.repeat(101)},{autoIncrement:'true'},{autoIncrement:null}]){
  const invalid=structuredClone(s);Object.assign(invalid.tables[0].columns[0],patch);assert.throws(()=>parseDatabaseSchema(invalid));
 }
});
