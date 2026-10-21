import test from 'node:test';
import assert from 'node:assert/strict';
import {changeDbRelationShape,connectDbColumns,connectDbColumnToTable,databaseRelationShapes,disconnectDbColumn,relationShapeLabel,reverseDbRelation,smartConnectDbColumns} from '../src/features/post/database-relationship-choice.ts';
import {parseDatabaseSchema,relationCardinality} from '../src/features/post/database-schema.ts';
const schema=()=>({schemaVersion:1,display:'BOTH',tables:[{id:'users',name:'users',description:'',position:{x:32,y:32},columns:[{id:'id',name:'id',dataType:'BIGINT',nullable:false,primaryKey:true,unique:false,description:'',reference:null}]},{id:'posts',name:'posts',description:'',position:{x:372,y:32},columns:[{id:'user-id',name:'user_id',dataType:'BIGINT',nullable:true,primaryKey:false,unique:false,description:'',reference:null}]}]});
const one={tableId:'users',columnId:'id'},foreign={tableId:'posts',columnId:'user-id'};
test('every visual preset creates the FK on the second endpoint and matches stored cardinality',()=>{
 assert.equal(databaseRelationShapes.length,8);assert.equal(new Set(databaseRelationShapes.map(relationShapeLabel)).size,8);
 for(const notation of ['IE','CHEN'])for(const shape of databaseRelationShapes){
  const s=connectDbColumns(schema(),one,foreign,shape,notation);parseDatabaseSchema(s);
  const t=s.tables[1],c=t.columns[0];assert.deepEqual(c.reference,{...one,notation,sourceRequired:shape.sourceRequired});assert.equal(s.tables[0].columns[0].reference,null);
  assert.deepEqual(relationCardinality(t,c),{...shape,notation});
 }
});
test('a non-key first endpoint, self-column and a PK used as many are rejected',()=>{
 const shape={many:true,targetRequired:true,sourceRequired:false};
 assert.throws(()=>connectDbColumns(schema(),foreign,one,shape,'IE'),/처음에는/);
 assert.throws(()=>connectDbColumns(schema(),one,one,shape,'IE'),/다른 컬럼/);
 const s=schema();s.tables[1].columns[0].primaryKey=true;s.tables[1].columns[0].nullable=false;
 assert.throws(()=>connectDbColumns(s,one,foreign,shape,'IE'),/단일 PK/);
 assert.throws(()=>connectDbColumns(s,one,foreign,{many:false,targetRequired:false,sourceRequired:false},'IE'),/PK 컬럼/);
 parseDatabaseSchema(connectDbColumns(s,one,foreign,{many:false,targetRequired:true,sourceRequired:false},'IE'));
});

test('smartConnectDbColumns connects in either direction (PK->FK or FK->PK), auto-promotes non-PK, and copies empty dataType',()=>{
 // Reverse direction: FK -> PK
 const base=schema();
 base.tables[1].columns[0].dataType='';
 const reverse=smartConnectDbColumns(base,foreign,one);
 assert.deepEqual(reverse.one,one);
 assert.deepEqual(reverse.foreign,foreign);
 assert.equal(reverse.autoPromoted,false);
 assert.equal(reverse.schema.tables[1].columns[0].dataType,'BIGINT');
 assert.equal(reverse.schema.tables[1].columns[0].reference?.tableId,'users');
 parseDatabaseSchema(reverse.schema);

 // Neither is PK/UQ yet: auto-promotes first endpoint to PK
 const unkeyed=schema();
 unkeyed.tables[0].columns[0].primaryKey=false;
 const promoted=smartConnectDbColumns(unkeyed,one,foreign);
 assert.equal(promoted.autoPromoted,true);
 assert.equal(promoted.schema.tables[0].columns[0].primaryKey,true);
 parseDatabaseSchema(promoted.schema);

 // Disconnecting removes reference cleanly
 const disconnected=disconnectDbColumn(promoted.schema,'posts','user-id');
 assert.equal(disconnected.tables[1].columns[0].reference,null);
 parseDatabaseSchema(disconnected);
});

test('connectDbColumnToTable creates a unique FK column on the target table and connects it',()=>{
 const base=schema();
 const res=connectDbColumnToTable(base,one,'posts');
 assert.equal(res.schema.tables[1].columns.length,2);
 const created=res.schema.tables[1].columns.find(c=>c.id===res.createdColumnId);
 assert.ok(created);
 assert.equal(created.name,'users_id');
 assert.equal(created.dataType,'BIGINT');
 assert.equal(created.reference?.tableId,'users');
 parseDatabaseSchema(res.schema);
});

