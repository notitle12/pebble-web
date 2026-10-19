import test from 'node:test';
import assert from 'node:assert/strict';
import {databaseSelectionPositions, databaseMarqueeTables, databaseTableSelection} from '../src/features/post/database-selection.ts';
import {removeDbTables, parseDatabaseSchema} from '../src/features/post/database-schema.ts';

const column=(id,reference=null)=>({id,name:id,dataType:'BIGINT',nullable:!!reference,primaryKey:!reference,unique:!reference,description:'',reference});
const table=(id,x,y)=>({id,name:id,description:'',position:{x,y},columns:[column('id')]});

test('moving a selection against either canvas edge preserves the spacing of all tables',()=>{
 const targets=[{id:'a',startX:10,startY:20},{id:'b',startX:110,startY:80}];
 assert.deepEqual(databaseSelectionPositions(targets,-100,-100),{a:{x:0,y:0},b:{x:100,y:60}});
 assert.deepEqual(databaseSelectionPositions(targets,6000,6000),{a:{x:5900,y:5940},b:{x:6000,y:6000}});
});

test('a common rounded movement delta keeps relative spacing and handles empty selections',()=>{
 const targets=[{id:'a',startX:100,startY:20},{id:'b',startX:200,startY:80}];
 const positions=databaseSelectionPositions(targets,12.7,-7.2);
 assert.deepEqual(positions,{a:{x:113,y:13},b:{x:213,y:73}});
 assert.deepEqual(databaseSelectionPositions([],2,2),{});
 assert.equal(targets[0].startX,100);
});

test('a box selects intersecting tables using actual measured dimensions',()=>{
 const tables=[table('a',10,10),table('b',500,10),table('c',10,500)];
 assert.deepEqual(databaseMarqueeTables(tables,{minX:300,maxX:360,minY:20,maxY:40},{a:{width:350,height:100}},330,true),['a']);
 assert.deepEqual(databaseMarqueeTables(tables,{minX:800,maxX:850,minY:20,maxY:40},{},330,true),['b']);
});

test('single selection toggles off and additive selection preserves unrelated tables',()=>{
 const previous=new Set(['a']);
 assert.deepEqual([...databaseTableSelection(previous,'a')],[]);
 assert.deepEqual([...databaseTableSelection(previous,'b')],['b']);
 assert.deepEqual([...databaseTableSelection(previous,'b',true)],['a','b']);
 assert.deepEqual([...databaseTableSelection(new Set(['a','b']),'a',true)],['b']);
 assert.deepEqual([...previous],['a']);
});

test('one multi-delete removes all selected tables and their incoming references atomically',()=>{
 const a=table('a',0,0),b=table('b',500,0),c=table('c',1000,0),d=table('d',1500,0);
 c.columns.push(column('a-id',{tableId:'a',columnId:'id'}),column('b-id',{tableId:'b',columnId:'id'}),column('d-id',{tableId:'d',columnId:'id'}));
 const schema={schemaVersion:1,display:'BOTH',tables:[a,b,c,d]};
 const next=removeDbTables(schema,['a','b']);
 assert.deepEqual(next.tables.map(t=>t.id),['c','d']);
 assert.equal(next.tables[0].columns[1].reference,null);
 assert.equal(next.tables[0].columns[2].reference,null);
 assert.deepEqual(next.tables[0].columns[3].reference,{tableId:'d',columnId:'id'});
 assert.equal(schema.tables.length,4);
 assert.equal(schema.tables[2].columns[1].reference.tableId,'a');
 parseDatabaseSchema(next);
});

test('multi-delete keeps at least one table and ignores missing or repeated IDs safely',()=>{
 const schema={schemaVersion:1,display:'BOTH',tables:[table('a',0,0),table('b',500,0)]};
 assert.equal(removeDbTables(schema,['a','b']),schema);
 assert.equal(removeDbTables(schema,['missing']),schema);
 assert.deepEqual(removeDbTables(schema,['a','a','missing']).tables.map(t=>t.id),['b']);
});
