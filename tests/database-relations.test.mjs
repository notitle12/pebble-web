import test from 'node:test';
import assert from 'node:assert/strict';
import {databaseLinks,crowFootPaths,routeTableConnection,segmentHitsRect} from '../src/features/post/database-relations.ts';
import {updateDbColumn,relationCardinality} from '../src/features/post/database-schema.ts';
const schema=()=>({schemaVersion:1,display:'BOTH',tables:[{id:'users',name:'users',description:'',position:{x:32,y:32},columns:[{id:'id',name:'id',dataType:'BIGINT',nullable:false,primaryKey:true,unique:false,description:'',reference:null}]},{id:'posts',name:'posts',description:'',position:{x:372,y:32},columns:[{id:'user-id',name:'user_id',dataType:'BIGINT',nullable:true,primaryKey:false,unique:false,description:'',reference:{tableId:'users',columnId:'id'}}]}]});
test('1:1 and required relation labels follow UNIQUE and NULL, and survive renaming',()=>{
 let s=schema();let l=databaseLinks(s)[0];assert.equal(l.many,true);assert.equal(l.targetRequired,false);assert.equal(l.sourceRequired,false);assert.equal(l.notation,'IE');
 s=updateDbColumn(s,'posts','user-id',{unique:true,nullable:false,reference:{tableId:'users',columnId:'id',notation:'BARKER',sourceRequired:true}});
 l=databaseLinks(s)[0];assert.equal(l.many,false);assert.equal(l.targetRequired,true);assert.equal(l.sourceRequired,true);assert.equal(l.notation,'IE');
 s=updateDbColumn(s,'users','id',{name:'member_id'});assert.match(databaseLinks(s)[0].label,/users.member_id/);
});
test('horizontal ports use actual measured card centers and follow movement',()=>{
 const s=schema(),sizes={users:{width:660,height:180},posts:{width:660,height:240}};
 let l=databaseLinks(s,true,sizes)[0];assert.equal(l.source.x,372*2.5);assert.equal(l.target.x,32*2.5+660);assert.equal(l.source.y,32*2.5+120);assert.equal(l.target.y,32*2.5+90);assert.equal(l.source.angle,180);assert.equal(l.target.angle,0);
 s.tables[1].position={x:32,y:240};l=databaseLinks(s,true,sizes)[0];assert.equal(l.source.y,240*2.5);assert.equal(l.target.y,32*2.5+180);assert.equal(l.source.angle,270);assert.equal(l.target.angle,90);
});
test('vertical, reversed, diagonal, close and obstacle routes avoid card interiors',()=>{
 for(const [a,b,other] of [
  [{x:100,y:100,width:200,height:100},{x:100,y:300,width:200,height:180}],
  [{x:100,y:300,width:200,height:180},{x:100,y:100,width:200,height:100}],
  [{x:100,y:100,width:200,height:180},{x:500,y:450,width:200,height:100}],
  [{x:100,y:100,width:200,height:180},{x:325,y:100,width:200,height:180}],
  [{x:100,y:100,width:200,height:180},{x:800,y:100,width:200,height:180},{x:450,y:60,width:180,height:300}],
 ]){
  const obstacles=[a,b,...(other?[other]:[])],route=routeTableConnection(a,b,obstacles);
  assert.ok(route.points.length>=2);
  for(let i=1;i<route.points.length;i++){const start=route.points[i-1],end=route.points[i];assert.ok(start.x===end.x||start.y===end.y);for(const r of obstacles)assert.equal(segmentHitsRect(start,end,r),false,JSON.stringify({start,end,r}));}
  const first=route.points[1],last=route.points.at(-2);assert.ok((first.x-route.source.x)*route.source.normal.x+(first.y-route.source.y)*route.source.normal.y>0);assert.ok((last.x-route.target.x)*route.target.normal.x+(last.y-route.target.y)*route.target.normal.y>0);
 }
});
test('self-table FK has two separate right-side ports and optional IE markers',()=>{
 const s=schema();s.tables[1].columns[0].reference={tableId:'posts',columnId:'key'};s.tables[1].columns.push({...s.tables[0].columns[0],id:'key'});
 const l=databaseLinks(s)[0];assert.equal(l.source.x,l.target.x);assert.notEqual(l.source.y,l.target.y);assert.ok(l.points[1].x>l.source.x);
 const optional=crowFootPaths(0,0,1,true,false);assert.equal(optional.circle.cx,23);assert.match(optional.maximum,/L10 0/);assert.equal(optional.minimum,null);
 const required=crowFootPaths(0,0,1,false,true);assert.equal(required.circle,null);assert.match(required.minimum,/M23 -7/);
});
test('a single PK remains one-to-one without an explicit UNIQUE checkbox',()=>{
 const s=schema();const t=s.tables[1],c={...t.columns[0],primaryKey:true,nullable:false};t.columns[0]=c;assert.equal(relationCardinality(t,c).many,false);
});
