import test from 'node:test';
import assert from 'node:assert/strict';
import {connectDbColumns,databaseRelationShapes,relationShapeLabel} from '../src/features/post/database-relationship-choice.ts';
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
