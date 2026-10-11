import test from 'node:test';
import assert from 'node:assert/strict';
import {databaseLinks,crowFootPaths} from '../src/features/post/database-relations.ts';
import {updateDbColumn,relationCardinality} from '../src/features/post/database-schema.ts';
const schema=()=>({schemaVersion:1,display:'BOTH',tables:[{id:'users',name:'users',description:'',position:{x:32,y:32},columns:[{id:'id',name:'id',dataType:'BIGINT',nullable:false,primaryKey:true,unique:false,description:'',reference:null}]},{id:'posts',name:'posts',description:'',position:{x:372,y:32},columns:[{id:'user-id',name:'user_id',dataType:'BIGINT',nullable:true,primaryKey:false,unique:false,description:'',reference:{tableId:'users',columnId:'id'}}]}]});
test('1:1 and required relation labels follow UNIQUE and NULL, and survive renaming',()=>{
 let s=schema();let l=databaseLinks(s)[0];assert.equal(l.many,true);assert.equal(l.targetRequired,false);assert.equal(l.sourceRequired,false);assert.equal(l.notation,'IE');
 s=updateDbColumn(s,'posts','user-id',{unique:true,nullable:false,reference:{tableId:'users',columnId:'id',notation:'BARKER',sourceRequired:true}});
 l=databaseLinks(s)[0];assert.equal(l.many,false);assert.equal(l.targetRequired,true);assert.equal(l.sourceRequired,true);assert.equal(l.notation,'BARKER');
 s=updateDbColumn(s,'users','id',{name:'member_id'});assert.match(databaseLinks(s)[0].label,/users.member_id/);
});
test('editor line endpoints align with the directly editable row centers at projected positions',()=>{
 const s=schema(),l=databaseLinks(s,true)[0];assert.equal(l.x1,372*2.5);assert.equal(l.x2,32*2.5+660);assert.equal(l.y1,32*2.5+96);
 s.tables[1].position.y=200;const moved=databaseLinks(s,true)[0];assert.equal(moved.y1,596);assert.equal(moved.y2,176);assert.match(moved.first,/V386$/);
});
test('self-table FK uses an outside loop and IE has true optional/mandatory crow-foot markers',()=>{
 const s=schema();s.tables[1].columns[0].reference={tableId:'posts',columnId:'key'};s.tables[1].columns.push({...s.tables[0].columns[0],id:'key'});
 const l=databaseLinks(s)[0];assert.equal(l.x1,l.x2);assert.notEqual(l.y1,l.y2);assert.match(l.first,new RegExp(`H${l.x1+60}`));
 const optional=crowFootPaths(100,50,1,true,false);assert.equal(optional.circle.cx,123);assert.match(optional.maximum,/L110 50/);assert.equal(optional.minimum,null);
 const required=crowFootPaths(100,50,-1,false,true);assert.equal(required.circle,null);assert.match(required.minimum,/M77 43/);
});
test('a single PK remains one-to-one without an explicit UNIQUE checkbox',()=>{
 const s=schema();const t=s.tables[1],c={...t.columns[0],primaryKey:true,nullable:false};t.columns[0]=c;assert.equal(relationCardinality(t,c).many,false);
});