test('changeDbRelationShape and reverseDbRelation allow switching any line shape or flipping direction after connecting',()=>{
 let s=smartConnectDbColumns(schema(),one,foreign,{many:false,targetRequired:true,sourceRequired:false},'IE').schema;
 // Even if the FK column was marked PK, switching to 1:N or optional automatically clears PK on FK so it never blocks
 s.tables[1].columns[0].primaryKey=true;
 for(const shape of databaseRelationShapes){
  s=changeDbRelationShape(s,'posts','user-id',shape,'CHEN');
  parseDatabaseSchema(s);
  assert.deepEqual(relationCardinality(s.tables[1],s.tables[1].columns[0]),{...shape,notation:'CHEN'});
 }
 const reversed=reverseDbRelation(s,'posts','user-id');
 assert.ok(reversed);
 assert.deepEqual(reversed.newFk,{tableId:'users',columnId:'id'});
 assert.equal(reversed.schema.tables[0].columns[0].reference?.tableId,'posts');
 parseDatabaseSchema(reversed.schema);
});

test('smartConnectDbColumns automatically adds FK column on target table when connecting PK to PK', () => {
 const twoPkSchema = {
  schemaVersion: 1,
  display: 'BOTH',
  tables: [
   {
    id: 't1',
    name: '테이블1',
    description: '사용자 정보',
    position: { x: 32, y: 32 },
    columns: [
     { id: 't1-id', name: 'id', logicalName: '식별자', dataType: 'BIGINT', nullable: false, primaryKey: true, unique: false, description: '', reference: null },
    ],
   },
   {
    id: 't2',
    name: '테이블2',
    description: '주문 정보',
    position: { x: 372, y: 32 },
    columns: [
     { id: 't2-id', name: 'id', logicalName: '식별자', dataType: 'BIGINT', nullable: false, primaryKey: true, unique: false, description: '', reference: null },
    ],
   },
  ],
 };

 const res = smartConnectDbColumns(twoPkSchema, { tableId: 't1', columnId: 't1-id' }, { tableId: 't2', columnId: 't2-id' });
 parseDatabaseSchema(res.schema);

 const t2 = res.schema.tables.find(t => t.id === 't2');
 assert.ok(t2);
 // Table 2 should now have 2 columns: its own id (PK) AND newly added FK column
 assert.equal(t2.columns.length, 2);

 const pkCol = t2.columns.find(c => c.id === 't2-id');
 assert.ok(pkCol);
 assert.equal(pkCol.primaryKey, true);
 assert.equal(pkCol.reference, null); // PK remains clean, not overwritten!

 const fkCol = t2.columns.find(c => c.id === res.createdColumnId);
 assert.ok(fkCol);
 assert.equal(fkCol.name, '테이블1_id');
 assert.equal(fkCol.logicalName, '사용자 정보 식별자');
 assert.equal(fkCol.dataType, 'BIGINT');
 assert.equal(fkCol.primaryKey, false);
 assert.deepEqual(fkCol.reference, {
  tableId: 't1',
  columnId: 't1-id',
  notation: 'IE',
  sourceRequired: false,
 });

 // Reconnecting when an unreferenced matching column exists reuses it
 const schemaWithMatchingCol = {
  ...twoPkSchema,
  tables: [
   twoPkSchema.tables[0],
   {
    ...twoPkSchema.tables[1],
    columns: [
     ...twoPkSchema.tables[1].columns,
     { id: 'custom-fk', name: '테이블1_id', logicalName: '', dataType: 'BIGINT', nullable: true, primaryKey: false, unique: false, description: '', reference: null },
    ],
   },
  ],
 };
 const reused = smartConnectDbColumns(schemaWithMatchingCol, { tableId: 't1', columnId: 't1-id' }, { tableId: 't2', columnId: 't2-id' });
 const reusedT2 = reused.schema.tables.find(t => t.id === 't2');
 assert.equal(reusedT2.columns.length, 2); // Did not add a 3rd column
 const reusedFk = reusedT2.columns.find(c => c.id === 'custom-fk');
 assert.ok(reusedFk);
 assert.equal(reusedFk.reference?.tableId, 't1');
});
